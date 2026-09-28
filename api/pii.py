"""
Personal data in transcripts: find it and replace it before anything else sees the text.

A call is redacted straight after transcription, so the analysis, the rules, the summaries, the
stored record, exports, webhooks and emails only ever see placeholders such as [CARD] or [SSN].
Findings are counted by type and kept with the analysis: a customer reading out a card number is
itself something a compliance team wants to know about.

Detection is pattern-based with validation, so it is fast and predictable:
- payment cards: 13-19 digits that pass the Luhn check, or 12-19 digits right after words such as
  "card", "credit" or "Visa" whatever the check says (speech-to-text drops and mishears digits,
  and a card number with one digit wrong is still a card number)
- US Social Security numbers written 123-45-6789 or 123 45 6789 (never-issued ranges excluded),
  or nine digits right after "social security" / "SSN"
- email addresses (also spoken: "jane at example dot com", or with the "at" merged into a word
  right after "my email is"), phone numbers (North American and international), IBANs that pass
  the mod-97 check
- account numbers, CVV codes, PINs, card expiry dates and dates of birth when the words just
  before them say what they are
- any other run of nine or more digits (an identifier of some kind), kept apart from amounts such
  as $1,250,000
Digits read out as words ("four one one one ...") are matched too. Person names are optional
(PII_REDACT_NAMES=true) and use a named-entity model.
"""
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

# Placeholder shown in place of each kind of finding.
TOKENS = {
    "card_number": "[CARD]",
    "ssn": "[SSN]",
    "iban": "[IBAN]",
    "email": "[EMAIL]",
    "phone": "[PHONE]",
    "account_number": "[ACCOUNT]",
    "cvv": "[CVV]",
    "pin": "[PIN]",
    "card_expiry": "[EXPIRY]",
    "date_of_birth": "[DOB]",
    "number": "[NUMBER]",
    "name": "[NAME]",
}
# Findings that make a call sensitive under PCI DSS or identity-theft rules.
SENSITIVE = {"card_number", "cvv", "pin", "card_expiry", "ssn", "iban"}

_DIGIT_WORDS = {
    "zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}
_DIGIT_WORD = r"(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)"
# Four or more digits read out as words, e.g. "four one one one".
_SPOKEN_DIGITS = re.compile(rf"\b{_DIGIT_WORD}(?:[\s,.-]+{_DIGIT_WORD}){{3,}}\b", re.IGNORECASE)

_MONTH = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
_DATE = (
    rf"(?:\d{{1,2}}[/.-]\d{{1,2}}[/.-]\d{{2,4}}"
    rf"|{_MONTH}\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
    rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:of\s+)?{_MONTH},?\s+\d{{4}})"
)

