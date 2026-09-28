"""Audio quality metrics on a generated tone: no models are involved, so this runs everywhere."""
import numpy as np
import soundfile as sf

from api.audio_quality import analyze_audio_quality


def test_audio_quality_is_measured(tmp_path):
    rate = 16000
    t = np.linspace(0, 2.0, rate * 2, endpoint=False)
    noise = 0.01 * np.random.default_rng(0).standard_normal(t.size)
    path = tmp_path / "tone.wav"
    sf.write(path, (0.3 * np.sin(2 * np.pi * 220 * t) + noise).astype(np.float32), rate)

    result = analyze_audio_quality(str(path))
    assert "error" not in result, result
    assert 0 <= result["quality_score"] <= 100
    assert result["quality_level"] != "unknown"
