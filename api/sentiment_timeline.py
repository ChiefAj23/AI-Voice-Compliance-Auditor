"""
Sentiment Timeline Analysis Module
Analyzes how sentiment, emotion, and compliance scores change over time in audio
"""
from typing import Dict, List
from transformers import pipeline
from datetime import timedelta
import re

# Initialize pipelines (reuse if already initialized)
try:
    sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment")
except:
    sentiment_pipeline = None

try:
    emotion_pipeline = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions")
except:
    emotion_pipeline = None


def segment_text_by_time(whisper_result: Dict, segment_duration: float = 10.0) -> List[Dict]:
    """
    Segment transcription by time windows

    Args:
        whisper_result: Whisper transcription result with segments
        segment_duration: Duration of each segment in seconds (default: 10s)

    Returns:
        List of segments with text and time ranges
    """
    if not whisper_result.get("segments"):
        # Fallback: split text into chunks
        text = whisper_result.get("text", "")
        return [{"text": text, "start": 0.0, "end": 0.0, "segment_id": 0}]

    segments = whisper_result["segments"]
    timeline_segments = []
    current_segment_start = 0.0
    current_segment_text = []
    current_segment_end = 0.0
    segment_id = 0

    for i, segment in enumerate(segments):
        start = segment.get("start", 0.0)
        end = segment.get("end", 0.0)
        text = segment.get("text", "").strip()

        # Add to current segment if within duration
        if end <= current_segment_start + segment_duration:
            current_segment_text.append(text)
            current_segment_end = end
        else:
            # Save current segment and start new one
            if current_segment_text:
                timeline_segments.append({
                    "segment_id": segment_id,
                    "text": " ".join(current_segment_text),
                    "start": current_segment_start,
                    "end": current_segment_end,
                    "duration": current_segment_end - current_segment_start
                })
                segment_id += 1

            # Start new segment
            current_segment_start = start
            current_segment_text = [text]
            current_segment_end = end

    # Add final segment
    if current_segment_text:
        timeline_segments.append({
            "segment_id": segment_id,
            "text": " ".join(current_segment_text),
            "start": current_segment_start,
            "end": current_segment_end,
            "duration": current_segment_end - current_segment_start
        })

    return timeline_segments


def analyze_segment_sentiment(text: str) -> Dict:
    """Analyze sentiment for a text segment"""
    if not sentiment_pipeline or not text.strip():
        return {"sentiment": "NEUTRAL", "confidence": 0.5, "score": 0.0}

    try:
        result = sentiment_pipeline(text)[0]
        sentiment = result["label"].upper()
        confidence = round(result["score"], 3)
        # Normalize to -1 (negative) to 1 (positive) scale
        score = 1.0 if sentiment == "POSITIVE" else (-1.0 if sentiment == "NEGATIVE" else 0.0)
        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "score": score * confidence  # Weighted score
        }
    except:
        return {"sentiment": "NEUTRAL", "confidence": 0.5, "score": 0.0}


def analyze_segment_emotion(text: str) -> Dict:
    """Analyze emotion for a text segment"""
    if not emotion_pipeline or not text.strip():
        return {"emotion": "neutral", "confidence": 0.5}

    try:
        result = emotion_pipeline(text)[0]
        return {
            "emotion": result["label"],
            "confidence": round(result["score"], 3)
        }
    except:
        return {"emotion": "neutral", "confidence": 0.5}


def calculate_segment_compliance(sentiment: Dict, emotion: Dict, toxicity_score: float = 0.0) -> float:
    """Calculate compliance score for a segment"""
    sentiment_weight = {"NEGATIVE": 0.6, "NEUTRAL": 0.9, "POSITIVE": 1.0}
    emotion_penalty = {
        "anger": 0.6, "fear": 0.8, "joy": 1.0, "calm": 1.0, "sadness": 0.8,
        "disgust": 0.7, "surprise": 0.9, "neutral": 1.0
    }
    toxicity_penalty = 1.0 - min(1.0, toxicity_score)

    sentiment_label = sentiment.get("sentiment", "NEUTRAL")
    emotion_label = emotion.get("emotion", "neutral")

    raw_score = (
        sentiment_weight.get(sentiment_label, 1.0) *
        emotion_penalty.get(emotion_label.lower(), 1.0) *
        toxicity_penalty
    )

    return round(raw_score * 100, 2)


def create_sentiment_timeline(whisper_result: Dict, segment_duration: float = 10.0) -> Dict:
    """
    Create a sentiment timeline analysis

    Args:
        whisper_result: Whisper transcription result
        segment_duration: Duration of each time segment in seconds

    Returns:
        Dictionary with timeline analysis
    """
    try:
        # Segment text by time
        segments = segment_text_by_time(whisper_result, segment_duration)

        timeline = []
        overall_metrics = {
            "total_segments": len(segments),
            "total_duration": segments[-1]["end"] if segments else 0.0,
            "average_sentiment_score": 0.0,
            "sentiment_trend": "stable",
            "compliance_range": {"min": 100.0, "max": 0.0, "average": 0.0}
        }

        sentiment_scores = []
        compliance_scores = []

        for segment in segments:
            text = segment.get("text", "")

            # Analyze sentiment and emotion
            sentiment = analyze_segment_sentiment(text)
            emotion = analyze_segment_emotion(text)

            # Calculate compliance (simplified - no toxicity per segment)
            compliance_score = calculate_segment_compliance(sentiment, emotion, 0.0)

            # Add to timeline
            timeline.append({
                "segment_id": segment.get("segment_id", 0),
                "start_time": segment.get("start", 0.0),
                "end_time": segment.get("end", 0.0),
                "text": text,
                "sentiment": sentiment,
                "emotion": emotion,
                "compliance_score": compliance_score
            })

            sentiment_scores.append(sentiment.get("score", 0.0))
            compliance_scores.append(compliance_score)

        # Calculate overall metrics
        if sentiment_scores:
            overall_metrics["average_sentiment_score"] = round(sum(sentiment_scores) / len(sentiment_scores), 3)
            # Determine trend
            if len(sentiment_scores) >= 2:
                first_half = sum(sentiment_scores[:len(sentiment_scores)//2]) / (len(sentiment_scores)//2)
                second_half = sum(sentiment_scores[len(sentiment_scores)//2:]) / (len(sentiment_scores) - len(sentiment_scores)//2)
                if second_half > first_half + 0.1:
                    overall_metrics["sentiment_trend"] = "improving"
                elif second_half < first_half - 0.1:
                    overall_metrics["sentiment_trend"] = "declining"

        if compliance_scores:
            overall_metrics["compliance_range"] = {
                "min": round(min(compliance_scores), 2),
                "max": round(max(compliance_scores), 2),
                "average": round(sum(compliance_scores) / len(compliance_scores), 2)
            }

        return {
            "timeline": timeline,
            "overall_metrics": overall_metrics,
            "segment_duration": segment_duration
        }
    except Exception as e:
        return {
            "timeline": [],
            "overall_metrics": {},
            "error": str(e)
        }

