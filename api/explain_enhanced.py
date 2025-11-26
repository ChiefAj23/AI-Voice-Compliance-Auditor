import shap
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import re
from typing import Dict, List, Tuple
from collections import Counter

# Models for explainability
MODEL_NAME = "unitary/toxic-bert"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
toxicity_model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
toxicity_model.eval()

# Initialize pipelines for sentiment and emotion (lazy loading to avoid import conflicts)
_sentiment_pipeline = None
_emotion_pipeline = None

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        _sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment")
    return _sentiment_pipeline

def get_emotion_pipeline():
    global _emotion_pipeline
    if _emotion_pipeline is None:
        _emotion_pipeline = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions")
    return _emotion_pipeline

def explain_toxicity_enhanced(text: str, max_tokens: int = 128):
    """
    Enhanced toxicity explanation with SHAP values
    Returns detailed token-level attributions
    """
    if not isinstance(text, str):
        text = str(text)

    def predict(batch_texts):
        if isinstance(batch_texts, np.ndarray):
            batch_texts = batch_texts.tolist()
        if isinstance(batch_texts, str):
            batch_texts = [batch_texts]
        elif not isinstance(batch_texts, list):
            batch_texts = [str(x) for x in batch_texts]

        encodings = tokenizer(
            batch_texts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_tokens
        )

        with torch.no_grad():
            outputs = toxicity_model(**encodings)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1)

        return probs[:, 1].detach().numpy()

    explainer = shap.Explainer(predict, tokenizer)
    shap_values = explainer([text], silent=True)

    tokens = shap_values.data[0]
    values = shap_values.values[0]

    # Normalize to [-1, 1] range
    max_abs = max(abs(v) for v in values) or 1.0
    normalized_values = [float(v / max_abs) for v in values]

    token_importance = list(zip(tokens, normalized_values))

    # Calculate statistics
    positive_tokens = [(t, v) for t, v in token_importance if v > 0.1]
    negative_tokens = [(t, v) for t, v in token_importance if v < -0.1]

    # Get top contributors
    top_positive = sorted(positive_tokens, key=lambda x: abs(x[1]), reverse=True)[:10]
    top_negative = sorted(negative_tokens, key=lambda x: abs(x[1]), reverse=True)[:10]

    return {
        "token_level": token_importance,
        "top_positive": top_positive,
        "top_negative": top_negative,
        "summary": {
            "total_tokens": len(tokens),
            "positive_impact": len(positive_tokens),
            "negative_impact": len(negative_tokens),
            "max_positive": max([v for _, v in token_importance], default=0),
            "max_negative": min([v for _, v in token_importance], default=0)
        }
    }


def explain_sentiment_contribution(text: str) -> Dict:
    """
    Explain sentiment contribution by analyzing sentence-level sentiment
    """
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return {"sentence_sentiment": [], "summary": {}}

    sentence_sentiments = []
    sentiment_pipeline = get_sentiment_pipeline()
    for sentence in sentences:
        if len(sentence) > 0:
            try:
                result = sentiment_pipeline(sentence)[0]
                sentence_sentiments.append({
                    "sentence": sentence,
                    "label": result["label"],
                    "score": result["score"]
                })
            except:
                pass

    # Calculate statistics
    sentiment_counts = Counter([s["label"] for s in sentence_sentiments])
    avg_confidence = sum(s["score"] for s in sentence_sentiments) / len(sentence_sentiments) if sentence_sentiments else 0

    return {
        "sentence_sentiment": sentence_sentiments,
        "summary": {
            "total_sentences": len(sentence_sentiments),
            "sentiment_distribution": dict(sentiment_counts),
            "average_confidence": avg_confidence
        }
    }


