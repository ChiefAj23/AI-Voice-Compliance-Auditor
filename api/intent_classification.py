"""
Intent Classification Module
Classifies conversation intent (sales, support, complaint, etc.)
"""
from typing import Dict, List, Optional
from transformers import pipeline
import re


# Initialize intent classification pipeline (lazy loading)
_intent_pipeline = None

# Intent categories and their keywords for rule-based classification
INTENT_KEYWORDS = {
    "sales": [
        "buy", "purchase", "price", "cost", "discount", "deal", "offer",
        "order", "payment", "invoice", "billing", "subscription", "trial",
        "demo", "sign up", "register", "promotion", "special", "sale"
    ],
    "support": [
        "help", "issue", "problem", "error", "bug", "not working",
        "how to", "troubleshoot", "fix", "resolve", "support", "assistance",
        "technical", "guide", "instructions", "walkthrough", "stuck"
    ],
    "complaint": [
        "complaint", "unsatisfied", "disappointed", "poor", "terrible",
        "worst", "horrible", "bad experience", "unhappy", "frustrated",
        "angry", "annoyed", "refund", "return", "cancel", "dissatisfied",
        "issue", "problem", "wrong", "mistake", "failure"
    ],
    "inquiry": [
        "question", "ask", "wonder", "curious", "want to know", "tell me",
        "what is", "how does", "can you explain", "information", "details",
        "more about", "clarify", "understand", "learn"
    ],
    "feedback": [
        "feedback", "review", "comment", "suggestion", "opinion", "thoughts",
        "experience", "satisfaction", "rating", "recommend", "improve"
    ],
    "greeting": [
        "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
        "greetings", "welcome", "nice to meet", "pleasure"
    ],
    "follow_up": [
        "follow up", "check in", "status", "update", "progress", "reminder",
        "recall", "call back", "touch base", "circle back"
    ]
}


def classify_intent(text: str, use_ml: bool = True) -> Dict:
    """
    Classify the intent of a conversation

    Args:
        text: Conversation text
        use_ml: Whether to use ML model (True) or rule-based (False)

    Returns:
        Dictionary with intent classification and confidence
    """
    if not text or len(text.strip()) < 10:
        return {
            "primary_intent": "unknown",
            "confidence": 0.0,
            "all_intents": [],
            "method": "none",
            "error": "Text too short"
        }

    cleaned_text = text.lower().strip()

    if use_ml:
        try:
            # Try ML-based classification
            ml_result = classify_intent_ml(text)
            if ml_result and ml_result.get("confidence", 0) > 0.5:
                return ml_result
        except Exception as e:
            print(f"ML intent classification failed: {str(e)}, falling back to rule-based")

    # Fallback to rule-based classification
    return classify_intent_rules(cleaned_text)


def classify_intent_ml(text: str) -> Dict:
    """
    Classify intent using a fine-tuned ML model or zero-shot classification

    Args:
        text: Conversation text

    Returns:
        Dictionary with ML-based intent classification
    """
    try:
        # Use zero-shot classification if specific model not available
        classifier = get_intent_classifier()

        if classifier is None:
            return None

        # Define intent categories
        candidate_labels = list(INTENT_KEYWORDS.keys())

        # Classify
        result = classifier(text, candidate_labels, multi_label=True)

        if not result or not isinstance(result, dict):
            return None

        # Parse results
        labels = result.get("labels", [])
        scores = result.get("scores", [])

        if not labels or not scores:
            return None

        # Sort by score
        intent_scores = list(zip(labels, scores))
        intent_scores.sort(key=lambda x: x[1], reverse=True)

        primary_intent = intent_scores[0][0] if intent_scores else "unknown"
        confidence = float(intent_scores[0][1]) if intent_scores else 0.0

        all_intents = [
            {"intent": intent, "confidence": round(float(score), 3)}
            for intent, score in intent_scores[:5]  # Top 5
        ]

        return {
            "primary_intent": primary_intent,
            "confidence": round(confidence, 3),
            "all_intents": all_intents,
            "method": "ml_zero_shot"
        }

    except Exception as e:
        print(f"Error in ML intent classification: {str(e)}")
        return None


