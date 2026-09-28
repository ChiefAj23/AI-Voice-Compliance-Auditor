"""The rule expression language: what it allows, and what it refuses."""
import pytest

from api.safe_eval import UnsafeExpression, safe_eval, validate

CONTEXT = {
    "text": "Thank you for calling. Your call may be recorded. It's guaranteed to lower your bill.",
    "sentiment": "POSITIVE",
    "toxicity_score": 0.01,
    "compliance_score": 99.9,
    "emotion": "gratitude",
    "analysis": {"sentiment": "POSITIVE", "toxicity_score": 0.01},
}


@pytest.mark.parametrize(
    "expression, expected",
    [
        ('"recorded" not in text.lower()', False),
        ('"guaranteed" in text.lower()', True),
        ("toxicity_score > 0.5", False),
        ("compliance_score < 70 or emotion == 'anger'", False),
        ('contains(text, "GUARANTEED") and not contains(text, "refund")', True),
        (r'matches(text, r"\bguarantee(d|s)?\b")', True),
        ('count(text, "call") >= 2', True),
        ("word_count(text) > 5", True),
        ("len(text) > 10 and analysis['toxicity_score'] < 0.1", True),
        ("analysis.get('sentiment') == 'POSITIVE'", True),
        ("(1 + 2) * 3 == 9", True),
        ("min(toxicity_score, 1) <= max(0, 0.5)", True),
        ("compliance_score if sentiment == 'POSITIVE' else 0", 99.9),
        ("text.split()[0].lower()", "thank"),
    ],
)
def test_allowed_expressions(expression, expected):
    assert safe_eval(expression, CONTEXT) == expected


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('id')",
        "().__class__.__bases__[0].__subclasses__()",
        "open('/etc/passwd').read()",
        "(lambda: 1)()",
        "[x for x in text]",
        "text.__class__",
        "exec('1')",
        "eval('1')",
        "getattr(text, 'upper')()",
        "text.encode()",
        "analysis.pop('sentiment')",
        "import os",
        "x = 1",
        "text * 100000",
        "len(text, key=1)",
        "",
        "1 +",
    ],
)
def test_blocked_expressions(expression):
    with pytest.raises(UnsafeExpression):
        safe_eval(expression, CONTEXT)


def test_unknown_names_are_errors_not_globals():
    with pytest.raises(UnsafeExpression):
        safe_eval("os", CONTEXT)


def test_too_long_or_too_complex_is_rejected():
    with pytest.raises(UnsafeExpression):
        validate("1 + " * 300 + "1")
    with pytest.raises(UnsafeExpression):
        validate("x" * 3000)


def test_validate_accepts_the_demo_rules():
    validate('"recorded" not in text.lower()')
    validate("toxicity_score > 0.5")
