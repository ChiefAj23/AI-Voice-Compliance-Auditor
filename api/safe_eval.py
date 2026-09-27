"""
A small, safe evaluator for custom compliance rules.

Custom rules are expressions like ``toxicity_score > 0.7 and "refund" in text.lower()``. They
used to go through Python's eval(), which even with empty builtins can reach Python internals
through attributes (``().__class__...``). This walks the parsed expression instead and allows
only what a rule needs: comparisons, and/or/not, arithmetic, the rule's variables, a few pure
functions and read-only string and dict methods.
"""
import ast
import operator
from typing import Any, Callable, Dict

MAX_EXPRESSION_LENGTH = 1000
MAX_RESULT_LENGTH = 100_000  # longest string or list an expression may build

_BIN_OPS: Dict[type, Callable[[Any, Any], Any]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_CMP_OPS: Dict[type, Callable[[Any, Any], bool]] = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
    ast.Is: operator.is_,
    ast.IsNot: operator.is_not,
}
_FUNCTIONS: Dict[str, Callable[..., Any]] = {
    "len": len,
    "str": str,
    "float": float,
    "int": int,
    "bool": bool,
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
    "any": any,
    "all": all,
}
_STR_METHODS = {
    "lower", "upper", "strip", "lstrip", "rstrip", "startswith", "endswith", "count", "find",
    "split", "replace", "isdigit", "isalpha", "isspace",
}
_DICT_METHODS = {"get", "keys", "values", "items"}
_LIST_METHODS = {"count", "index"}


class UnsafeExpression(ValueError):
    """The expression uses something custom rules don't allow."""


def safe_eval(expression: str, variables: Dict[str, Any]) -> Any:
    """Evaluate a custom rule expression against ``variables`` without eval()."""
    if not isinstance(expression, str) or not expression.strip():
        raise UnsafeExpression("The expression is empty")
    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise UnsafeExpression(f"The expression is longer than {MAX_EXPRESSION_LENGTH} characters")
    try:
        tree = ast.parse(expression.strip(), mode="eval")
    except SyntaxError as e:
        raise UnsafeExpression(f"Syntax error: {e.msg}") from None
    return _Evaluator(variables).visit(tree.body)


def _check_size(value: Any) -> Any:
    if isinstance(value, (str, list, tuple)) and len(value) > MAX_RESULT_LENGTH:
        raise UnsafeExpression("The expression builds a value that is too large")
    return value


class _Evaluator:
    def __init__(self, variables: Dict[str, Any]):
        self.variables = variables

    def visit(self, node: ast.AST) -> Any:
        method = getattr(self, f"visit_{type(node).__name__}", None)
        if method is None:
            raise UnsafeExpression(f"'{type(node).__name__}' is not allowed in a custom rule")
        return method(node)

    def visit_Constant(self, node: ast.Constant) -> Any:
        if not isinstance(node.value, (str, int, float, bool, type(None))):
            raise UnsafeExpression("Only text, numbers, True, False and None are allowed as values")
        return node.value

    def visit_Name(self, node: ast.Name) -> Any:
        if node.id.startswith("_"):
            raise UnsafeExpression(f"'{node.id}' is not allowed")
        if node.id in self.variables:
            return self.variables[node.id]
        if node.id in _FUNCTIONS:
            return _FUNCTIONS[node.id]
        if node.id in ("True", "False", "None"):  # Python < 3.8 parses these as names
            return {"True": True, "False": False, "None": None}[node.id]
        raise UnsafeExpression(f"Unknown name '{node.id}'")

    def visit_List(self, node: ast.List) -> Any:
        return _check_size([self.visit(e) for e in node.elts])

    def visit_Tuple(self, node: ast.Tuple) -> Any:
        return _check_size(tuple(self.visit(e) for e in node.elts))

    def visit_Set(self, node: ast.Set) -> Any:
        return {self.visit(e) for e in node.elts}

    def visit_BoolOp(self, node: ast.BoolOp) -> Any:
        if isinstance(node.op, ast.And):
            result: Any = True
            for value in node.values:
                result = self.visit(value)
                if not result:
                    return result
            return result
        result = False
        for value in node.values:
            result = self.visit(value)
            if result:
                return result
        return result

    def visit_UnaryOp(self, node: ast.UnaryOp) -> Any:
        operand = self.visit(node.operand)
        if isinstance(node.op, ast.Not):
            return not operand
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return +operand
        raise UnsafeExpression("That operator is not allowed")

    def visit_BinOp(self, node: ast.BinOp) -> Any:
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise UnsafeExpression("That operator is not allowed (use + - * / // %)")
        left, right = self.visit(node.left), self.visit(node.right)
        if isinstance(node.op, ast.Mult) and (isinstance(left, (str, list, tuple)) or isinstance(right, (str, list, tuple))):
            raise UnsafeExpression("Repeating text or lists with * is not allowed")
        return _check_size(op(left, right))

    def visit_Compare(self, node: ast.Compare) -> bool:
        left = self.visit(node.left)
        for op_node, comparator in zip(node.ops, node.comparators):
            op = _CMP_OPS.get(type(op_node))
            if op is None:
                raise UnsafeExpression("That comparison is not allowed")
            right = self.visit(comparator)
            if not op(left, right):
                return False
            left = right
        return True

    def visit_IfExp(self, node: ast.IfExp) -> Any:
        return self.visit(node.body) if self.visit(node.test) else self.visit(node.orelse)

    def visit_Subscript(self, node: ast.Subscript) -> Any:
        value = self.visit(node.value)
        if not isinstance(value, (dict, list, tuple, str)):
            raise UnsafeExpression("Only text, lists and dictionaries can be indexed")
        index_node = node.slice
        if isinstance(index_node, ast.Slice):
            lower = self.visit(index_node.lower) if index_node.lower else None
            upper = self.visit(index_node.upper) if index_node.upper else None
            if index_node.step is not None:
                raise UnsafeExpression("Slice steps are not allowed")
            return value[lower:upper]
        if type(index_node).__name__ == "Index":  # Python < 3.9
            index_node = index_node.value  # type: ignore[attr-defined]
        return value[self.visit(index_node)]

    def visit_Call(self, node: ast.Call) -> Any:
        if node.keywords:
            raise UnsafeExpression("Keyword arguments are not allowed")
        args = [self.visit(a) for a in node.args]
        if isinstance(node.func, ast.Name):
            func = self.visit_Name(node.func)
            if func not in _FUNCTIONS.values():
                raise UnsafeExpression(f"'{node.func.id}' can't be called")
            return _check_size(func(*args))
        if isinstance(node.func, ast.Attribute):
            owner = self.visit(node.func.value)
            name = node.func.attr
            allowed = (
                _STR_METHODS if isinstance(owner, str)
                else _DICT_METHODS if isinstance(owner, dict)
                else _LIST_METHODS if isinstance(owner, (list, tuple))
                else set()
            )
            if name.startswith("_") or name not in allowed:
                raise UnsafeExpression(f"'.{name}()' is not allowed")
            result = getattr(owner, name)(*args)
            if name in ("keys", "values", "items"):
                result = list(result)
            return _check_size(result)
        raise UnsafeExpression("Only plain function and method calls are allowed")

    def visit_Attribute(self, node: ast.Attribute) -> Any:
        # Attributes are only reachable through the method calls above.
        raise UnsafeExpression(f"'.{node.attr}' is not allowed (call a text or dictionary method instead)")
