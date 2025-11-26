"""
Action Items & Commitments Detection Module
Extracts tasks, deadlines, follow-ups, and commitments from conversations
"""
from typing import Dict, List, Optional, Any
import re
from datetime import datetime, timedelta
from dateutil.parser import parse as parse_date
import calendar


class ActionItem:
    """Represents a detected action item or commitment"""
    def __init__(self, text: str, item_type: str, assigned_to: Optional[str] = None,
                 deadline: Optional[str] = None, confidence: float = 0.5,
                 context: Optional[str] = None, start_pos: int = 0, end_pos: int = 0):
        self.text = text
        self.item_type = item_type  # "task", "deadline", "follow_up", "commitment"
        self.assigned_to = assigned_to
        self.deadline = deadline
        self.confidence = confidence
        self.context = context
        self.start_pos = start_pos
        self.end_pos = end_pos
        self.timestamp = datetime.now()

    def to_dict(self) -> Dict:
        return {
            "text": self.text,
            "item_type": self.item_type,
            "assigned_to": self.assigned_to,
            "deadline": self.deadline,
            "confidence": round(self.confidence, 3),
            "context": self.context,
            "start_pos": self.start_pos,
            "end_pos": self.end_pos,
            "timestamp": self.timestamp.isoformat()
        }


def detect_action_items(text: str, speaker_segments: Optional[List[Dict]] = None) -> Dict:
    """
    Detect action items, commitments, deadlines, and follow-ups from conversation text

    Args:
        text: Full conversation transcript
        speaker_segments: Optional speaker diarization segments for attribution

    Returns:
        Dictionary with detected action items and statistics
    """
    action_items = []

    # Patterns for detecting action items
    action_patterns = [
        # "I will..." patterns
        (r'\b(?:I\'ll|I will|I\'m going to|I plan to|I intend to)\s+([^.!?]+?)(?:\.|$|\?)',
         'commitment', 0.8),
        # "You should..." patterns
        (r'\b(?:you should|you need to|you must|please|could you|can you)\s+([^.!?]+?)(?:\.|$|\?)',
         'task', 0.7),
        # "We will..." patterns
        (r'\b(?:we\'ll|we will|we\'re going to|we need to|we should)\s+([^.!?]+?)(?:\.|$|\?)',
         'commitment', 0.8),
        # "Let me..." patterns
        (r'\b(?:let me|I\'ll|I will)\s+([^.!?]+?)(?:\.|$|\?)',
         'commitment', 0.7),
        # "Make sure to..." patterns
        (r'\b(?:make sure to|ensure that|remember to|don\'t forget to)\s+([^.!?]+?)(?:\.|$|\?)',
         'task', 0.7),
        # "Follow up..." patterns
        (r'\b(?:follow up|follow-up|followup)\s+(?:on|with|about|regarding)?\s*([^.!?]+?)(?:\.|$|\?)',
         'follow_up', 0.8),
        # "Action item:" explicit mentions
        (r'\b(?:action item|action:|todo|to-do|task)\s*:?\s*([^.!?\n]+?)(?:\.|$|\n|\?)',
         'task', 0.9),
    ]

    # Deadline/time patterns
    deadline_patterns = [
        # Dates: "by Monday", "by 2024-01-15", "by next week"
        (r'\b(?:by|before|until|due)\s+((?:this|next)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[/-]\d{1,2}[/-]?\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}))',
         0.8),
        # Time-based: "in 2 days", "by tomorrow", "next week"
        (r'\b(?:by|in|within)\s+((?:tomorrow|today|tonight|this\s+(?:week|month)|next\s+(?:week|month)|in\s+\d+\s+(?:days?|weeks?|months?)))',
         0.7),
        # Relative dates: "end of week", "end of month"
        (r'\b(?:end\s+of|EOD|EOB)\s+((?:the\s+)?(?:week|month|day|quarter|year))',
         0.7),
    ]

    # Extract action items using patterns
    for pattern, item_type, confidence in action_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            action_text = match.group(1).strip()
            if len(action_text) < 5:  # Skip very short matches
                continue

            # Look for deadlines in the context
            context_start = max(0, match.start() - 100)
            context_end = min(len(text), match.end() + 100)
            context = text[context_start:context_end]

            deadline = extract_deadline(context, match.start())
            assigned_to = extract_assigned_person(context, text, speaker_segments, match.start())

            action_item = ActionItem(
                text=action_text,
                item_type=item_type,
                assigned_to=assigned_to,
                deadline=deadline,
                confidence=confidence,
                context=context.strip(),
                start_pos=match.start(),
                end_pos=match.end()
            )
            action_items.append(action_item)

    # Remove duplicates and merge similar items
    action_items = deduplicate_action_items(action_items)

    # Sort by confidence and position
    action_items.sort(key=lambda x: (-x.confidence, x.start_pos))

    # Generate statistics
    stats = generate_action_item_statistics(action_items)

    return {
        "action_items": [item.to_dict() for item in action_items],
        "statistics": stats
    }


def extract_deadline(context: str, position: int) -> Optional[str]:
    """Extract deadline information from context"""
    deadline_patterns = [
        # Explicit dates
        (r'\b(?:by|before|until|due)\s+(\d{1,2}[/-]\d{1,2}[/-]?\d{2,4})', 0.9),
        (r'\b(?:by|before|until|due)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2})', 0.9),
        # Days of week
        (r'\b(?:by|before|until)\s+((?:this|next)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))', 0.8),
        # Relative time
        (r'\b(?:by|before|until)\s+(tomorrow|today|tonight)', 0.8),
        (r'\b(?:by|before|until)\s+((?:this|next)\s+(?:week|month))', 0.7),
        (r'\bin\s+(\d+)\s+(?:days?|weeks?|months?)', 0.7),
        # End of period
        (r'\b(end\s+of\s+(?:the\s+)?(?:week|month|day|quarter|year)|EOD|EOB)', 0.7),
    ]

    for pattern, confidence in deadline_patterns:
        match = re.search(pattern, context, re.IGNORECASE)
        if match:
            deadline_text = match.group(1) if match.groups() else match.group(0)
            # Try to normalize the date
            normalized = normalize_deadline(deadline_text)
            return normalized or deadline_text

    return None


