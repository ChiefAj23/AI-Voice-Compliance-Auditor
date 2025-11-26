"""
Speaker Diarization Module
Identifies and separates different speakers in audio
"""
from typing import Dict, List, Optional
import numpy as np
import librosa
from datetime import timedelta


def simple_speaker_segmentation(audio_path: str, num_speakers: Optional[int] = None) -> Dict:
    """
    Simple speaker segmentation based on audio features
    This is a lightweight alternative to full diarization

    Args:
        audio_path: Path to audio file
        num_speakers: Expected number of speakers (None for auto-detect)

    Returns:
        Dictionary with speaker segments and analysis
    """
    try:
        # Load audio
        y, sr = librosa.load(audio_path, sr=16000)
        duration = len(y) / sr

        # Use spectral features to identify potential speaker changes
        # This is a simplified approach - for production, use pyannote.audio

        # Calculate features that might indicate speaker changes
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]

        # Simple segmentation based on feature changes
        segment_duration = 2.0  # 2-second segments
        num_segments = int(duration / segment_duration)

        segments = []
        speaker_labels = []

        for i in range(num_segments):
            start_time = i * segment_duration
            end_time = min((i + 1) * segment_duration, duration)

            # Extract features for this segment
            start_idx = int(start_time * sr)
            end_idx = int(end_time * sr)
            segment_audio = y[start_idx:end_idx]

            if len(segment_audio) > 0:
                # Calculate segment features
                segment_mfcc = librosa.feature.mfcc(y=segment_audio, sr=sr, n_mfcc=13)
                segment_centroid = librosa.feature.spectral_centroid(y=segment_audio, sr=sr)[0]

                # Simple speaker assignment based on feature similarity
                # In production, use proper clustering (KMeans, DBSCAN, etc.)
                avg_mfcc = np.mean(segment_mfcc, axis=1)
                avg_centroid = np.mean(segment_centroid)

                # Assign speaker based on feature similarity
                # This is a placeholder - real diarization needs proper clustering
                speaker_id = int((avg_centroid / 5000) % (num_speakers or 2))

                segments.append({
                    "start": round(start_time, 2),
                    "end": round(end_time, 2),
                    "duration": round(end_time - start_time, 2),
                    "speaker": f"Speaker_{speaker_id + 1}",
                    "speaker_id": speaker_id,
                    "features": {
                        "avg_mfcc": [float(x) for x in avg_mfcc[:5]],  # First 5 MFCCs
                        "avg_spectral_centroid": float(avg_centroid)
                    }
                })
                speaker_labels.append(speaker_id)

        # Analyze speaker distribution
        unique_speakers = list(set(speaker_labels))
        speaker_stats = {}
        for speaker_id in unique_speakers:
            speaker_segments = [s for s in segments if s["speaker_id"] == speaker_id]
            total_time = sum(s["duration"] for s in speaker_segments)
            speaker_stats[f"Speaker_{speaker_id + 1}"] = {
                "total_segments": len(speaker_segments),
                "total_time": round(total_time, 2),
                "percentage": round((total_time / duration) * 100, 2) if duration > 0 else 0
            }

        return {
            "segments": segments,
            "speaker_stats": speaker_stats,
            "num_speakers_detected": len(unique_speakers),
            "total_duration": round(duration, 2),
            "method": "feature_based_simple"
        }
    except Exception as e:
        return {
            "segments": [],
            "speaker_stats": {},
            "num_speakers_detected": 0,
            "error": str(e),
            "method": "feature_based_simple"
        }


