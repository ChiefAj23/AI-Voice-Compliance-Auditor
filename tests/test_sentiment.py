"""Sentiment labels: the model's raw class names must never stop sentiment from counting."""
from types import SimpleNamespace

import pytest

from api.alert_system import AlertThresholds, check_compliance_alerts
from api.compliance_rules import ComplianceRuleEngine
from api.labels import SENTIMENT_LABELS, SENTIMENT_WEIGHTS, normalize_sentiment


@pytest.mark.parametrize("label, expected", [
    ("LABEL_0", "NEGATIVE"), ("LABEL_1", "NEUTRAL"), ("LABEL_2", "POSITIVE"),
    ("label_0", "NEGATIVE"), ("negative", "NEGATIVE"), ("Positive", "POSITIVE"), (" NEUTRAL ", "NEUTRAL"),
    ("mixed", "MIXED"), (None, None), ("", ""),
])
def test_labels_are_normalized(label, expected):
    assert normalize_sentiment(label) == expected


def test_every_label_has_a_weight():
    assert set(SENTIMENT_WEIGHTS) == set(SENTIMENT_LABELS)
    assert SENTIMENT_WEIGHTS["NEGATIVE"] < SENTIMENT_WEIGHTS["NEUTRAL"] < SENTIMENT_WEIGHTS["POSITIVE"]


def test_negative_sentiment_raises_an_alert_whatever_the_label():
    for label in ("NEGATIVE", "LABEL_0"):
        alerts = check_compliance_alerts({"sentiment": label, "compliance_score": 95.0, "toxicity_score": 0.0})
        assert any(alert.metric == "sentiment" for alert in alerts), label
    alerts = check_compliance_alerts({"sentiment": "LABEL_1", "compliance_score": 95.0, "toxicity_score": 0.0},
                                     AlertThresholds())
    assert not any(alert.metric == "sentiment" for alert in alerts)


@pytest.mark.parametrize("pattern, sentiment, matched", [
    ("negative", "NEGATIVE", True),
    ("NEGATIVE", "LABEL_0", True),
    ("LABEL_0", "NEGATIVE", True),
    ("negative", "LABEL_2", False),
])
def test_sentiment_rules_match_either_spelling(pattern, sentiment, matched):
    rule = SimpleNamespace(pattern=pattern, condition="equals")
    result, _, _ = ComplianceRuleEngine(db=None)._evaluate_sentiment(rule, {"sentiment": sentiment})
    assert result is matched


def test_stored_raw_labels_are_migrated(client):
    from api import database

    db = database.SessionLocal()
    try:
        record = database.AnalysisRecord(
            filename="old.wav", transcription="hello", sentiment="LABEL_0",
            full_analysis={"sentiment": "LABEL_0", "compliance_score": 60.0},
        )
        db.add(record)
        db.commit()
        record_id = record.id
    finally:
        db.close()

    database.init_db()

    db = database.SessionLocal()
    try:
        stored = db.get(database.AnalysisRecord, record_id)
        assert stored.sentiment == "NEGATIVE"  # the column is rewritten
        assert stored.to_dict()["analysis"]["sentiment"] == "NEGATIVE"  # the JSON copy is read as words
        db.query(database.AnalysisRecord).filter(database.AnalysisRecord.id == record_id).delete()
        db.commit()
    finally:
        db.close()
