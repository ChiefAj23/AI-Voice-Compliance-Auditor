"""
Email Notification Service
Sends email alerts for compliance violations and critical issues
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
from sqlalchemy.orm import Session
from .database import NotificationConfig
import traceback


class EmailNotificationService:
    """Service for sending email notifications"""

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")

    def send_notifications(
        self,
        alert_data: Dict,
        analysis_data: Dict,
        db: Session
    ) -> List[Dict]:
        """
        Send email notifications based on alert conditions

        Args:
            alert_data: Alert information
            analysis_data: Full analysis data
            db: Database session

        Returns:
            List of notification send results
        """
        # Check if SMTP is configured
        if not self.smtp_user or not self.smtp_password:
            print("SMTP credentials not configured. Email notifications skipped.")
            return []

        # Get all active notification configs
        configs = db.query(NotificationConfig).filter(NotificationConfig.is_active == True).all()

        if not configs:
            return []

        results = []

        for config in configs:
            # Check if notification should be sent
            should_send = self._should_send_notification(config, alert_data, analysis_data)

            if should_send:
                # Check rate limit
                if not self._check_rate_limit(config):
                    results.append({
                        "config_id": config.id,
                        "config_name": config.name,
                        "success": False,
                        "skipped": True,
                        "reason": "Rate limit exceeded"
                    })
                    continue

                try:
                    result = self._send_email(config, alert_data, analysis_data)
                    results.append(result)

                    # Update config stats
                    config.last_sent = datetime.utcnow()
                    if result.get("success"):
                        config.sent_count += 1
                    db.commit()

                except Exception as e:
                    print(f"Error sending notification {config.id}: {str(e)}")
                    db.commit()
                    results.append({
                        "config_id": config.id,
                        "config_name": config.name,
                        "success": False,
                        "error": str(e)
                    })

        return results

    def _should_send_notification(
        self,
        config: NotificationConfig,
        alert_data: Dict,
        analysis_data: Dict
    ) -> bool:
        """Determine if notification should be sent based on conditions"""
        alerts = alert_data.get("alerts", {})
        has_alerts = alerts.get("has_alerts", False)

        # Check critical alerts
        if config.notify_on_critical and alerts.get("critical", 0) > 0:
            return True

        # Check warning alerts
        if config.notify_on_warning and alerts.get("warning", 0) > 0:
            return True

        # Check compliance score
        compliance_score = analysis_data.get("analysis", {}).get("compliance_score", 100.0)
        if config.notify_on_compliance_low:
            if config.min_compliance_score:
                if compliance_score < config.min_compliance_score:
                    return True
            elif compliance_score < 70.0:  # Default threshold
                return True

        # Check custom rule violations
        if config.notify_on_custom_rule:
            custom_rules = analysis_data.get("custom_compliance_rules", [])
            if custom_rules and len(custom_rules) > 0:
                if any(rule.get("matched", False) for rule in custom_rules):
                    return True

        return False

    def _check_rate_limit(self, config: NotificationConfig) -> bool:
        """Check if notification can be sent based on rate limit"""
        if not config.last_sent:
            return True

        time_since_last = datetime.utcnow() - config.last_sent
        minutes_since = time_since_last.total_seconds() / 60

        return minutes_since >= config.rate_limit_minutes

    def _send_email(
        self,
        config: NotificationConfig,
        alert_data: Dict,
        analysis_data: Dict
    ) -> Dict:
        """Send email notification"""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.smtp_user
            msg['To'] = ", ".join(config.email_recipients)

            # Prepare subject
            subject = config.email_subject_template or "Compliance Alert - Voice Audit"
            subject = self._replace_placeholders(subject, alert_data, analysis_data)
            msg['Subject'] = subject

            # Prepare body
            body = config.email_body_template or self._get_default_email_template()
            body = self._replace_placeholders(body, alert_data, analysis_data)
            msg.attach(MIMEText(body, 'html'))

            # Send email
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            text = msg.as_string()
            server.sendmail(self.smtp_user, config.email_recipients, text)
            server.quit()

            return {
                "config_id": config.id,
                "config_name": config.name,
                "success": True,
                "recipients": config.email_recipients,
                "timestamp": datetime.utcnow().isoformat()
            }

        except smtplib.SMTPAuthenticationError as e:
            error_msg = str(e)
            if "535" in error_msg or "Username and Password not accepted" in error_msg:
                detailed_error = (
                    "Gmail authentication failed. You must use an App Password instead of your regular password. "
                    "See EMAIL_SETUP_GUIDE.md for instructions on creating a Gmail App Password."
                )
            else:
                detailed_error = f"SMTP authentication error: {error_msg}"
            print(f"Error sending email notification: {detailed_error}")
            return {
                "config_id": config.id,
                "config_name": config.name,
                "success": False,
                "error": detailed_error,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            error_msg = str(e)
            print(f"Error sending email notification: {error_msg}")
            traceback.print_exc()
            return {
                "config_id": config.id,
                "config_name": config.name,
                "success": False,
                "error": error_msg,
                "timestamp": datetime.utcnow().isoformat()
            }

    def _replace_placeholders(self, template: str, alert_data: Dict, analysis_data: Dict) -> str:
        """Replace placeholders in email template"""
        analysis = analysis_data.get("analysis", {})
        alerts = alert_data.get("alerts", {})

        replacements = {
            "{{compliance_score}}": str(analysis.get("compliance_score", "N/A")),
            "{{toxicity_score}}": str(analysis.get("toxicity_score", "N/A")),
            "{{sentiment}}": str(analysis.get("sentiment", "N/A")),
            "{{emotion}}": str(analysis.get("emotion", "N/A")),
            "{{total_alerts}}": str(alerts.get("total", 0)),
            "{{critical_alerts}}": str(alerts.get("critical", 0)),
            "{{warning_alerts}}": str(alerts.get("warning", 0)),
            "{{timestamp}}": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "{{filename}}": analysis_data.get("filename", "N/A")
        }

        result = template
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, value)

        return result

    def _get_default_email_template(self) -> str:
        """Get default HTML email template"""
        return """
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #d32f2f;">⚠️ Compliance Alert</h2>
            <p>A compliance violation has been detected in the voice audit system.</p>

            <h3>Analysis Summary</h3>
            <ul>
                <li><strong>Compliance Score:</strong> {{compliance_score}}</li>
                <li><strong>Toxicity Score:</strong> {{toxicity_score}}</li>
                <li><strong>Sentiment:</strong> {{sentiment}}</li>
                <li><strong>Emotion:</strong> {{emotion}}</li>
            </ul>

            <h3>Alerts</h3>
            <ul>
                <li><strong>Total Alerts:</strong> {{total_alerts}}</li>
                <li><strong>Critical:</strong> {{critical_alerts}}</li>
                <li><strong>Warnings:</strong> {{warning_alerts}}</li>
            </ul>

            <p><strong>Timestamp:</strong> {{timestamp}}</p>

            <p>Please review the analysis in the Voice Audit system.</p>

            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated message from AI Voice Compliance Auditor</p>
        </body>
        </html>
        """

    def test_notification(self, config: NotificationConfig) -> Dict:
        """Test notification with sample data"""
        test_alert_data = {
            "alerts": {
                "total": 1,
                "critical": 1,
                "warning": 0,
                "has_alerts": True
            }
        }

        test_analysis_data = {
            "filename": "test_audio.wav",
            "analysis": {
                "compliance_score": 65.0,
                "toxicity_score": 0.3,
                "sentiment": "NEGATIVE",
                "emotion": "anger"
            }
        }

        return self._send_email(config, test_alert_data, test_analysis_data)


# Global service instance
_email_service = None

def get_email_service() -> EmailNotificationService:
    """Get or create the global email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailNotificationService()
    return _email_service