# (kind, pattern, group holding the finding). Earlier entries win where findings overlap.
_PATTERNS: List[Tuple[str, "re.Pattern[str]", int]] = [
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), 0),
    ("email", re.compile(
        # Repetitions are capped (no real address has more), which keeps matching linear.
        r"\b[A-Za-z0-9._%+-]{1,64}?(?:[\s,]+dot[\s,]+[A-Za-z0-9._%+-]{1,64}?){0,4}[\s.,]+at[\s.,]+[A-Za-z0-9-]{1,63}"
        r"(?:(?:[\s.,]+dot[\s.,]+|\.)[A-Za-z0-9-]{1,63}){0,4}?(?:[\s.,]+dot[\s.,]+|\.)"
        r"(?:com|net|org|edu|gov|io|co|uk|us|ca|de|fr|in|info|biz)\b", re.IGNORECASE), 0),
    ("email", re.compile(
        r"\be-?mail(?:\s+address)?(?:\s+is|:)?\s+([A-Za-z0-9._%+-]{1,64}\.(?:com|net|org|edu|gov|io|co|uk|us|ca|de|fr|in|info|biz))\b",
        re.IGNORECASE), 1),
    ("iban", re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b"), 0),
    ("card_number", re.compile(
        r"\b(?:card|credit|debit|visa|master ?card|amex|american express|discover)\b\D{0,80}?"
        r"(?<![\d,.-])((?:\d[ ,.-]{0,2}){11,18}\d)(?![\d,.-]*\d)", re.IGNORECASE), 1),
    ("card_number", re.compile(r"(?<![\d,.-])(?:\d[ ,.-]{0,2}){12,18}\d(?![\d-])"), 0),
    ("ssn", re.compile(r"(?<![\d-])(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}(?![\d-])"), 0),
    ("ssn", re.compile(r"\b(?:social security(?: number)?|ssn|social)\b\D{0,20}?(\d{9})\b", re.IGNORECASE), 1),
    ("cvv", re.compile(
        r"\b(?:cvv2?|cvc2?|cid|security code|verification code|card verification(?: value| code)?|"
        r"(?:three|four|3|4)[ -]digit (?:security )?code)\b\D{0,20}?(\d{3,4})\b", re.IGNORECASE), 1),
    ("pin", re.compile(r"\b(?:pin(?: number| code)?|passcode|pass code)\b\D{0,15}?(\d{4,8})\b", re.IGNORECASE), 1),
    ("card_expiry", re.compile(
        r"\b(?:expir\w*(?: date)?|exp(?:\.|iry)? date|valid (?:thru|through|until))\b\D{0,15}?"
        r"(\d[\w ,/.-]{0,15}?\d{2})\b", re.IGNORECASE), 1),
    ("date_of_birth", re.compile(rf"\b(?:date of birth|birth ?date|birthday|d\.?o\.?b\.?|born on)\b\D{{0,15}}?({_DATE})", re.IGNORECASE), 1),
    ("account_number", re.compile(
        r"\b(?:account|acct|member|policy|customer|routing|reference|confirmation)"
        r"(?:\s+(?:number|no\.?|num|id|#))?(?:\s+(?:is|was))?\s*[:#]?\s*((?=[A-Z0-9-]*\d{5})[A-Z0-9][A-Z0-9-]{5,19})\b",
        re.IGNORECASE), 1),
    ("phone", re.compile(
        r"(?<![\d-])(?:\+?1[\s.-]?)?(?:\(\s*[2-9]\d{2}\s*\)|[2-9]\d{2})[\s.-]?[2-9]\d{2}[\s.-]?\d{4}(?![\d-])"), 0),
    ("phone", re.compile(r"(?<![\d-])\+\d{1,3}(?:[\s.-]?\d){7,12}(?![\d-])"), 0),
    ("number", re.compile(r"(?<![\d,.-])\d(?:[ -]?\d){8,}(?![\d,.-]*\d)"), 0),
]


def _luhn(digits: str) -> bool:
    total, double = 0, False
    for ch in reversed(digits):
        n = int(ch)
        if double:
            n = n * 2 - 9 if n > 4 else n * 2
        total += n
        double = not double
    return total % 10 == 0


def _iban_ok(value: str) -> bool:
    compact = value.replace(" ", "")
    if not 15 <= len(compact) <= 34:
        return False
    rearranged = compact[4:] + compact[:4]
    number = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(number) % 97 == 1


def _valid(kind: str, value: str, contextual: bool = False) -> bool:
    if kind == "card_number":
        digits = re.sub(r"\D", "", value)
        if contextual:  # after card words: any plausible length, no checksum
            return 12 <= len(digits) <= 19
        return 13 <= len(digits) <= 19 and _luhn(digits)
    if kind == "iban":
        return _iban_ok(value)
    return True


class _Normalized:
    """The text with spoken digits turned into numerals, and a map back to the original offsets."""

    def __init__(self, text: str):
        self.pieces: List[Tuple[int, int, int, int, bool]] = []  # norm start/end, orig start/end, replaced
        out, norm, orig = [], 0, 0
        for match in _SPOKEN_DIGITS.finditer(text):
            if match.start() > orig:
                chunk = text[orig:match.start()]
                out.append(chunk)
                self.pieces.append((norm, norm + len(chunk), orig, match.start(), False))
                norm += len(chunk)
            digits = "".join(_DIGIT_WORDS[word.lower()] for word in re.findall(_DIGIT_WORD, match.group(), re.IGNORECASE))
            out.append(digits)
            self.pieces.append((norm, norm + len(digits), match.start(), match.end(), True))
            norm += len(digits)
            orig = match.end()
        if orig < len(text):
            chunk = text[orig:]
            out.append(chunk)
            self.pieces.append((norm, norm + len(chunk), orig, len(text), False))
        self.text = "".join(out)

    def to_original(self, start: int, end: int) -> Tuple[int, int]:
        return self._map(start, is_end=False), self._map(end, is_end=True)

    def _map(self, pos: int, is_end: bool) -> int:
        for n_start, n_end, o_start, o_end, replaced in self.pieces:
            if n_start <= pos < n_end or (is_end and pos == n_end):
                if replaced:
                    return o_end if is_end else o_start
                return o_start + (pos - n_start)
        return self.pieces[-1][3] if self.pieces else pos