def analyze_speaker_turns(segments: List[Dict], transcription_segments: List[Dict]) -> Dict:
    """
    Analyze speaker turn-taking patterns

    Args:
        segments: Speaker diarization segments
        transcription_segments: Whisper transcription segments with timestamps

    Returns:
        Analysis of conversation patterns
    """
    if not segments or not transcription_segments:
        return {
            "total_turns": 0,
            "avg_turn_duration": 0,
            "turn_distribution": {},
            "interruptions": [],
            "longest_turn": None,
            "shortest_turn": None
        }

    # Map transcription to speakers
    turns = []
    current_speaker = None
    current_turn_start = None
    current_turn_segments = []

    for seg in segments:
        speaker = seg.get("speaker", "Unknown")
        start = seg.get("start", 0)
        end = seg.get("end", 0)

        if speaker != current_speaker:
            # New turn
            if current_speaker is not None and current_turn_segments:
                turn_duration = current_turn_segments[-1]["end"] - current_turn_start
                turns.append({
                    "speaker": current_speaker,
                    "start": current_turn_start,
                    "end": current_turn_segments[-1]["end"],
                    "duration": round(turn_duration, 2),
                    "num_segments": len(current_turn_segments)
                })

            current_speaker = speaker
            current_turn_start = start
            current_turn_segments = [seg]
        else:
            # Continuation of same speaker
            current_turn_segments.append(seg)

    # Add final turn
    if current_speaker and current_turn_segments:
        turn_duration = current_turn_segments[-1]["end"] - current_turn_start
        turns.append({
            "speaker": current_speaker,
            "start": current_turn_start,
            "end": current_turn_segments[-1]["end"],
            "duration": round(turn_duration, 2),
            "num_segments": len(current_turn_segments)
        })

    # Analyze turns
    if not turns:
        return {
            "total_turns": 0,
            "avg_turn_duration": 0,
            "turn_distribution": {},
            "interruptions": [],
            "longest_turn": None,
            "shortest_turn": None
        }

    # Calculate statistics
    turn_durations = [t["duration"] for t in turns]
    avg_turn_duration = sum(turn_durations) / len(turn_durations) if turn_durations else 0

    # Turn distribution by speaker
    turn_distribution = {}
    for turn in turns:
        speaker = turn["speaker"]
        if speaker not in turn_distribution:
            turn_distribution[speaker] = {
                "count": 0,
                "total_duration": 0,
                "avg_duration": 0
            }
        turn_distribution[speaker]["count"] += 1
        turn_distribution[speaker]["total_duration"] += turn["duration"]

    for speaker in turn_distribution:
        stats = turn_distribution[speaker]
        stats["avg_duration"] = round(stats["total_duration"] / stats["count"], 2)
        stats["total_duration"] = round(stats["total_duration"], 2)

    # Detect potential interruptions (very short turns between longer ones)
    interruptions = []
    for i in range(1, len(turns) - 1):
        prev_turn = turns[i - 1]
        curr_turn = turns[i]
        next_turn = turns[i + 1]

        # If current turn is very short and between longer turns
        if (curr_turn["duration"] < 1.0 and
            prev_turn["duration"] > 2.0 and
            next_turn["duration"] > 2.0):
            interruptions.append({
                "speaker": curr_turn["speaker"],
                "start": curr_turn["start"],
                "end": curr_turn["end"],
                "duration": curr_turn["duration"],
                "context": {
                    "before": prev_turn["speaker"],
                    "after": next_turn["speaker"]
                }
            })

    # Find longest and shortest turns
    longest_turn = max(turns, key=lambda x: x["duration"]) if turns else None
    shortest_turn = min(turns, key=lambda x: x["duration"]) if turns else None

    return {
        "total_turns": len(turns),
        "avg_turn_duration": round(avg_turn_duration, 2),
        "turn_distribution": turn_distribution,
        "interruptions": interruptions,
        "longest_turn": longest_turn,
        "shortest_turn": shortest_turn,
        "turns": turns
    }


def create_speaker_timeline(segments: List[Dict], transcription_segments: List[Dict]) -> List[Dict]:
    """
    Create a timeline mapping transcription to speakers

    Args:
        segments: Speaker diarization segments
        transcription_segments: Whisper transcription segments

    Returns:
        Timeline with speaker assignments
    """
    timeline = []

    for trans_seg in transcription_segments:
        trans_start = trans_seg.get("start", 0)
        trans_end = trans_seg.get("end", 0)
        text = trans_seg.get("text", "").strip()

        # Find which speaker segment this transcription belongs to
        assigned_speaker = "Unknown"
        speaker_id = -1

        for seg in segments:
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", 0)

            # Check if transcription overlaps with speaker segment
            if trans_start >= seg_start and trans_start < seg_end:
                assigned_speaker = seg.get("speaker", "Unknown")
                speaker_id = seg.get("speaker_id", -1)
                break

        timeline.append({
            "start": trans_start,
            "end": trans_end,
            "text": text,
            "speaker": assigned_speaker,
            "speaker_id": speaker_id,
            "duration": round(trans_end - trans_start, 2)
        })

    return timeline

