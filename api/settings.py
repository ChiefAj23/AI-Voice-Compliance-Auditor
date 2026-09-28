"""
Runtime configuration, read once from the environment.

Every secret and every deployment-specific value lives here, so a container or a server can be
configured without touching code. In production (APP_ENV=production) the JWT secret is required;
in development a random one is generated per process, which signs everyone out on restart.
"""
import os
import secrets
import warnings
from typing import List

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _secret() -> str:
    value = os.getenv("JWT_SECRET_KEY", "").strip()
    if value and value != "your-secret-key-change-in-production":
        if len(value) < 32:
            warnings.warn("JWT_SECRET_KEY is shorter than 32 characters; use a longer random value.", stacklevel=2)
        return value
    if IS_PRODUCTION:
        raise RuntimeError("JWT_SECRET_KEY must be set in production (for example: openssl rand -hex 32)")
    warnings.warn(
        "JWT_SECRET_KEY is not set: using a random secret for this process, so sessions end when the server restarts.",
        stacklevel=2,
    )
    return secrets.token_hex(32)


JWT_SECRET_KEY: str = _secret()
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# The first administrator. The password comes from the environment; when it is not set, a random
# one is generated at first start and printed once. Either way the account must change it at the
# first login.
ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"
ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@example.com").strip() or "admin@example.com"
ADMIN_INITIAL_PASSWORD: str = os.getenv("ADMIN_INITIAL_PASSWORD", "").strip()

# New accounts: by default only an administrator creates them.
ALLOW_SELF_REGISTRATION: bool = _bool("ALLOW_SELF_REGISTRATION", False)
# The database reset endpoint stays off unless a deployment turns it on.
ALLOW_DB_RESET: bool = _bool("ALLOW_DB_RESET", False)

MIN_PASSWORD_LENGTH: int = int(os.getenv("MIN_PASSWORD_LENGTH", "12"))

CORS_ORIGINS: List[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

# Rate limits, in the "count/period" form (slowapi). The login limit is per client address.
RATE_LIMIT_DEFAULT: str = os.getenv("RATE_LIMIT_DEFAULT", "300/minute")
RATE_LIMIT_LOGIN: str = os.getenv("RATE_LIMIT_LOGIN", "10/minute")
RATE_LIMIT_ANALYZE: str = os.getenv("RATE_LIMIT_ANALYZE", "30/minute")
RATE_LIMITING_ENABLED: bool = _bool("RATE_LIMITING_ENABLED", True)
# Behind a reverse proxy, the client address is in X-Forwarded-For; only trust it when told to.
TRUST_PROXY_HEADERS: bool = _bool("TRUST_PROXY_HEADERS", False)

# Where the SQLite file lives (any SQLAlchemy URL works for the schema this app uses).
DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()

APP_VERSION = "1.1.0"