def classify_intent_rules(text: str) -> Dict:
    """
    Classify intent using keyword-based rules

    Args:
        text: Conversation text (lowercase)

    Returns:
        Dictionary with rule-based intent classification
    """
    intent_scores = {}

    # Score each intent based on keyword matches
    for intent, keywords in INTENT_KEYWORDS.items():
        score = 0.0
        matches = []

        for keyword in keywords:
            # Count occurrences
            count = text.count(keyword)
            if count > 0:
                # Weight by keyword importance (simple frequency)
                score += count * (1.0 if len(keyword.split()) == 1 else 1.5)  # Phrases weighted more
                matches.append(keyword)

        if score > 0:
            intent_scores[intent] = {
                "score": score,
                "matches": matches,
                "match_count": len(matches)
            }

    if not intent_scores:
        return {
            "primary_intent": "general",
            "confidence": 0.5,
            "all_intents": [],
            "method": "rule_based",
            "note": "No specific intent detected"
        }

    # Normalize scores (max score = 1.0)
    max_score = max(intent_scores.values(), key=lambda x: x["score"])["score"]

    for intent in intent_scores:
        intent_scores[intent]["normalized_score"] = intent_scores[intent]["score"] / max_score if max_score > 0 else 0

    # Sort by score
    sorted_intents = sorted(
        intent_scores.items(),
        key=lambda x: x[1]["normalized_score"],
        reverse=True
    )

    primary_intent = sorted_intents[0][0]
    confidence = sorted_intents[0][1]["normalized_score"]

    all_intents = [
        {
            "intent": intent,
            "confidence": round(data["normalized_score"], 3),
            "match_count": data["match_count"],
            "matched_keywords": data["matches"][:5]  # Top 5 keywords
        }
        for intent, data in sorted_intents[:5]
    ]

    return {
        "primary_intent": primary_intent,
        "confidence": round(confidence, 3),
        "all_intents": all_intents,
        "method": "rule_based",
        "matched_keywords": sorted_intents[0][1]["matches"][:10]
    }


def get_intent_classifier():
    """Get or initialize the intent classification pipeline"""
    global _intent_pipeline
    if _intent_pipeline is None:
        try:
            # Use zero-shot classification (no training needed)
            _intent_pipeline = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli"
            )
        except Exception as e:
            print(f"Warning: Failed to load intent classifier: {str(e)}")
            try:
                # Fallback to smaller model
                _intent_pipeline = pipeline(
                    "zero-shot-classification",
                    model="typeform/distilbert-base-uncased-mnli"
                )
            except Exception as e2:
                print(f"Warning: Failed to load fallback intent classifier: {str(e2)}")
                _intent_pipeline = None
    return _intent_pipeline


def analyze_intent_distribution(conversations: List[str]) -> Dict:
    """
    Analyze intent distribution across multiple conversations

    Args:
        conversations: List of conversation texts

    Returns:
        Dictionary with intent statistics
    """
    intent_counts = {}
    intent_confidences = {}

    for conv in conversations:
        if conv and len(conv.strip()) > 10:
            result = classify_intent(conv, use_ml=False)  # Use rule-based for speed
            intent = result.get("primary_intent", "unknown")
            confidence = result.get("confidence", 0.0)

            intent_counts[intent] = intent_counts.get(intent, 0) + 1

            if intent not in intent_confidences:
                intent_confidences[intent] = []
            intent_confidences[intent].append(confidence)

    # Calculate average confidence per intent
    avg_confidences = {
        intent: round(sum(confs) / len(confs), 3) if confs else 0.0
        for intent, confs in intent_confidences.items()
    }

    total = sum(intent_counts.values())
    percentages = {
        intent: round((count / total) * 100, 2) if total > 0 else 0.0
        for intent, count in intent_counts.items()
    }

    return {
        "intent_distribution": intent_counts,
        "intent_percentages": percentages,
        "average_confidence": avg_confidences,
        "total_conversations": total,
        "most_common_intent": max(intent_counts.items(), key=lambda x: x[1])[0] if intent_counts else "unknown"
    }

