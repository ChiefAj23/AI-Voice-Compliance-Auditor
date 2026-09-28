"""
Test setup: the API against a throwaway SQLite database, with the environment the app expects.

The settings module reads the environment when it is first imported, so everything is set here
before `api.main` is imported. Model-backed routes are not exercised: the models load lazily, so
nothing is downloaded by these tests.
"""
import os
import tempfile
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="voice-audit-tests-"))
os.environ.update({
    "APP_ENV": "test",
    "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough-for-tests",
    "ADMIN_USERNAME": "admin",
    "ADMIN_INITIAL_PASSWORD": "Initial-Admin-Pass-123",
    "ALLOW_SELF_REGISTRATION": "false",
    "ALLOW_DB_RESET": "false",
    "RATE_LIMIT_LOGIN": "40/minute",
    "RATE_LIMIT_DEFAULT": "1000/minute",
    "DATABASE_URL": f"sqlite:///{_TMP / 'test.db'}",
})

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

ADMIN_PASSWORD = "Admin-Password-2026!"
VIEWER = {"username": "viewer1", "email": "viewer1@example.com", "password": "Viewer-Password-2026!"}


def _login(client, username, password):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_token(client):
    """The bootstrap admin: forced through its first password change, then signed in."""
    first = _login(client, "admin", os.environ["ADMIN_INITIAL_PASSWORD"])
    assert first["must_change_password"] is True
    headers = {"Authorization": f"Bearer {first['access_token']}"}
    blocked = client.get("/history", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "password_change_required"
    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": os.environ["ADMIN_INITIAL_PASSWORD"], "new_password": ADMIN_PASSWORD},
        headers=headers,
    )
    assert changed.status_code == 200, changed.text
    second = _login(client, "admin", ADMIN_PASSWORD)
    assert second["must_change_password"] is False
    return second["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def viewer_headers(client, admin_headers):
    """A viewer created by the admin, who then sets their own password."""
    created = client.post("/api/auth/register", json=VIEWER, headers=admin_headers)
    assert created.status_code == 200, created.text
    assert created.json()["must_change_password"] is True
    first = _login(client, VIEWER["username"], VIEWER["password"])
    headers = {"Authorization": f"Bearer {first['access_token']}"}
    new_password = VIEWER["password"] + "x"
    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": VIEWER["password"], "new_password": new_password},
        headers=headers,
    )
    assert changed.status_code == 200, changed.text
    token = _login(client, VIEWER["username"], new_password)["access_token"]
    return {"Authorization": f"Bearer {token}"}
