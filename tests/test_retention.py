"""Retention: what is deleted, who may trigger it, and what the audit log says."""
from datetime import datetime, timedelta

from api import retention, settings
from api.alert_system import check_compliance_alerts
from api.database import AnalysisRecord, AuditLog, Comment, SessionLocal, User


def _record(db, age_days, name):
    record = AnalysisRecord(filename=name, transcription="hello", created_at=datetime.utcnow() - timedelta(days=age_days))
    db.add(record)
    db.commit()
    return record.id


def test_old_analyses_and_their_comments_are_deleted(client, admin_headers):
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        old_id, new_id = _record(db, 40, "old.wav"), _record(db, 5, "new.wav")
        db.add(Comment(analysis_id=old_id, user_id=admin.id, content="note on an old call"))
        db.commit()

        deleted = retention.purge_expired(db, retention_days=30, audit_retention_days=0)

        assert deleted["analyses"] >= 1
        assert db.get(AnalysisRecord, old_id) is None
        assert db.get(AnalysisRecord, new_id) is not None
        assert db.query(Comment).filter(Comment.analysis_id == old_id).count() == 0
        db.query(AnalysisRecord).filter(AnalysisRecord.id == new_id).delete()
        db.commit()
    finally:
        db.close()


def test_old_audit_entries_are_deleted(client):
    db = SessionLocal()
    try:
        old = AuditLog(timestamp=datetime.utcnow() - timedelta(days=400), action="test.old", status="success")
        new = AuditLog(timestamp=datetime.utcnow(), action="test.new", status="success")
        db.add_all([old, new])
        db.commit()
        old_id, new_id = old.id, new.id

        deleted = retention.purge_expired(db, retention_days=0, audit_retention_days=365)

        assert deleted["audit_logs"] >= 1 and deleted["analyses"] == 0
        assert db.get(AuditLog, old_id) is None and db.get(AuditLog, new_id) is not None
    finally:
        db.close()


def test_nothing_is_deleted_without_a_retention_period(client):
    db = SessionLocal()
    try:
        record_id = _record(db, 3650, "ancient.wav")
        assert retention.purge_expired(db, retention_days=0, audit_retention_days=0) == {"analyses": 0, "audit_logs": 0}
        assert db.get(AnalysisRecord, record_id) is not None
        db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).delete()
        db.commit()
    finally:
        db.close()


def test_the_policy_is_readable_but_only_admins_purge(client, admin_headers, viewer_headers, monkeypatch):
    policy = client.get("/api/privacy", headers=viewer_headers)
    assert policy.status_code == 200
    assert policy.json()["pii_redaction"] is True and policy.json()["recordings_stored"] is False
    assert client.post("/api/privacy/purge", headers=viewer_headers).status_code == 403

    # Off by default: an admin asking for a purge is told why nothing happens.
    refused = client.post("/api/privacy/purge", headers=admin_headers)
    assert refused.status_code == 400 and "RETENTION_DAYS" in refused.json()["detail"]

    monkeypatch.setattr(settings, "RETENTION_DAYS", 30)
    db = SessionLocal()
    try:
        _record(db, 45, "expired.wav")
    finally:
        db.close()
    done = client.post("/api/privacy/purge", headers=admin_headers)
    assert done.status_code == 200, done.text
    assert done.json()["deleted"]["analyses"] >= 1
    logs = client.get("/api/audit-logs", params={"action": "retention.purge"}, headers=admin_headers).json()
    assert logs["total"] == 1 and logs["records"][0]["username"] == "admin"
    assert logs["records"][0]["details"]["analyses"] >= 1


def test_the_daily_job_is_scheduled_only_when_retention_is_set(monkeypatch):
    class FakeScheduler:
        def __init__(self):
            self.jobs = []

        def add_job(self, func, trigger, **kwargs):
            self.jobs.append((func, trigger, kwargs))

    scheduler = FakeScheduler()
    monkeypatch.setattr(settings, "RETENTION_DAYS", 0)
    monkeypatch.setattr(settings, "AUDIT_RETENTION_DAYS", 0)
    assert retention.schedule(scheduler) is False and scheduler.jobs == []
    monkeypatch.setattr(settings, "AUDIT_RETENTION_DAYS", 365)
    assert retention.schedule(scheduler) is True
    func, trigger, kwargs = scheduler.jobs[0]
    assert func is retention.run_scheduled and trigger == "interval" and kwargs["hours"] == 24
    assert kwargs["id"] == retention.JOB_ID and kwargs["replace_existing"] is True


def test_spoken_card_details_raise_an_alert():
    analysis = {
        "compliance_score": 95.0, "toxicity_score": 0.0, "sentiment": "POSITIVE", "emotion": "joy",
        "pii": {"redacted": True, "counts": {"card_number": 1, "cvv": 1, "email": 1}, "sensitive": ["card_number", "cvv"]},
    }
    alerts = [alert for alert in check_compliance_alerts(analysis) if alert.metric == "pii"]
    assert len(alerts) == 1 and alerts[0].value == 2.0 and "card number" in alerts[0].message
    analysis["pii"] = {"redacted": True, "counts": {"email": 1}, "sensitive": []}
    assert not [alert for alert in check_compliance_alerts(analysis) if alert.metric == "pii"]
