"""
Alert System Module
Monitors compliance scores and triggers alerts when thresholds are breached
"""
from typing import Dict, List, Optional
from datetime import datetime


class Alert:
    """Alert class for compliance violations"""
    def __init__(self, level: str, message: str, metric: str, value: float, threshold: float):
        self.level = level  # "critical", "warning", "info"
        self.message = message
        self.metric = metric
        self.value = value
        self.threshold = threshold
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict:
        return {
            "level": self.level,
            "message": self.message,
            "metric": self.metric,
            "value": self.value,
            "threshold": self.threshold,
            "timestamp": self.timestamp.isoformat()
        }


class AlertThresholds:
    """Default threshold configuration"""
    def __init__(self):
        self.compliance_critical = 50.0  # Below this = critical
        self.compliance_warning = 70.0   # Below this = warning
        self.toxicity_critical = 0.7     # Above this = critical
        self.toxicity_warning = 0.5      # Above this = warning
        self.sentiment_negative = True   # Alert on negative sentiment
        self.emotion_negative = ["anger", "fear", "disgust", "sadness"]
        self.keyword_count_warning = 5   # Alert if too many keywords
        self.keyword_count_critical = 10

    def to_dict(self) -> Dict:
        return {
            "compliance_critical": self.compliance_critical,
            "compliance_warning": self.compliance_warning,
            "toxicity_critical": self.toxicity_critical,
            "toxicity_warning": self.toxicity_warning,
            "sentiment_negative": self.sentiment_negative,
            "emotion_negative": self.emotion_negative,
            "keyword_count_warning": self.keyword_count_warning,
            "keyword_count_critical": self.keyword_count_critical
        }

    @classmethod
    def from_dict(cls, config: Dict) -> 'AlertThresholds':
        """Create AlertThresholds from dictionary"""
        thresholds = cls()
        if "compliance_critical" in config:
            thresholds.compliance_critical = config["compliance_critical"]
        if "compliance_warning" in config:
            thresholds.compliance_warning = config["compliance_warning"]
        if "toxicity_critical" in config:
            thresholds.toxicity_critical = config["toxicity_critical"]
        if "toxicity_warning" in config:
            thresholds.toxicity_warning = config["toxicity_warning"]
        if "sentiment_negative" in config:
            thresholds.sentiment_negative = config["sentiment_negative"]
        if "emotion_negative" in config:
            thresholds.emotion_negative = config["emotion_negative"]
        if "keyword_count_warning" in config:
            thresholds.keyword_count_warning = config["keyword_count_warning"]
        if "keyword_count_critical" in config:
            thresholds.keyword_count_critical = config["keyword_count_critical"]
        return thresholds


def check_compliance_alerts(analysis: Dict, thresholds: Optional[AlertThresholds] = None) -> List[Alert]:
    """
    Check analysis results against thresholds and generate alerts

    Args:
        analysis: Analysis results dictionary
        thresholds: AlertThresholds instance (uses defaults if None)

    Returns:
        List of Alert objects
    """
    if thresholds is None:
        thresholds = AlertThresholds()

    alerts = []

    # Extract metrics
    compliance_score = analysis.get("compliance_score", 100.0)
    toxicity_score = analysis.get("toxicity_score", 0.0)
    sentiment = analysis.get("sentiment", "NEUTRAL")
    emotion = analysis.get("emotion", "neutral")

    # Check compliance score
    if compliance_score < thresholds.compliance_critical:
        alerts.append(Alert(
            level="critical",
            message=f"Critical: Compliance score ({compliance_score:.1f}) is below critical threshold ({thresholds.compliance_critical})",
            metric="compliance_score",
            value=compliance_score,
            threshold=thresholds.compliance_critical
        ))
    elif compliance_score < thresholds.compliance_warning:
        alerts.append(Alert(
            level="warning",
            message=f"Warning: Compliance score ({compliance_score:.1f}) is below warning threshold ({thresholds.compliance_warning})",
            metric="compliance_score",
            value=compliance_score,
            threshold=thresholds.compliance_warning
        ))

    # Check toxicity score
    if toxicity_score > thresholds.toxicity_critical:
        alerts.append(Alert(
            level="critical",
            message=f"Critical: Toxicity score ({toxicity_score:.3f}) exceeds critical threshold ({thresholds.toxicity_critical})",
            metric="toxicity_score",
            value=toxicity_score,
            threshold=thresholds.toxicity_critical
        ))
    elif toxicity_score > thresholds.toxicity_warning:
        alerts.append(Alert(
            level="warning",
            message=f"Warning: Toxicity score ({toxicity_score:.3f}) exceeds warning threshold ({thresholds.toxicity_warning})",
            metric="toxicity_score",
            value=toxicity_score,
            threshold=thresholds.toxicity_warning
        ))

    # Check sentiment
    if thresholds.sentiment_negative and sentiment.upper() == "NEGATIVE":
        alerts.append(Alert(
            level="warning",
            message=f"Negative sentiment detected in analysis",
            metric="sentiment",
            value=0.0,  # No numeric value for sentiment
            threshold=0.0
        ))

    # Check emotion
    if emotion.lower() in thresholds.emotion_negative:
        alerts.append(Alert(
            level="warning",
            message=f"Negative emotion detected: {emotion}",
            metric="emotion",
            value=0.0,
            threshold=0.0
        ))

    # Check keyword detection if available
    keyword_detection = analysis.get("keyword_detection", {})
    if keyword_detection:
        keyword_count = keyword_detection.get("statistics", {}).get("total", 0)
        if keyword_count >= thresholds.keyword_count_critical:
            alerts.append(Alert(
                level="critical",
                message=f"Critical: {keyword_count} problematic keywords detected (threshold: {thresholds.keyword_count_critical})",
                metric="keyword_count",
                value=float(keyword_count),
                threshold=float(thresholds.keyword_count_critical)
            ))
        elif keyword_count >= thresholds.keyword_count_warning:
            alerts.append(Alert(
                level="warning",
                message=f"Warning: {keyword_count} problematic keywords detected (threshold: {thresholds.keyword_count_warning})",
                metric="keyword_count",
                value=float(keyword_count),
                threshold=float(thresholds.keyword_count_warning)
            ))

    return alerts


def generate_alert_summary(alerts: List[Alert]) -> Dict:
    """Generate summary statistics from alerts"""
    if not alerts:
        return {
            "total": 0,
            "critical": 0,
            "warning": 0,
            "info": 0,
            "has_alerts": False
        }

    summary = {
        "total": len(alerts),
        "critical": sum(1 for a in alerts if a.level == "critical"),
        "warning": sum(1 for a in alerts if a.level == "warning"),
        "info": sum(1 for a in alerts if a.level == "info"),
        "has_alerts": True,
        "alerts": [alert.to_dict() for alert in alerts]
    }

    return summary