def normalize_deadline(deadline_text: str) -> Optional[str]:
    """Normalize deadline text to a standard format"""
    deadline_text = deadline_text.lower().strip()
    today = datetime.now()

    # Days of week
    days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for i, day in enumerate(days):
        if day in deadline_text:
            if 'next' in deadline_text:
                days_ahead = (i - today.weekday()) % 7 + 7
            else:
                days_ahead = (i - today.weekday()) % 7
                if days_ahead == 0:
                    days_ahead = 7  # Next week if today
            target_date = today + timedelta(days=days_ahead)
            return target_date.strftime('%Y-%m-%d')

    # Relative terms
    if 'tomorrow' in deadline_text:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')
    if 'today' in deadline_text or 'tonight' in deadline_text:
        return today.strftime('%Y-%m-%d')
    if 'next week' in deadline_text:
        return (today + timedelta(days=7)).strftime('%Y-%m-%d')
    if 'next month' in deadline_text:
        next_month = today.replace(day=1) + timedelta(days=32)
        next_month = next_month.replace(day=1)
        return next_month.strftime('%Y-%m-%d')
    if 'end of week' in deadline_text or 'eow' in deadline_text:
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0:
            days_until_friday = 7
        return (today + timedelta(days=days_until_friday)).strftime('%Y-%m-%d')
    if 'end of month' in deadline_text or 'eom' in deadline_text:
        if today.month == 12:
            next_month = today.replace(year=today.year + 1, month=1, day=1)
        else:
            next_month = today.replace(month=today.month + 1, day=1)
        last_day = (next_month - timedelta(days=1)).day
        return today.replace(day=last_day).strftime('%Y-%m-%d')

    # Try parsing as date
    try:
        parsed = parse_date(deadline_text, fuzzy=True)
        return parsed.strftime('%Y-%m-%d')
    except:
        pass

    return None


def extract_assigned_person(context: str, full_text: str, speaker_segments: Optional[List[Dict]],
                           position: int) -> Optional[str]:
    """Extract who the action item is assigned to"""
    # Look for names or pronouns in context
    pronoun_patterns = [
        (r'\b(I\'ll|I will|I\'m going to)\b', 'Speaker'),
        (r'\b(you should|you need to|you must|can you|could you)\b', 'You'),
        (r'\b(we\'ll|we will|we need to)\b', 'Team'),
    ]

    for pattern, person in pronoun_patterns:
        if re.search(pattern, context, re.IGNORECASE):
            return person

    # Try to find speaker name if speaker segments available
    if speaker_segments:
        for segment in speaker_segments:
            seg_start = segment.get('start', 0) * len(full_text) / 100  # Approximate
            seg_end = segment.get('end', 0) * len(full_text) / 100
            if seg_start <= position <= seg_end:
                speaker = segment.get('speaker', '')
                if speaker:
                    return speaker

    return None


def deduplicate_action_items(items: List[ActionItem]) -> List[ActionItem]:
    """Remove duplicate or very similar action items"""
    if not items:
        return []

    unique_items = []
    seen_texts = set()

    for item in items:
        # Normalize text for comparison
        normalized = item.text.lower().strip()
        normalized = re.sub(r'[^\w\s]', '', normalized)

        # Check if similar item already exists
        is_duplicate = False
        for seen in seen_texts:
            # Check similarity (simple approach - can be improved with fuzzy matching)
            if normalized in seen or seen in normalized:
                if len(normalized) > 10 and len(seen) > 10:  # Only for substantial text
                    is_duplicate = True
                    break

        if not is_duplicate:
            unique_items.append(item)
            seen_texts.add(normalized)

    return unique_items


def generate_action_item_statistics(action_items: List[ActionItem]) -> Dict:
    """Generate statistics about detected action items"""
    if not action_items:
        return {
            "total": 0,
            "by_type": {},
            "by_assignee": {},
            "with_deadlines": 0,
            "deadline_distribution": {}
        }

    by_type = {}
    by_assignee = {}
    with_deadlines = 0
    deadline_distribution = {}

    for item in action_items:
        # Count by type
        by_type[item.item_type] = by_type.get(item.item_type, 0) + 1

        # Count by assignee
        assignee = item.assigned_to or "Unassigned"
        by_assignee[assignee] = by_assignee.get(assignee, 0) + 1

        # Count deadlines
        if item.deadline:
            with_deadlines += 1
            # Group by time period
            try:
                deadline_date = datetime.strptime(item.deadline, '%Y-%m-%d')
                today = datetime.now()
                days_until = (deadline_date - today).days

                if days_until < 0:
                    period = "Overdue"
                elif days_until <= 7:
                    period = "This Week"
                elif days_until <= 30:
                    period = "This Month"
                else:
                    period = "Later"

                deadline_distribution[period] = deadline_distribution.get(period, 0) + 1
            except:
                deadline_distribution["Unspecified"] = deadline_distribution.get("Unspecified", 0) + 1

    return {
        "total": len(action_items),
        "by_type": by_type,
        "by_assignee": by_assignee,
        "with_deadlines": with_deadlines,
        "deadline_distribution": deadline_distribution
    }

