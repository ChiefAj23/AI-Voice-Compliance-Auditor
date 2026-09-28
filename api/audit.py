"""
The audit trail: who did what, when, from where.

Two sources feed it. A middleware records every request that changes something (anything but GET,
HEAD and OPTIONS) with the signed-in user, the path, the outcome and the client address, without
request bodies, so passwords and recordings never land in the log. Routes that matter for
security (sign-in, sign-in failures, password changes, database resets) also record explicit
events with a little detail. Reading the log needs the audit:read permission.
"""
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import Request
import jwt
from jwt import InvalidTokenError
from starlette.middleware.base import BaseHTTPMiddleware

from . import settings
from .database import AuditLog, SessionLocal, User

# Requests that never need a row of their own: these routes record their own, clearer events.
SKIP_PATHS = {
    "/api/auth/login",
    "/api/auth/change-password",
    "/api/auth/register",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def client_ip(request: Request) -> Optional[str]:
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def record(
    db,
    *,
    action: str,
    request: Optional[Request] = None,
    user: Optional[User] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    status: str = "success",
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Write one audit row. Never raises: an audit failure must not break the request."""
    try:
        row = AuditLog(
            timestamp=datetime.utcnow(),
            user_id=user.id if user else None,
            username=user.username if user else username,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            status=status,
            ip_address=client_ip(request) if request else None,
            user_agent=(request.headers.get("user-agent", "")[:300] if request else None),
            details=details,
        )
        db.add(row)
        db.commit()
    except Exception as e:  # pragma: no cover - defensive
        db.rollback()
        print(f"audit: could not write '{action}': {e}")


def _username_from_request(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except InvalidTokenError:
        return None


def _resource(path: str):
    """('compliance_rules', '12') for /compliance_rules/12, ('users', None) for /api/users."""
    parts = [p for p in path.split("/") if p and p != "api"]
    if not parts:
        return None, None
    resource_type = parts[0]
    resource_id = None
    for part in parts[1:]:
        if part.isdigit():
            resource_id = part
            break
    return resource_type, resource_id


class AuditMiddleware(BaseHTTPMiddleware):
    """Records every mutating request after it completes, with its status code."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method in ("GET", "HEAD", "OPTIONS") or request.url.path in SKIP_PATHS:
            return response
        username = _username_from_request(request)
        resource_type, resource_id = _resource(request.url.path)
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first() if username else None
            record(
                db,
                action=f"{request.method} {request.url.path}",
                request=request,
                user=user,
                username=username,
                resource_type=resource_type,
                resource_id=resource_id,
                status="success" if response.status_code < 400 else "failure",
                details={"status_code": response.status_code},
            )
        finally:
            db.close()
        return response