def explain_emotion_breakdown(text: str) -> Dict:
    """
    Break down emotion by analyzing different parts of the text
    """
    # Split into chunks for analysis
    words = text.split()
    chunk_size = max(10, len(words) // 3)
    chunks = [' '.join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]

    chunk_emotions = []
    emotion_pipeline = get_emotion_pipeline()
    for chunk in chunks[:5]:  # Limit to 5 chunks
        if len(chunk) > 0:
            try:
                result = emotion_pipeline(chunk[:512])[0]  # Limit length
                chunk_emotions.append({
                    "text": chunk,
                    "emotion": result["label"],
                    "confidence": result["score"]
                })
            except:
                pass

    # Calculate statistics
    emotion_counts = Counter([c["emotion"] for c in chunk_emotions])
    primary_emotion = emotion_counts.most_common(1)[0] if emotion_counts else ("N/A", 0)

    return {
        "chunk_emotions": chunk_emotions,
        "summary": {
            "primary_emotion": primary_emotion[0],
            "emotion_distribution": dict(emotion_counts),
            "total_chunks": len(chunk_emotions)
        }
    }


def get_compliance_factors(analysis: Dict) -> Dict:
    """
    Explain compliance score by breaking down contributing factors
    """
    sentiment = analysis.get("sentiment", "NEUTRAL")
    emotion = analysis.get("emotion", "neutral")
    toxicity = analysis.get("toxicity_score", 0)
    compliance = analysis.get("compliance_score", 0)

    # Define weights (matching model.py)
    sentiment_weight = {"NEGATIVE": 0.6, "NEUTRAL": 0.9, "POSITIVE": 1.0}
    emotion_penalty = {"anger": 0.6, "fear": 0.8, "joy": 1.0, "calm": 1.0, "sadness": 0.8}
    toxicity_penalty = 1.0 - min(1.0, toxicity)

    # Calculate contributions
    sentiment_contrib = sentiment_weight.get(sentiment.upper(), 1.0) * 100
    emotion_contrib = emotion_penalty.get(emotion.lower(), 1.0) * 100
    toxicity_contrib = toxicity_penalty * 100

    # Calculate impact
    factors = {
        "sentiment": {
            "value": sentiment,
            "contribution": sentiment_contrib,
            "impact": "positive" if sentiment_contrib >= 90 else "neutral" if sentiment_contrib >= 75 else "negative"
        },
        "emotion": {
            "value": emotion,
            "contribution": emotion_contrib,
            "impact": "positive" if emotion_contrib >= 90 else "neutral" if emotion_contrib >= 75 else "negative"
        },
        "toxicity": {
            "value": f"{toxicity * 100:.2f}%",
            "contribution": toxicity_contrib,
            "impact": "positive" if toxicity_contrib >= 90 else "negative"
        }
    }

    # Identify primary driver
    contributions = [
        ("sentiment", sentiment_contrib),
        ("emotion", emotion_contrib),
        ("toxicity", toxicity_contrib)
    ]
    primary_driver = max(contributions, key=lambda x: abs(100 - x[1]))

    return {
        "factors": factors,
        "primary_driver": {
            "factor": primary_driver[0],
            "impact": "major" if abs(100 - primary_driver[1]) > 10 else "minor"
        },
        "compliance_breakdown": {
            "sentiment_contribution": f"{sentiment_contrib:.1f}%",
            "emotion_contribution": f"{emotion_contrib:.1f}%",
            "toxicity_contribution": f"{toxicity_contrib:.1f}%"
        }
    }


def comprehensive_explanation(text: str, analysis: Dict) -> Dict:
    """
    Generate comprehensive explanation combining all metrics
    """
    toxicity_explanation = explain_toxicity_enhanced(text)
    sentiment_explanation = explain_sentiment_contribution(text)
    emotion_explanation = explain_emotion_breakdown(text)
    compliance_factors = get_compliance_factors(analysis)

    return {
        "toxicity": toxicity_explanation,
        "sentiment": sentiment_explanation,
        "emotion": emotion_explanation,
        "compliance": compliance_factors,
        "overall_summary": {
            "text_length": len(text),
            "word_count": len(text.split()),
            "key_insights": {
                "most_toxic_words": [t[0] for t in toxicity_explanation["top_negative"][:5]],
                "most_positive_words": [t[0] for t in toxicity_explanation["top_positive"][:5]],
                "dominant_sentiment": sentiment_explanation["summary"].get("sentiment_distribution", {}),
                "primary_emotion": emotion_explanation["summary"].get("primary_emotion", "N/A")
            }
        }
    }

