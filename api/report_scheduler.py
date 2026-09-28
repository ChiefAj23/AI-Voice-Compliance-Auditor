"""
Automated Report Scheduling Module
Handles scheduled report generation and email delivery
"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from pathlib import Path
from sqlalchemy.orm import Session
from .database import ScheduledReport, AnalysisRecord
from .report import generate_compliance_pdf
import traceback


class ReportScheduler:
    """Manages scheduled report generation and email delivery"""

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self.job_ids = {}  # Map schedule ID to job ID

    def add_schedule(self, schedule: ScheduledReport, db: Session):
        """Add a scheduled report job"""
        job_id = f"report_schedule_{schedule.id}"

        try:
            # Remove existing job if any
            if job_id in self.job_ids:
                self.remove_schedule(schedule.id)

            # Create trigger based on schedule type
            trigger = self._create_trigger(schedule)
            if not trigger:
                print(f"Failed to create trigger for schedule {schedule.id}")
                return False

            # Add job to scheduler
            self.scheduler.add_job(
                func=self._generate_and_send_report,
                trigger=trigger,
                args=[schedule.id],
                id=job_id,
                name=f"Report: {schedule.name}",
                replace_existing=True
            )

            self.job_ids[schedule.id] = job_id

            # Calculate next run time
            next_run = self.scheduler.get_job(job_id).next_run_time if self.scheduler.get_job(job_id) else None
            if next_run:
                schedule.next_run = next_run
                db.commit()

            return True
        except Exception as e:
            print(f"Error adding schedule {schedule.id}: {str(e)}")
            traceback.print_exc()
            return False

    def remove_schedule(self, schedule_id: int):
        """Remove a scheduled report job"""
        job_id = f"report_schedule_{schedule_id}"
        try:
            if job_id in self.scheduler.get_jobs():
                self.scheduler.remove_job(job_id)
            if schedule_id in self.job_ids:
                del self.job_ids[schedule_id]
            return True
        except Exception as e:
            print(f"Error removing schedule {schedule_id}: {str(e)}")
            return False

    def _create_trigger(self, schedule: ScheduledReport):
        """Create APScheduler trigger from schedule configuration"""
        config = schedule.schedule_config or {}

        if schedule.schedule_type == "daily":
            hour = config.get("hour", 9)
            minute = config.get("minute", 0)
            return CronTrigger(hour=hour, minute=minute, timezone=schedule.timezone)

        elif schedule.schedule_type == "weekly":
            day_of_week = config.get("day_of_week", 0)  # Monday = 0
            hour = config.get("hour", 9)
            minute = config.get("minute", 0)
            return CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute, timezone=schedule.timezone)

        elif schedule.schedule_type == "monthly":
            day = config.get("day", 1)  # Day of month
            hour = config.get("hour", 9)
            minute = config.get("minute", 0)
            return CronTrigger(day=day, hour=hour, minute=minute, timezone=schedule.timezone)

        elif schedule.schedule_type == "custom":
            # Custom cron expression
            cron_expr = config.get("cron_expression")
            if cron_expr:
                try:
                    # Parse cron expression: "minute hour day month day_of_week"
                    parts = cron_expr.split()
                    if len(parts) == 5:
                        return CronTrigger(
                            minute=parts[0],
                            hour=parts[1],
                            day=parts[2],
                            month=parts[3],
                            day_of_week=parts[4],
                            timezone=schedule.timezone
                        )
                except Exception as e:
                    print(f"Invalid cron expression: {cron_expr}, error: {str(e)}")

        return None

    def _generate_and_send_report(self, schedule_id: int):
        """Generate report and send via email (called by scheduler)"""
        # Get database session
        from .database import SessionLocal
        db = SessionLocal()

        try:
            schedule = db.query(ScheduledReport).filter(ScheduledReport.id == schedule_id).first()
            if not schedule or not schedule.is_active:
                print(f"Schedule {schedule_id} not found or inactive")
                return

            # Generate report data based on filters
            report_data = self._collect_report_data(schedule, db)

            if not report_data:
                print(f"No data found for schedule {schedule_id}")
                schedule.last_run = datetime.utcnow()
                schedule.run_count += 1
                db.commit()
                return

            # Generate PDF report
            output_dir = Path("data/reports")
            output_dir.mkdir(parents=True, exist_ok=True)
            pdf_filename = f"report_{schedule.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            pdf_path = output_dir / pdf_filename

            generate_compliance_pdf(report_data, output_path=str(pdf_path))

            # Send email
            if schedule.email_recipients:
                self._send_email(schedule, str(pdf_path), report_data)

            # Update schedule
            schedule.last_run = datetime.utcnow()
            schedule.run_count += 1
            next_run = self.scheduler.get_job(f"report_schedule_{schedule_id}")
            if next_run:
                schedule.next_run = next_run.next_run_time
            db.commit()

            # Clean up old PDF (optional - keep for a week)
            self._cleanup_old_reports(output_dir)

        except Exception as e:
            print(f"Error generating report for schedule {schedule_id}: {str(e)}")
            traceback.print_exc()
        finally:
            db.close()

    def _collect_report_data(self, schedule: ScheduledReport, db: Session) -> Optional[Dict]:
        """Collect data for report based on schedule filters"""
        filters = schedule.filters or {}

        # Build query
        query = db.query(AnalysisRecord)

        # Apply date filters
        if filters.get("start_date"):
            start_date = datetime.fromisoformat(filters["start_date"])
            query = query.filter(AnalysisRecord.created_at >= start_date)

        if filters.get("end_date"):
            end_date = datetime.fromisoformat(filters["end_date"])
            query = query.filter(AnalysisRecord.created_at <= end_date)
        else:
            # Default: last 30 days if no end date
            default_end = datetime.utcnow()
            if not filters.get("start_date"):
                default_start = default_end - timedelta(days=30)
                query = query.filter(AnalysisRecord.created_at >= default_start)
            query = query.filter(AnalysisRecord.created_at <= default_end)

        # Apply score filters
        if filters.get("min_score") is not None:
            query = query.filter(AnalysisRecord.compliance_score >= filters["min_score"])

        if filters.get("max_score") is not None:
            query = query.filter(AnalysisRecord.compliance_score <= filters["max_score"])

        # Get records
        records = query.order_by(AnalysisRecord.created_at.desc()).all()

        if not records:
            return None

        # Aggregate data for summary report
        if schedule.report_type == "summary":
            return self._create_summary_report(records)
        else:
            # Return first record for detailed report
            record = records[0]
            return {
                "filename": record.filename or "N/A",
                "analysis": record.full_analysis or {
                    "sentiment": record.sentiment,
                    "emotion": record.emotion,
                    "toxicity_score": record.toxicity_score,
                    "compliance_score": record.compliance_score
                },
                "explanation": record.explanation or [],
                "duration": record.file_duration
            }

    def _create_summary_report(self, records: List[AnalysisRecord]) -> Dict:
        """Create aggregated summary report from multiple records"""
        total = len(records)

        # Calculate averages
        avg_compliance = sum(r.compliance_score or 0 for r in records) / total if total > 0 else 0
        avg_toxicity = sum((r.full_analysis or {}).get("toxicity_score", 0) or 0 for r in records) / total if total > 0 else 0

        # Count by sentiment
        sentiment_counts = {}
        for record in records:
            sentiment = record.sentiment or "UNKNOWN"
            sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1

        # Count by emotion
        emotion_counts = {}
        for record in records:
            emotion = record.emotion or "unknown"
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

        # Get date range
        dates = [r.created_at for r in records if r.created_at]
        date_range = f"{min(dates).strftime('%Y-%m-%d')} to {max(dates).strftime('%Y-%m-%d')}" if dates else "N/A"

        return {
            "filename": f"Summary Report ({date_range})",
            "analysis": {
                "compliance_score": avg_compliance,
                "toxicity_score": avg_toxicity,
                "total_analyses": total,
                "sentiment_distribution": sentiment_counts,
                "emotion_distribution": emotion_counts
            },
            "explanation": [],
            "duration": sum(r.file_duration or 0 for r in records),
            "date_range": date_range,
            "total_records": total
        }

    def _send_email(self, schedule: ScheduledReport, pdf_path: str, report_data: Dict):
        """Send email with report attachment"""
        try:
            # Get SMTP configuration from environment variables
            smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_password = os.getenv("SMTP_PASSWORD", "")

            if not smtp_user or not smtp_password:
                print("SMTP credentials not configured. Email sending skipped.")
                return

            # Create message
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = ", ".join(schedule.email_recipients)
            msg['Subject'] = schedule.email_subject or f"Automated Compliance Report: {schedule.name}"

            # Email body
            body = schedule.email_body_template or f"""
            Hello,

            Please find attached the automated compliance report: {schedule.name}

            Report Period: {report_data.get('date_range', 'N/A')}
            Total Records: {report_data.get('total_records', report_data.get('analysis', {}).get('total_analyses', 'N/A'))}

            Best regards,
            AI Voice Compliance Auditor
            """
            msg.attach(MIMEText(body, 'plain'))

            # Attach PDF
            with open(pdf_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())

            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {Path(pdf_path).name}',
            )
            msg.attach(part)

            # Send email
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_password)
            text = msg.as_string()
            server.sendmail(smtp_user, schedule.email_recipients, text)
            server.quit()

            print(f"Email sent successfully for schedule {schedule.id}")

        except smtplib.SMTPAuthenticationError as e:
            error_msg = str(e)
            if "535" in error_msg or "Username and Password not accepted" in error_msg:
                detailed_error = (
                    "Gmail authentication failed. You must use an App Password instead of your regular password. "
                    "See EMAIL_SETUP_GUIDE.md for instructions. "
                    f"Schedule {schedule.id} email sending skipped."
                )
            else:
                detailed_error = f"SMTP authentication error: {error_msg}"
            print(f"Error sending email for schedule {schedule.id}: {detailed_error}")
        except Exception as e:
            error_msg = str(e)
            print(f"Error sending email for schedule {schedule.id}: {str(e)}")
            traceback.print_exc()

    def _cleanup_old_reports(self, reports_dir: Path, days_to_keep: int = 7):
        """Clean up report files older than specified days"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            for report_file in reports_dir.glob("report_*.pdf"):
                if report_file.stat().st_mtime < cutoff_date.timestamp():
                    report_file.unlink()
        except Exception as e:
            print(f"Error cleaning up old reports: {str(e)}")

    def reload_all_schedules(self, db: Session):
        """Reload all active schedules (called on startup)"""
        schedules = db.query(ScheduledReport).filter(ScheduledReport.is_active == True).all()
        for schedule in schedules:
            self.add_schedule(schedule, db)
        print(f"Loaded {len(schedules)} active scheduled reports")

    def shutdown(self):
        """Shutdown the scheduler"""
        self.scheduler.shutdown()


# Global scheduler instance
_report_scheduler = None

def get_scheduler() -> ReportScheduler:
    """Get or create the global scheduler instance"""
    global _report_scheduler
    if _report_scheduler is None:
        _report_scheduler = ReportScheduler()
    return _report_scheduler

