"""
Audio quality metrics module
"""
import numpy as np
import librosa
import soundfile as sf
from typing import Dict, Optional, Any
import tempfile
import os


def _to_native_type(value: Any) -> Any:
    """Convert numpy types to native Python types"""
    if isinstance(value, (np.integer, np.int_, np.intc, np.intp, np.int8, np.int16, np.int32, np.int64)):
        return int(value)
    elif isinstance(value, (np.floating, np.float_, np.float16, np.float32, np.float64)):
        return float(value)
    elif isinstance(value, np.bool_):
        return bool(value)
    elif isinstance(value, np.ndarray):
        return value.tolist()
    else:
        return value

def analyze_audio_quality(audio_path: str) -> Dict:
    """
    Analyze audio quality metrics

    Args:
        audio_path: Path to audio file

    Returns:
        Dictionary with quality metrics
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=None)

        # Duration
        duration = len(y) / sr

        # Calculate metrics
        metrics = {
            "duration_seconds": round(float(duration), 2),
            "duration_formatted": _format_duration(duration),
            "sample_rate": int(sr),
            "channels": int(1 if len(y.shape) == 1 else y.shape[0]),
            "bit_depth": int(_estimate_bit_depth(y)),
            "file_size_bytes": int(os.path.getsize(audio_path)),
            "file_size_formatted": _format_file_size(os.path.getsize(audio_path))
        }

        # Audio level metrics
        rms = librosa.feature.rms(y=y)[0]
        rms_mean = _to_native_type(np.mean(rms))
        y_max = _to_native_type(np.max(np.abs(y)))
        metrics["average_volume"] = round(rms_mean, 4)
        metrics["max_volume"] = round(y_max, 4)
        metrics["volume_level"] = str(_classify_volume(rms_mean))

        # Background noise estimation
        noise_level = _estimate_noise_level(y)
        metrics["noise_level"] = round(noise_level, 4)
        metrics["noise_classification"] = str(_classify_noise(noise_level))

        # Clarity metrics
        spectral_centroid_arr = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_centroid_mean = _to_native_type(np.mean(spectral_centroid_arr))
        metrics["spectral_centroid"] = round(spectral_centroid_mean, 2)
        metrics["clarity_score"] = _calculate_clarity_score(y, sr)
        metrics["clarity_level"] = str(_classify_clarity(metrics["clarity_score"]))

        # Zero crossing rate (roughness indicator)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = _to_native_type(np.mean(zcr))
        metrics["zero_crossing_rate"] = round(zcr_mean, 4)

        # Silence detection
        silence_ratio = _detect_silence(y, sr)
        metrics["silence_ratio"] = round(silence_ratio, 2)
        metrics["has_silence_issues"] = bool(silence_ratio > 0.3)

        # Overall quality score (0-100)
        quality_score = _calculate_quality_score(metrics)
        metrics["quality_score"] = round(quality_score, 2)
        metrics["quality_level"] = str(_classify_quality(quality_score))

        return metrics

    except Exception as e:
        return {
            "error": str(e),
            "quality_score": 0,
            "quality_level": "unknown"
        }


def _format_duration(seconds: float) -> str:
    """Format duration as MM:SS"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def _format_file_size(bytes_size: int) -> str:
    """Format file size in human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"


def _estimate_bit_depth(y: np.ndarray) -> int:
    """Estimate bit depth from audio data"""
    # Common bit depths: 8, 16, 24, 32
    max_val = np.max(np.abs(y))
    if max_val <= 1.0:
        # Normalized audio, estimate from quantization
        if np.all(y == np.round(y * 255) / 255):
            return 8
        elif np.all(y == np.round(y * 32767) / 32767):
            return 16
        else:
            return 32  # Likely float32
    return 16  # Default assumption


def _estimate_noise_level(y: np.ndarray) -> float:
    """Estimate background noise level"""
    # Use spectral analysis to estimate noise floor
    stft = np.abs(librosa.stft(y, hop_length=512))
    # Use lower percentiles as noise floor estimate
    noise_floor = np.percentile(stft, 10)
    return _to_native_type(noise_floor)


def _classify_noise(noise_level: float) -> str:
    """Classify noise level"""
    if noise_level < 0.01:
        return "Very Low"
    elif noise_level < 0.05:
        return "Low"
    elif noise_level < 0.1:
        return "Medium"
    else:
        return "High"


def _calculate_clarity_score(y: np.ndarray, sr: int) -> float:
    """Calculate audio clarity score (0-100)"""
    # Based on spectral centroid and harmonic content
    spectral_centroid_arr = librosa.feature.spectral_centroid(y=y, sr=sr)
    spectral_rolloff_arr = librosa.feature.spectral_rolloff(y=y, sr=sr)

    # Convert numpy values to Python floats
    spectral_centroid = _to_native_type(np.mean(spectral_centroid_arr))
    spectral_rolloff = _to_native_type(np.mean(spectral_rolloff_arr))

    # Normalize and combine
    centroid_norm = min(spectral_centroid / 5000, 1.0) * 50  # Max score 50
    rolloff_norm = min(spectral_rolloff / 10000, 1.0) * 50  # Max score 50

    return float(centroid_norm + rolloff_norm)


def _classify_clarity(score: float) -> str:
    """Classify clarity level"""
    if score >= 80:
        return "Excellent"
    elif score >= 60:
        return "Good"
    elif score >= 40:
        return "Fair"
    else:
        return "Poor"


def _classify_volume(rms: float) -> str:
    """Classify volume level"""
    if rms < 0.01:
        return "Very Quiet"
    elif rms < 0.05:
        return "Quiet"
    elif rms < 0.2:
        return "Normal"
    elif rms < 0.5:
        return "Loud"
    else:
        return "Very Loud"


def _detect_silence(y: np.ndarray, sr: int, threshold: float = 0.01) -> float:
    """Detect ratio of silence in audio"""
    frame_length = int(0.025 * sr)  # 25ms frames
    hop_length = int(0.010 * sr)  # 10ms hop

    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    silent_frames = _to_native_type(np.sum(rms < threshold))
    total_frames = len(rms)

    ratio = float(silent_frames / total_frames) if total_frames > 0 else 0.0
    return ratio


def _calculate_quality_score(metrics: Dict) -> float:
    """Calculate overall quality score (0-100)"""
    score = 100.0

    # Penalties for various issues
    if metrics.get("silence_ratio", 0) > 0.3:
        score -= 20  # Too much silence

    if metrics.get("noise_classification") in ["High", "Very High"]:
        score -= 15  # High noise

    if metrics.get("volume_level") in ["Very Quiet", "Very Loud"]:
        score -= 15  # Poor volume levels

    if metrics.get("clarity_level") == "Poor":
        score -= 20  # Poor clarity

    if metrics.get("sample_rate", 0) < 16000:
        score -= 10  # Low sample rate

    return max(0, score)


def _classify_quality(score: float) -> str:
    """Classify overall quality"""
    if score >= 90:
        return "Excellent"
    elif score >= 75:
        return "Good"
    elif score >= 60:
        return "Fair"
    elif score >= 40:
        return "Poor"
    else:
        return "Very Poor"

