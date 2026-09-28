"""
A small, safe expression language for custom compliance rules.

Rules used to run through eval(), which lets anyone who can write a rule run code on the server.
This evaluator parses the expression into Python's AST and walks it with an allow-list: literals,
names from the rule context, boolean and comparison operators, arithmetic, `in`, subscripts, and
calls to a fixed set of helpers and string/dict methods. Anything else (attribute tricks, dunder
names, lambdas, comprehensions, imports) is rejected before evaluation, and expressions are capped
in size so a rule cannot be made expensive.

    safe_eval('"recorded" not in text.lower()', {"text": ...})
    safe_eval('toxicity_score > 0.5 and contains(text, "refund")', context)
"""
import ast
import re
from typing import Any, Callable, Dict

MAX_LENGTH = 2000
MAX_NODES = 250
MAX_PATTERN_LENGTH = 300


class UnsafeExpression(ValueError):
    """The expression uses something the rule language does not allow."""


def _contains(text: Any, phrase: Any) -> bool:
    return str(phrase).lower() in str(text).lower()


def _matches(text: Any, pattern: Any) -> bool:
    pattern = str(pattern)
    if len(pattern) > MAX_PATTERN_LENGTH:
        raise UnsafeExpression("regular expression too long")
    return re.search(pattern, str(text), re.IGNORECASE) is not None


def _count(text: Any, phrase: Any) -> int:
    return str(text).lower().count(str(phrase).lower())


def _word_count(text: Any) -> int:
    return len(str(text).split())


FUNCTIONS: Dict[str, Callable[..., Any]] = {
    "len": len,
    "str": str,
    "float": float,
    "int": int,
    "bool": bool,
    "min": min,
    "max": max,
    "abs": abs,
    "round": round,
    "any": any,
    "all": all,
    "lower": lambda value: str(value).lower(),
    "upper": lambda value: str(value).upper(),
    "contains": _contains,
    "matches": _matches,
    "count": _count,
    "word_count": _word_count,
}

# Methods a rule may call, by the type of the value they are called on.
METHODS = {
    str: {"lower", "upper", "strip", "startswith", "endswith", "count", "split", "find", "replace", "isdigit", "title"},
    dict: {"get", "keys", "values", "items"},
    list: {"count", "index"},
    tuple: {"count", "index"},
}

_BIN_OPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
    ast.FloorDiv: lambda a, b: a // b,
    ast.Mod: lambda a, b: a % b,
}
_CMP_OPS = {
    ast.Eq: lambda a, b: a == b,
    ast.NotEq: lambda a, b: a != b,
    ast.Lt: lambda a, b: a < b,
    ast.LtE: lambda a, b: a <= b,
    ast.Gt: lambda a, b: a > b,
    ast.GtE: lambda a, b: a >= b,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
    ast.Is: lambda a, b: a is b,
    ast.IsNot: lambda a, b: a is not b,
}


def parse(expression: str) -> ast.Expression:
    """Parse and check an expression; raises UnsafeExpression with a reason when it is not allowed."""
    if not isinstance(expression, str) or not expression.strip():
        raise UnsafeExpression("empty expression")
    if len(expression) > MAX_LENGTH:
        raise UnsafeExpression(f"expression longer than {MAX_LENGTH} characters")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as e:
        raise UnsafeExpression(f"syntax error: {e.msg}") from e
    count = 0
    for node in ast.walk(tree):
        count += 1
        if count > MAX_NODES:
            raise UnsafeExpression("expression too complex")
        _check(node)
    return tree


