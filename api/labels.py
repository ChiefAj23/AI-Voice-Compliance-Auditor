"""
Sentiment labels, in one place.

The sentiment model (cardiffnlp/twitter-roberta-base-sentiment) names its classes LABEL_0, LABEL_1
and LABEL_2: negative, neutral and positive. The rest of the app (the compliance score, the
timeline, alerts, rules and stored records) uses the words. The model is relabelled when it loads
(api/model.py), and labels from anywhere else go through normalize_sentiment().

This module has no dependencies, so it is safe to import from anywhere, the database included.
"""
from typing import Optional

SENTIMENT_LABELS = ("NEGATIVE", "NEUTRAL", "POSITIVE")  # in the model's class order
RAW_SENTIMENT_LABELS = {f"LABEL_{index}": label for index, label in enumerate(SENTIMENT_LABELS)}

# How much each sentiment weighs on a compliance score (1.0 leaves it unchanged).
SENTIMENT_WEIGHTS = {"NEGATIVE": 0.6, "NEUTRAL": 0.9, "POSITIVE": 1.0}


def normalize_sentiment(label: Optional[str]) -> Optional[str]:
    """'LABEL_0', 'negative' or 'Negative' -> 'NEGATIVE'. Unknown labels come back upper-cased."""
    if not label:
        return label
    value = str(label).strip().upper()
    return RAW_SENTIMENT_LABELS.get(value, value)