@dataclass
class Redaction:
    text: str
    counts: Dict[str, int] = field(default_factory=dict)

    @property
    def sensitive(self) -> List[str]:
        return sorted(kind for kind in self.counts if kind in SENSITIVE)


def find(text: str, names: bool = False) -> List[Tuple[int, int, str]]:
    """Non-overlapping findings in ``text`` as (start, end, kind), in order."""
    if not text:
        return []
    normalized = _Normalized(text)
    taken: List[Tuple[int, int, str]] = []
    for kind, pattern, group in _PATTERNS:
        for match in pattern.finditer(normalized.text):
            start, end = match.span(group)
            if start < 0 or not _valid(kind, match.group(group), contextual=group > 0):
                continue
            start, end = normalized.to_original(start, end)
            if any(start < t_end and t_start < end for t_start, t_end, _ in taken):
                continue
            taken.append((start, end, kind))
    if names:
        for start, end in _person_names(text):
            if not any(start < t_end and t_start < end for t_start, t_end, _ in taken):
                taken.append((start, end, "name"))
    return sorted(taken)


def redact(text: str, names: bool = False) -> Redaction:
    """``text`` with every finding replaced by its placeholder, and the findings counted by kind."""
    spans = find(text, names=names)
    counts: Dict[str, int] = {}
    out, last = [], 0
    for start, end, kind in spans:
        out.append(text[last:start])
        out.append(TOKENS[kind])
        counts[kind] = counts.get(kind, 0) + 1
        last = end
    out.append(text[last:] if text else "")
    return Redaction("".join(out), counts)


def redact_transcription(text: str, result: Optional[dict], names: bool = False):
    """
    Redact a transcript and its segments together. The segments are redacted as one text, so a
    number read out across two segments is still caught. Raw token ids and word-level entries are
    dropped from the segments, since they would carry the original words.

    Returns (redacted text, redacted copy of ``result``, Redaction for the whole call).
    """
    whole = redact(text or "", names=names)
    if not isinstance(result, dict):
        return whole.text, result, whole
    result = dict(result)
    if isinstance(result.get("text"), str):
        result["text"] = whole.text
    segments = [dict(segment) for segment in (result.get("segments") or []) if isinstance(segment, dict)]
    if segments:
        texts = [segment.get("text") or "" for segment in segments]
        joined, bounds, pos = "", [], 0
        for i, piece in enumerate(texts):
            # Whisper segments usually start with a space; add one only where two would touch.
            if i and not (joined[-1:].isspace() or piece[:1].isspace()):
                joined += " "
                pos += 1
            bounds.append((pos, pos + len(piece)))
            joined += piece
            pos += len(piece)
        spans = find(joined, names=names)
        for i, (seg_start, seg_end) in enumerate(bounds):
            out, cursor = [], seg_start
            for start, end, kind in spans:
                if end <= seg_start or start >= seg_end:
                    continue
                out.append(joined[cursor:max(start, seg_start)])
                if start >= seg_start:  # the finding starts here: this segment shows the placeholder
                    out.append(TOKENS[kind])
                cursor = min(end, seg_end)
            out.append(joined[cursor:seg_end])
            segments[i]["text"] = "".join(out)
            segments[i].pop("tokens", None)
            segments[i].pop("words", None)
        result["segments"] = segments
    return whole.text, result, whole


def summary(redaction: Redaction, enabled: bool = True) -> dict:
    """What an analysis keeps about the redaction: whether it ran, and what it found."""
    return {"redacted": enabled, "counts": dict(redaction.counts), "sensitive": redaction.sensitive}


@lru_cache(maxsize=1)
def _ner():
    from transformers import pipeline

    return pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")


def _person_names(text: str) -> List[Tuple[int, int]]:
    """Spans of person names, from a named-entity model loaded on first use."""
    spans = []
    for entity in _ner()(text):
        if entity.get("entity_group") == "PER" and float(entity.get("score", 0)) >= 0.8:
            spans.append((int(entity["start"]), int(entity["end"])))
    return spans
