"""
Webhook Integration Service
Sends alerts and analyses to external systems via HTTP webhooks
"""
from typing import Dict, List, Optional, Any
import requests
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .database import Webhook
import json
import traceback


class WebhookService:
    """Service for managing and triggering webhooks"""

    def __init__(self):
        self.timeout = 10  # 10 second timeout for webhook requests

    def trigger_webhooks(
        self,
        alert_data: Dict,
        analysis_data: Dict,
        db: Session
    ) -> List[Dict]:
        """
        Trigger all active webhooks based on alert conditions

        Args:
            alert_data: Alert information (alerts, compliance score, etc.)
            analysis_data: Full analysis data
            db: Database session

        Returns:
            List of webhook trigger results
        """
        # Get all active webhooks
        webhooks = db.query(Webhook).filter(Webhook.is_active == True).all()

        if not webhooks:
            return []

        results = []

        for webhook in webhooks:
            # Check if webhook should be triggered
            should_trigger = self._should_trigger_webhook(webhook, alert_data, analysis_data)

            if should_trigger:
                try:
                    result = self._send_webhook(webhook, alert_data, analysis_data)
                    results.append(result)

                    # Update webhook stats
                    webhook.last_triggered = datetime.utcnow()
                    if result["success"]:
                        webhook.success_count += 1
                    else:
                        webhook.failure_count += 1
                    db.commit()

                except Exception as e:
                    print(f"Error triggering webhook {webhook.id}: {str(e)}")
                    webhook.failure_count += 1
                    db.commit()
                    results.append({
                        "webhook_id": webhook.id,
                        "webhook_name": webhook.name,
                        "success": False,
                        "error": str(e)
                    })

        return results

    def _should_trigger_webhook(
        self,
        webhook: Webhook,
        alert_data: Dict,
        analysis_data: Dict
    ) -> bool:
        """Determine if webhook should be triggered based on conditions"""
        alerts = alert_data.get("alerts", {})
        has_alerts = alerts.get("has_alerts", False)

        # Check critical alerts
        if webhook.trigger_on_critical and alerts.get("critical", 0) > 0:
            return True

        # Check warning alerts
        if webhook.trigger_on_warning and alerts.get("warning", 0) > 0:
            return True

        # Check compliance score
        compliance_score = analysis_data.get("analysis", {}).get("compliance_score", 100.0)
        if webhook.trigger_on_compliance_low:
            if webhook.min_compliance_score:
                if compliance_score < webhook.min_compliance_score:
                    return True
            elif compliance_score < 70.0:  # Default threshold
                return True

        # Check custom rule violations
        if webhook.trigger_on_custom_rule:
            custom_rules = analysis_data.get("custom_compliance_rules", [])
            if custom_rules and len(custom_rules) > 0:
                # Check if any rule matched
                if any(rule.get("matched", False) for rule in custom_rules):
                    return True

        return False

    def _send_webhook(
        self,
        webhook: Webhook,
        alert_data: Dict,
        analysis_data: Dict
    ) -> Dict:
        """Send webhook payload to external system"""
        try:
            # Prepare payload
            payload = self._prepare_payload(webhook, alert_data, analysis_data)

            # Prepare headers
            headers = self._prepare_headers(webhook)

            # Prepare auth
            auth = self._prepare_auth(webhook)

            # Send request
            method = webhook.method.upper()
            url = webhook.url

            if method == "GET":
                response = requests.get(
                    url,
                    params=payload,
                    headers=headers,
                    auth=auth,
                    timeout=self.timeout
                )
            elif method == "POST":
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    auth=auth,
                    timeout=self.timeout
                )
            elif method == "PUT":
                response = requests.put(
                    url,
                    json=payload,
                    headers=headers,
                    auth=auth,
                    timeout=self.timeout
                )
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Check response
            success = response.status_code >= 200 and response.status_code < 300

            return {
                "webhook_id": webhook.id,
                "webhook_name": webhook.name,
                "success": success,
                "status_code": response.status_code,
                "response": response.text[:500] if success else response.text,
                "timestamp": datetime.utcnow().isoformat()
            }

        except requests.exceptions.Timeout:
            return {
                "webhook_id": webhook.id,
                "webhook_name": webhook.name,
                "success": False,
                "error": "Request timeout",
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "webhook_id": webhook.id,
                "webhook_name": webhook.name,
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    def _prepare_payload(
        self,
        webhook: Webhook,
        alert_data: Dict,
        analysis_data: Dict
    ) -> Dict:
        """Prepare webhook payload"""
        # Use custom template if provided
        if webhook.payload_template:
            payload = webhook.payload_template.copy()
            # Replace placeholders
            payload_str = json.dumps(payload)
            payload_str = payload_str.replace("{{compliance_score}}", str(
                analysis_data.get("analysis", {}).get("compliance_score", 0)
            ))
            payload_str = payload_str.replace("{{alerts_count}}", str(
                alert_data.get("alerts", {}).get("total", 0)
            ))
            payload = json.loads(payload_str)
        else:
            # Default payload structure
            payload = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": "compliance_alert",
                "compliance_score": analysis_data.get("analysis", {}).get("compliance_score", 0),
                "alerts": {
                    "total": alert_data.get("alerts", {}).get("total", 0),
                    "critical": alert_data.get("alerts", {}).get("critical", 0),
                    "warning": alert_data.get("alerts", {}).get("warning", 0),
                    "has_alerts": alert_data.get("alerts", {}).get("has_alerts", False)
                }
            }

            # Add transcription if configured
            if webhook.include_transcription:
                payload["transcription"] = analysis_data.get("transcription", "")

            # Add analysis data if configured
            if webhook.include_analysis:
                payload["analysis"] = {
                    "sentiment": analysis_data.get("analysis", {}).get("sentiment"),
                    "emotion": analysis_data.get("analysis", {}).get("emotion"),
                    "toxicity_score": analysis_data.get("analysis", {}).get("toxicity_score"),
                    "compliance_score": analysis_data.get("analysis", {}).get("compliance_score")
                }

                # Add custom rule violations
                custom_rules = analysis_data.get("custom_compliance_rules", [])
                if custom_rules:
                    payload["custom_rule_violations"] = [
                        {
                            "rule_name": rule.get("rule_name"),
                            "severity": rule.get("severity"),
                            "message": rule.get("message")
                        }
                        for rule in custom_rules
                    ]

        return payload

    def _prepare_headers(self, webhook: Webhook) -> Dict:
        """Prepare HTTP headers for webhook request"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "VoiceComplianceAuditor/1.0"
        }

        # Add bearer token if auth type is bearer
        if webhook.auth_type == "bearer" and webhook.auth_config:
            token = webhook.auth_config.get("token")
            if token:
                headers["Authorization"] = f"Bearer {token}"

        # Add custom headers
        if webhook.headers:
            headers.update(webhook.headers)

        return headers

    def _prepare_auth(self, webhook: Webhook) -> Optional[Any]:
        """Prepare authentication for webhook request"""
        if webhook.auth_type == "bearer":
            token = webhook.auth_config.get("token") if webhook.auth_config else None
            if token:
                return None  # Bearer token goes in headers
            return None

        elif webhook.auth_type == "basic":
            if webhook.auth_config:
                username = webhook.auth_config.get("username")
                password = webhook.auth_config.get("password")
                if username and password:
                    from requests.auth import HTTPBasicAuth
                    return HTTPBasicAuth(username, password)

        return None

    def test_webhook(self, webhook: Webhook) -> Dict:
        """Test webhook with sample payload"""
        test_alert_data = {
            "alerts": {
                "total": 1,
                "critical": 1,
                "warning": 0,
                "has_alerts": True
            }
        }

        test_analysis_data = {
            "transcription": "Test transcription",
            "analysis": {
                "compliance_score": 65.0,
                "sentiment": "NEUTRAL",
                "emotion": "neutral",
                "toxicity_score": 0.1
            }
        }

        return self._send_webhook(webhook, test_alert_data, test_analysis_data)

