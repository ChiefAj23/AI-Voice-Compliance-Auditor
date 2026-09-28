"""
Data retention: analyses and audit log entries older than the configured number of days are
deleted, by a daily job and on demand by an administrator. Every run that deletes something is
itself recorded in the audit log. Uploaded recordings are never kept: each is deleted as soon as
its analysis finishes (or fails), so retention only concerns what the database holds.
"""
from datetime import datetime, timedelta
from typing import Dict, Optional

from . import settings
from .database import AnalysisRecord, AuditLog

JOB_ID = "retention_purge"
_BATCH = 500
_last_run: Dict[str, object] = {}


def policy() -> Dict[str, object]:
    """What the deployment keeps, and for how long (0 days means until deleted)."""
    return {
        "pii_redaction": settings.PII_REDACTION,
        "redact_names": settings.PII_REDACT_NAMES,
        "retention_days": settings.RETENTION_DAYS,
        "audit_retention_days": settings.AUDIT_RETENTION_DAYS,
        "recordings_stored": False,
        "last_purge": dict(_last_run) or None,
    }


def purge_expired(db, now: Optional[datetime] = None, retention_days: Optional[int] = None,
                  audit_retention_days: Optional[int] = None) -> Dict[str, int]:
    """Delete analyses and audit log entries past their retention period; returns the counts."""
    now = now or datetime.utcnow()
    retention_days = settings.RETENTION_DAYS if retention_days is None else retention_days
    audit_retention_days = settings.AUDIT_RETENTION_DAYS if audit_retention_days is None else audit_retention_days
    deleted = {"analyses": 0, "audit_logs": 0}

    if retention_days > 0:
        cutoff = now - timedelta(days=retention_days)
        while True:
            # Deleting through the session also removes each record's comments and tag links.
            batch = db.query(AnalysisRecord).filter(AnalysisRecord.created_at < cutoff).limit(_BATCH).all()
            if not batch:
                break
            for record in batch:
                db.delete(record)
            db.commit()
            deleted["analyses"] += len(batch)

    if audit_retention_days > 0:
        cutoff = now - timedelta(days=audit_retention_days)
        deleted["audit_logs"] = (
            db.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete(synchronize_session=False)
        )
        db.commit()

    _last_run.clear()
    _last_run.update({"at": now.isoformat() + "Z", **deleted})
    return deleted


def run_scheduled() -> None:
    """The daily job: purge, and record what was removed."""
    from .audit import record
    from .database import SessionLocal

    db = SessionLocal()
    try:
        deleted = purge_expired(db)
        if deleted["analyses"] or deleted["audit_logs"]:
            record(db, action="retention.purge", username="system", resource_type="analysis_records",
                   details={**deleted, "retention_days": settings.RETENTION_DAYS,
                            "audit_retention_days": settings.AUDIT_RETENTION_DAYS})
    except Exception as e:  # pragma: no cover - a failed run is retried the next day
        print(f"retention: purge failed: {e}")
    finally:
        db.close()


def schedule(scheduler) -> bool:
    """Add the daily purge to an APScheduler scheduler when any retention period is set."""
    if not (settings.RETENTION_DAYS or settings.AUDIT_RETENTION_DAYS):
        return False
    scheduler.add_job(run_scheduled, "interval", hours=24, id=JOB_ID, replace_existing=True,
                      next_run_time=datetime.now() + timedelta(minutes=1))
    return True
