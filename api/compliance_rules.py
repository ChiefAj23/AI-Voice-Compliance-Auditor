"""
Custom Compliance Rules Engine
Allows users to create, manage, and evaluate custom compliance rules
"""
from typing import Dict, List, Optional, Any
import re
from datetime import datetime
from sqlalchemy.orm import Session
from .database import ComplianceRule
from .safe_eval import safe_eval


class RuleResult:
    """Result of evaluating a rule against text/analysis"""
    def __init__(self, rule_id: int, rule_name: str, matched: bool, severity: str,
                 matches: List[Dict] = None, message: str = None, value: Any = None):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.matched = matched
        self.severity = severity
        self.matches = matches or []
        self.message = message
        self.value = value
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict:
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "matched": self.matched,
            "severity": self.severity,
            "matches": self.matches,
            "message": self.message,
            "value": self.value,
            "timestamp": self.timestamp.isoformat()
        }


class ComplianceRuleEngine:
    """Engine for evaluating compliance rules"""

    def __init__(self, db: Session):
        self.db = db

    def get_active_rules(self, category: Optional[str] = None) -> List[ComplianceRule]:
        """Get all active compliance rules, optionally filtered by category"""
        query = self.db.query(ComplianceRule).filter(ComplianceRule.is_active == True)
        if category:
            query = query.filter(ComplianceRule.category == category)
        return query.order_by(ComplianceRule.priority.desc(), ComplianceRule.created_at).all()

    def evaluate_rules(self, text: str, analysis: Dict) -> List[RuleResult]:
        """
        Evaluate all active rules against text and analysis

        Args:
            text: Transcribed text
            analysis: Analysis results dictionary

        Returns:
            List of RuleResult objects
        """
        rules = self.get_active_rules()
        results = []

        for rule in rules:
            try:
                result = self.evaluate_rule(rule, text, analysis)
                if result.matched:
                    results.append(result)
            except Exception as e:
                # Log error but continue with other rules
                print(f"Error evaluating rule {rule.id} ({rule.name}): {str(e)}")
                continue

        return results

    def evaluate_rule(self, rule: ComplianceRule, text: str, analysis: Dict) -> RuleResult:
        """
        Evaluate a single rule

        Args:
            rule: ComplianceRule instance
            text: Transcribed text
            analysis: Analysis results dictionary

        Returns:
            RuleResult object
        """
        matched = False
        matches = []
        message = None
        value = None

        if rule.rule_type == "regex":
            matched, matches, message = self._evaluate_regex(rule, text)

        elif rule.rule_type == "keyword":
            matched, matches, message = self._evaluate_keyword(rule, text)

        elif rule.rule_type == "sentiment":
            matched, value, message = self._evaluate_sentiment(rule, analysis)

        elif rule.rule_type == "toxicity":
            matched, value, message = self._evaluate_toxicity(rule, analysis)

        elif rule.rule_type == "emotion":
            matched, value, message = self._evaluate_emotion(rule, analysis)

        elif rule.rule_type == "compliance_score":
            matched, value, message = self._evaluate_compliance_score(rule, analysis)

        elif rule.rule_type == "custom":
            # Custom Python expression evaluation (be careful with security!)
            matched, value, message = self._evaluate_custom(rule, text, analysis)

        return RuleResult(
            rule_id=rule.id,
            rule_name=rule.name,
            matched=matched,
            severity=rule.severity,
            matches=matches,
            message=message,
            value=value
        )

    def _evaluate_regex(self, rule: ComplianceRule, text: str) -> tuple:
        """Evaluate regex pattern rule"""
        if not rule.pattern:
            return False, [], "No pattern specified"

        try:
            # Compile regex pattern
            flags = re.IGNORECASE if rule.config and rule.config.get("case_sensitive") == False else 0
            pattern = re.compile(rule.pattern, flags)

            # Find all matches
            regex_matches = list(pattern.finditer(text))
            matched = len(regex_matches) > 0

            matches = []
            for match in regex_matches:
                start = match.start()
                end = match.end()
                matches.append({
                    "text": match.group(),
                    "start": start,
                    "end": end,
                    "context": self._get_context(text, start, end)
                })

            message = f"Found {len(matches)} match(es) for pattern: {rule.pattern}" if matched else None
            return matched, matches, message

        except re.error as e:
            return False, [], f"Invalid regex pattern: {str(e)}"

    def _evaluate_keyword(self, rule: ComplianceRule, text: str) -> tuple:
        """Evaluate keyword list rule"""
        if not rule.pattern:
            return False, [], "No keywords specified"

        # Parse keywords (comma-separated or newline-separated)
        keywords = [kw.strip() for kw in re.split(r'[,;\n]', rule.pattern) if kw.strip()]
        if not keywords:
            return False, [], "No valid keywords found"

        matched = False
        matches = []
        case_sensitive = rule.config and rule.config.get("case_sensitive", False) if rule.config else False

        text_lower = text if case_sensitive else text.lower()
        keywords_lower = keywords if case_sensitive else [kw.lower() for kw in keywords]

        for keyword in keywords_lower:
            if keyword in text_lower:
                # Find all occurrences
                start = 0
                while True:
                    idx = text_lower.find(keyword, start)
                    if idx == -1:
                        break
                    matches.append({
                        "text": text[idx:idx+len(keyword)],
                        "keyword": keyword if case_sensitive else keywords[keywords_lower.index(keyword)],
                        "start": idx,
                        "end": idx + len(keyword),
                        "context": self._get_context(text, idx, idx + len(keyword))
                    })
                    start = idx + 1
                matched = True

        message = f"Found {len(matches)} keyword match(es): {', '.join(set(m['keyword'] for m in matches))}" if matched else None
        return matched, matches, message

    def _evaluate_sentiment(self, rule: ComplianceRule, analysis: Dict) -> tuple:
        """Evaluate sentiment-based rule"""
        sentiment = analysis.get("sentiment", "NEUTRAL")
        sentiment_lower = sentiment.upper()

        if not rule.pattern:
            return False, None, "No sentiment pattern specified"

        target_sentiment = rule.pattern.strip().upper()

        if rule.condition == "equals":
            matched = sentiment_lower == target_sentiment
        elif rule.condition == "contains":
            matched = target_sentiment in sentiment_lower
        else:
            matched = sentiment_lower == target_sentiment

        value = sentiment
        message = f"Sentiment '{sentiment}' {'matches' if matched else 'does not match'} pattern '{target_sentiment}'" if matched else None
        return matched, value, message

    def _evaluate_toxicity(self, rule: ComplianceRule, analysis: Dict) -> tuple:
        """Evaluate toxicity score rule"""
        toxicity_score = analysis.get("toxicity_score", 0.0)
        threshold = rule.threshold if rule.threshold is not None else 0.5

        if rule.condition == "greater_than":
            matched = toxicity_score > threshold
        elif rule.condition == "greater_than_or_equal":
            matched = toxicity_score >= threshold
        elif rule.condition == "less_than":
            matched = toxicity_score < threshold
        elif rule.condition == "less_than_or_equal":
            matched = toxicity_score <= threshold
        else:
            matched = toxicity_score > threshold

        value = toxicity_score
        message = f"Toxicity score {toxicity_score:.3f} {'exceeds' if matched else 'does not exceed'} threshold {threshold:.3f}" if matched else None
        return matched, value, message

    def _evaluate_emotion(self, rule: ComplianceRule, analysis: Dict) -> tuple:
        """Evaluate emotion-based rule"""
        emotion = analysis.get("emotion", "neutral").lower()

        if not rule.pattern:
            return False, None, "No emotion pattern specified"

        target_emotions = [e.strip().lower() for e in re.split(r'[,;]', rule.pattern)]

        if rule.condition == "equals":
            matched = emotion in target_emotions
        elif rule.condition == "contains":
            matched = any(e in emotion for e in target_emotions)
        else:
            matched = emotion in target_emotions

        value = emotion
        message = f"Emotion '{emotion}' {'matches' if matched else 'does not match'} pattern '{rule.pattern}'" if matched else None
        return matched, value, message

    def _evaluate_compliance_score(self, rule: ComplianceRule, analysis: Dict) -> tuple:
        """Evaluate compliance score rule"""
        compliance_score = analysis.get("compliance_score", 100.0)
        threshold = rule.threshold if rule.threshold is not None else 70.0

        if rule.condition == "less_than":
            matched = compliance_score < threshold
        elif rule.condition == "less_than_or_equal":
            matched = compliance_score <= threshold
        elif rule.condition == "greater_than":
            matched = compliance_score > threshold
        elif rule.condition == "greater_than_or_equal":
            matched = compliance_score >= threshold
        else:
            matched = compliance_score < threshold

        value = compliance_score
        message = f"Compliance score {compliance_score:.1f} {'is below' if matched else 'is above'} threshold {threshold:.1f}" if matched else None
        return matched, value, message

    def _evaluate_custom(self, rule: ComplianceRule, text: str, analysis: Dict) -> tuple:
        """Evaluate a custom rule expression with the safe evaluator (never eval())."""
        if not rule.pattern:
            return False, None, "No custom expression specified"

        try:
            # The names a rule can use. Functions such as len() and text methods such as
            # .lower() come from api/safe_eval.py, which refuses anything else.
            variables = {
                "text": text,
                "analysis": analysis,
                "sentiment": analysis.get("sentiment", ""),
                "toxicity_score": analysis.get("toxicity_score", 0.0),
                "compliance_score": analysis.get("compliance_score", 100.0),
                "emotion": analysis.get("emotion", ""),
            }

            result = safe_eval(rule.pattern, variables)
            matched = bool(result)

            value = result
            message = f"Custom rule evaluated: {result}" if matched else None
            return matched, value, message

        except Exception as e:
            return False, None, f"Error evaluating custom expression: {str(e)}"

    def _get_context(self, text: str, start: int, end: int, context_size: int = 30) -> str:
        """Get surrounding context for a match"""
        context_start = max(0, start - context_size)
        context_end = min(len(text), end + context_size)
        context = text[context_start:context_end]

        # Add ellipsis if truncated
        if context_start > 0:
            context = "..." + context
        if context_end < len(text):
            context = context + "..."

        return context.strip()

