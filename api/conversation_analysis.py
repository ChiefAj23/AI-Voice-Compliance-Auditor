"""
Advanced Conversation Analysis Module
Analyzes conversation patterns, turn-taking, interruptions, and dialogue flow
"""
from typing import Dict, List, Optional
from datetime import timedelta
import re


def analyze_turn_taking(segments: List[Dict]) -> Dict:
    """
    Analyze turn-taking patterns in conversation

    Args:
        segments: List of segments with speaker and timing information

    Returns:
        Analysis of turn-taking patterns
    """
    if not segments or len(segments) < 2:
        return {
            "total_turns": 0,
            "turn_patterns": [],
            "turn_statistics": {}
        }

    # Identify turns (consecutive segments by same speaker)
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

    # Calculate statistics
    if not turns:
        return {
            "total_turns": 0,
            "turn_patterns": [],
            "turn_statistics": {}
        }

    turn_durations = [t["duration"] for t in turns]
    avg_turn_duration = sum(turn_durations) / len(turn_durations) if turn_durations else 0

    # Turn statistics by speaker
    speaker_stats = {}
    for turn in turns:
        speaker = turn["speaker"]
        if speaker not in speaker_stats:
            speaker_stats[speaker] = {
                "turn_count": 0,
                "total_duration": 0,
                "avg_duration": 0,
                "min_duration": float('inf'),
                "max_duration": 0
            }

        stats = speaker_stats[speaker]
        stats["turn_count"] += 1
        stats["total_duration"] += turn["duration"]
        stats["min_duration"] = min(stats["min_duration"], turn["duration"])
        stats["max_duration"] = max(stats["max_duration"], turn["duration"])

    # Calculate averages
    for speaker in speaker_stats:
        stats = speaker_stats[speaker]
        stats["avg_duration"] = round(stats["total_duration"] / stats["turn_count"], 2)
        stats["total_duration"] = round(stats["total_duration"], 2)
        stats["min_duration"] = round(stats["min_duration"], 2) if stats["min_duration"] != float('inf') else 0

    return {
        "total_turns": len(turns),
        "avg_turn_duration": round(avg_turn_duration, 2),
        "turn_patterns": turns,
        "turn_statistics": speaker_stats
    }


def detect_interruptions(segments: List[Dict], threshold: float = 0.5) -> List[Dict]:
    """
    Detect interruptions in conversation

    Args:
        segments: List of segments with speaker and timing
        threshold: Minimum gap to consider an interruption (seconds)

    Returns:
        List of detected interruptions
    """
    interruptions = []

    if len(segments) < 2:
        return interruptions

    for i in range(len(segments) - 1):
        current_seg = segments[i]
        next_seg = segments[i + 1]

        current_speaker = current_seg.get("speaker", "Unknown")
        next_speaker = next_seg.get("speaker", "Unknown")

        # Check if different speakers
        if current_speaker != next_speaker:
            current_end = current_seg.get("end", 0)
            next_start = next_seg.get("start", 0)
            gap = next_start - current_end

            # If gap is very small, it might be an interruption
            if gap < threshold and gap >= 0:
                interruptions.append({
                    "type": "interruption",
                    "interrupted_speaker": current_speaker,
                    "interrupting_speaker": next_speaker,
                    "time": round(current_end, 2),
                    "gap_duration": round(gap, 2),
                    "interrupted_segment": current_seg,
                    "interrupting_segment": next_seg
                })

    return interruptions