def _check(node: ast.AST) -> None:
    allowed = (
        ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.USub, ast.UAdd,
        ast.BinOp, ast.Compare, ast.Name, ast.Load, ast.Constant, ast.Call, ast.Attribute,
        ast.Subscript, ast.Tuple, ast.List, ast.IfExp, ast.Slice,
    ) + tuple(_BIN_OPS) + tuple(_CMP_OPS)
    if not isinstance(node, allowed):
        raise UnsafeExpression(f"'{type(node).__name__}' is not allowed in a rule")
    if isinstance(node, ast.Name) and node.id.startswith("_"):
        raise UnsafeExpression(f"name '{node.id}' is not allowed")
    if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
        raise UnsafeExpression(f"attribute '{node.attr}' is not allowed")
    if isinstance(node, ast.Constant) and not isinstance(node.value, (str, int, float, bool, type(None))):
        raise UnsafeExpression("only text, numbers and booleans may be written as constants")
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name):
            if node.func.id not in FUNCTIONS:
                raise UnsafeExpression(f"function '{node.func.id}' is not allowed")
        elif not isinstance(node.func, ast.Attribute):
            raise UnsafeExpression("only named functions and methods may be called")
        if node.keywords:
            raise UnsafeExpression("keyword arguments are not allowed")


def _eval(node: ast.AST, context: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Expression):
        return _eval(node.body, context)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id in context:
            return context[node.id]
        if node.id in FUNCTIONS:
            return FUNCTIONS[node.id]
        raise UnsafeExpression(f"unknown name '{node.id}'")
    if isinstance(node, ast.BoolOp):
        if isinstance(node.op, ast.And):
            result = True
            for value in node.values:
                result = _eval(value, context)
                if not result:
                    return result
            return result
        result = False
        for value in node.values:
            result = _eval(value, context)
            if result:
                return result
        return result
    if isinstance(node, ast.UnaryOp):
        operand = _eval(node.operand, context)
        if isinstance(node.op, ast.Not):
            return not operand
        if isinstance(node.op, ast.USub):
            return -operand
        return +operand
    if isinstance(node, ast.BinOp):
        left = _eval(node.left, context)
        right = _eval(node.right, context)
        if isinstance(left, str) and isinstance(node.op, ast.Mult) or isinstance(right, str) and isinstance(node.op, ast.Mult):
            raise UnsafeExpression("text cannot be multiplied")
        return _BIN_OPS[type(node.op)](left, right)
    if isinstance(node, ast.Compare):
        left = _eval(node.left, context)
        for op, comparator in zip(node.ops, node.comparators):
            right = _eval(comparator, context)
            if not _CMP_OPS[type(op)](left, right):
                return False
            left = right
        return True
    if isinstance(node, ast.IfExp):
        return _eval(node.body, context) if _eval(node.test, context) else _eval(node.orelse, context)
    if isinstance(node, (ast.Tuple, ast.List)):
        return [_eval(element, context) for element in node.elts]
    if isinstance(node, ast.Subscript):
        value = _eval(node.value, context)
        if isinstance(node.slice, ast.Slice):
            lower = _eval(node.slice.lower, context) if node.slice.lower else None
            upper = _eval(node.slice.upper, context) if node.slice.upper else None
            return value[lower:upper]
        return value[_eval(node.slice, context)]
    if isinstance(node, ast.Attribute):
        return _method(node, context)
    if isinstance(node, ast.Call):
        args = [_eval(arg, context) for arg in node.args]
        if isinstance(node.func, ast.Name):
            return FUNCTIONS[node.func.id](*args)
        return _method(node.func, context)(*args)
    raise UnsafeExpression(f"'{type(node).__name__}' is not allowed in a rule")


def _method(node: ast.Attribute, context: Dict[str, Any]) -> Any:
    value = _eval(node.value, context)
    for kind, names in METHODS.items():
        if isinstance(value, kind):
            if node.attr in names:
                return getattr(value, node.attr)
            break
    raise UnsafeExpression(f"'.{node.attr}' is not allowed on this value")


def safe_eval(expression: str, context: Dict[str, Any]) -> Any:
    """Evaluate a rule expression against a context of plain values."""
    tree = parse(expression)
    return _eval(tree, dict(context))


def validate(expression: str) -> None:
    """Raise UnsafeExpression when an expression would be rejected; used when a rule is saved."""
    parse(expression)
