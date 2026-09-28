"""
Keyword and phrase detection module for compliance monitoring
"""
import re
from typing import Dict, List, Optional

# Default keyword lists for different categories
DEFAULT_KEYWORDS = {
    "profanity": [
        "damn", "hell", "crap", "screw", "idiot", "stupid", "fool",
        "shut up", "shut it", "get lost", "go away"
    ],
    "unprofessional": [
        "whatever", "who cares", "not my problem", "i don't care",
        "your problem", "figure it out yourself"
    ],
    "compliance_risky": [
        "discrimination", "lawsuit", "legal action", "sue", "harassment",
        "hostile environment", "retaliation"
    ],
    "negative_tone": [
        "terrible", "awful", "horrible", "disgusting", "pathetic",
        "useless", "worthless", "ridiculous"
    ]
}

def detect_keywords(text: str, keyword_lists: Optional[Dict[str, List[str]]] = None, case_sensitive: bool = False) -> Dict:
    """
    Detect keywords and phrases in text

    Args:
        text: Input text to search
        keyword_lists: Dictionary of category -> list of keywords/phrases
        case_sensitive: Whether matching should be case-sensitive

    Returns:
        Dictionary with detection results
    """
    if keyword_lists is None:
        keyword_lists = DEFAULT_KEYWORDS

    results = {
        "matches": [],
        "by_category": {},
        "total_matches": 0,
        "flagged": False
    }

    flags = 0 if case_sensitive else re.IGNORECASE

    # Search for each keyword in each category
    for category, keywords in keyword_lists.items():
        category_matches = []

        for keyword in keywords:
            # Use word boundaries for whole word matching, but also allow phrase matching
            if ' ' in keyword:
                # Phrase matching
                pattern = re.escape(keyword)
            else:
                # Word boundary matching
                pattern = r'\b' + re.escape(keyword) + r'\b'

            matches = re.finditer(pattern, text, flags=flags)

            for match in matches:
                match_info = {
                    "keyword": keyword,
                    "category": category,
                    "position": match.start(),
                    "length": len(match.group()),
                    "context": _get_context(text, match.start(), match.end())
                }
                category_matches.append(match_info)
                results["matches"].append(match_info)

        if category_matches:
            results["by_category"][category] = category_matches

    results["total_matches"] = len(results["matches"])
    results["flagged"] = bool(results["total_matches"] > 0)

    # Sort matches by position
    results["matches"].sort(key=lambda x: x["position"])

    return results


def _get_context(text: str, start: int, end: int, context_size: int = 30) -> str:
    """Extract context around a match"""
    context_start = max(0, start - context_size)
    context_end = min(len(text), end + context_size)

    context = text[context_start:context_end]
    if context_start > 0:
        context = "..." + context
    if context_end < len(text):
        context = context + "..."

    return context


def highlight_keywords(text: str, matches: List[Dict], highlight_style: str = "badge") -> str:
    """
    Create HTML with highlighted keywords

    Args:
        text: Original text
        matches: List of match dictionaries from detect_keywords
        highlight_style: Style of highlighting ('badge', 'underline', 'background')

    Returns:
        HTML string with highlighted keywords
    """
    if not matches:
        return text

    # Sort matches by position (reverse for easier replacement)
    sorted_matches = sorted(matches, key=lambda x: x["position"], reverse=True)

    result = text
    category_colors = {
        "profanity": "red",
        "unprofessional": "orange",
        "compliance_risky": "purple",
        "negative_tone": "yellow"
    }

    for match in sorted_matches:
        keyword = match["keyword"]
        category = match["category"]
        position = match["position"]
        length = len(keyword)

        # Find the actual occurrence (in case of multiple matches)
        matched_text = text[position:position + length]

        # Color based on category
        color = category_colors.get(category, "gray")

        if highlight_style == "badge":
            highlighted = f'<span style="background-color:{color};color:white;padding:2px 6px;border-radius:4px;font-weight:bold;" title="{category}">{matched_text}</span>'
        elif highlight_style == "underline":
            highlighted = f'<span style="border-bottom:3px solid {color};font-weight:bold;" title="{category}">{matched_text}</span>'
        else:  # background
            highlighted = f'<span style="background-color:{color}80;padding:2px 4px;" title="{category}">{matched_text}</span>'

        # Replace in result (working backwards to preserve positions)
        result = result[:position] + highlighted + result[position + length:]

    return result


def get_keyword_statistics(matches: List[Dict]) -> Dict:
    """Generate statistics about keyword matches"""
    if not matches:
        return {
            "total": 0,
            "by_category": {},
            "most_frequent": [],
            "risk_level": "low"
        }

    # Count by category
    category_counts = {}
    keyword_counts = {}

    for match in matches:
        category = match["category"]
        keyword = match["keyword"]

        category_counts[category] = category_counts.get(category, 0) + 1
        keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1

    # Most frequent keywords
    most_frequent = sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # Calculate risk level
    total = len(matches)
    if total == 0:
        risk = "low"
    elif total <= 3:
        risk = "medium"
    else:
        risk = "high"

    # Check for compliance_risky category (always high risk)
    if "compliance_risky" in category_counts:
        risk = "high"

    return {
        "total": int(total),
        "by_category": {str(k): int(v) for k, v in category_counts.items()},
        "most_frequent": [{"keyword": str(k), "count": int(v)} for k, v in most_frequent],
        "risk_level": str(risk)
    }

