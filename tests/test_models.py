"""
Smoke tests for the models behind an analysis. They download and load several hundred megabytes
of models, so the default run and CI skip them. Run them after changing model code or upgrading
torch, transformers, shap or detoxify:

    RUN_MODEL_TESTS=1 pytest tests/test_models.py
"""
import os

import pytest

pytestmark = pytest.mark.skipif(not os.getenv("RUN_MODEL_TESTS"), reason="set RUN_MODEL_TESTS=1 to load the models")

CALL = (
    "Thanks for calling, this call may be recorded for quality. I can see the charge on your account "
    "and I understand you are frustrated. I have issued a refund today and you will see it within five "
    "business days. Is there anything else I can help you with before we finish the call today?"
)


def test_whole_call_is_scored():
    from api.model import analyze_text

    result = analyze_text(CALL)
    assert 0 <= result["compliance_score"] <= 100
    assert result["sentiment"] and result["emotion"]
    assert 0 <= result["toxicity_score"] <= 1


def test_toxicity_is_explained_token_by_token():
    from api.explain import explain_toxicity

    tokens = explain_toxicity(CALL)
    assert tokens
    assert all(isinstance(token, str) and -1.0 <= value <= 1.0 for token, value in tokens)


def test_comprehensive_explanation():
    from api.explain_enhanced import comprehensive_explanation
    from api.model import analyze_text

    explanation = comprehensive_explanation(CALL, analyze_text(CALL))
    assert {"toxicity", "sentiment", "emotion", "compliance"} <= set(explanation)


def test_timeline_segments_use_the_models():
    from api.sentiment_timeline import analyze_segment_emotion, analyze_segment_sentiment

    # The defaults for a failed model are confidence 0.5; a loaded model reports its own.
    assert analyze_segment_sentiment(CALL)["confidence"] != 0.5
    assert analyze_segment_emotion(CALL)["confidence"] != 0.5


def test_summary_comes_from_a_model_not_the_fallback():
    from api.summarization import summarize_conversation

    result = summarize_conversation(CALL * 2)
    assert result["model"] in ("bart-large-cnn", "distilbart-cnn-12-6"), result


def test_intent_is_classified():
    from api.intent_classification import get_intent_classifier

    classifier = get_intent_classifier()
    assert classifier is not None
    result = classifier(CALL, candidate_labels=["refund request", "technical support", "sales inquiry"])
    assert result["labels"][0] == "refund request"