def analyze_conversation_flow(segments: List[Dict], transcription_segments: List[Dict]) -> Dict:
    """
    Analyze overall conversation flow and quality

    Args:
        segments: Speaker diarization segments
        transcription_segments: Transcription segments with text

    Returns:
        Conversation flow analysis
    """
    if not segments:
        return {
            "conversation_quality": "unknown",
            "flow_metrics": {},
            "patterns": []
        }

    # Map transcription to speakers
    speaker_text_map = {}
    for trans_seg in transcription_segments:
        trans_start = trans_seg.get("start", 0)
        trans_end = trans_seg.get("end", 0)
        text = trans_seg.get("text", "").strip()

        # Find matching speaker segment
        for seg in segments:
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", 0)

            if trans_start >= seg_start and trans_start < seg_end:
                speaker = seg.get("speaker", "Unknown")
                if speaker not in speaker_text_map:
                    speaker_text_map[speaker] = []
                speaker_text_map[speaker].append({
                    "text": text,
                    "start": trans_start,
                    "end": trans_end
                })
                break

    # Calculate metrics
    total_duration = segments[-1].get("end", 0) if segments else 0
    num_speakers = len(set(seg.get("speaker", "Unknown") for seg in segments))

    # Speaker participation
    speaker_participation = {}
    for speaker, texts in speaker_text_map.items():
        total_text_length = sum(len(t["text"]) for t in texts)
        total_time = sum(t["end"] - t["start"] for t in texts)
        speaker_participation[speaker] = {
            "text_length": total_text_length,
            "speaking_time": round(total_time, 2),
            "percentage": round((total_time / total_duration) * 100, 2) if total_duration > 0 else 0,
            "num_segments": len(texts)
        }

    # Balance score (how balanced the conversation is)
    variance = 0
    if speaker_participation:
        participation_percentages = [stats["percentage"] for stats in speaker_participation.values()]
        if len(participation_percentages) > 1:
            # Calculate variance (lower = more balanced)
            mean_participation = sum(participation_percentages) / len(participation_percentages)
            variance = sum((p - mean_participation) ** 2 for p in participation_percentages) / len(participation_percentages)
            balance_score = max(0, 100 - (variance * 2))  # Convert to 0-100 scale
        else:
            balance_score = 0
    else:
        balance_score = 50

    # Conversation quality assessment
    if balance_score >= 70 and num_speakers >= 2:
        quality = "excellent"
    elif balance_score >= 50:
        quality = "good"
    elif balance_score >= 30:
        quality = "fair"
    else:
        quality = "poor"

    # Detect patterns
    patterns = []

    # Check for monologue (one speaker dominates)
    if speaker_participation:
        max_participation = max(stats["percentage"] for stats in speaker_participation.values())
        if max_participation > 80:
            patterns.append({
                "type": "monologue",
                "description": f"One speaker dominates ({max_participation:.1f}% of conversation)",
                "severity": "high" if max_participation > 90 else "medium"
            })

    # Check for balanced conversation
    if balance_score >= 70:
        patterns.append({
            "type": "balanced",
            "description": "Well-balanced conversation between speakers",
            "severity": "low"
        })

    return {
        "conversation_quality": quality,
        "balance_score": round(balance_score, 2),
        "num_speakers": num_speakers,
        "total_duration": round(total_duration, 2),
        "speaker_participation": speaker_participation,
        "flow_metrics": {
            "balance_score": round(balance_score, 2),
            "participation_variance": round(variance, 2) if speaker_participation and len(participation_percentages) > 1 else 0
        },
        "patterns": patterns
    }


def calculate_conversation_metrics(segments: List[Dict], transcription_segments: List[Dict]) -> Dict:
    """
    Calculate comprehensive conversation metrics

    Args:
        segments: Speaker segments
        transcription_segments: Transcription segments

    Returns:
        Comprehensive conversation metrics
    """
    # Turn-taking analysis
    turn_analysis = analyze_turn_taking(segments)

    # Interruption detection
    interruptions = detect_interruptions(segments)

    # Conversation flow
    flow_analysis = analyze_conversation_flow(segments, transcription_segments)

    # Calculate silence periods
    silence_periods = []
    for i in range(len(segments) - 1):
        current_end = segments[i].get("end", 0)
        next_start = segments[i + 1].get("start", 0)
        gap = next_start - current_end

        if gap > 1.0:  # Silence longer than 1 second
            silence_periods.append({
                "start": round(current_end, 2),
                "end": round(next_start, 2),
                "duration": round(gap, 2)
            })

    total_silence = sum(s["duration"] for s in silence_periods)
    total_duration = segments[-1].get("end", 0) if segments else 1
    silence_percentage = (total_silence / total_duration * 100) if total_duration > 0 else 0

    return {
        "turn_taking": turn_analysis,
        "interruptions": {
            "count": len(interruptions),
            "list": interruptions,
            "rate": round(len(interruptions) / (turn_analysis.get("total_turns", 1) or 1), 2)
        },
        "conversation_flow": flow_analysis,
        "silence_analysis": {
            "total_silence": round(total_silence, 2),
            "silence_percentage": round(silence_percentage, 2),
            "silence_periods": silence_periods,
            "avg_silence_duration": round(total_silence / len(silence_periods), 2) if silence_periods else 0
        },
        "summary": {
            "total_turns": turn_analysis.get("total_turns", 0),
            "interruptions": len(interruptions),
            "conversation_quality": flow_analysis.get("conversation_quality", "unknown"),
            "balance_score": flow_analysis.get("balance_score", 0)
        }
    }

