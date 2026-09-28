"""
Test setup: the API against a throwaway SQLite database, with the environment the app expects.

The settings module reads the environment when it is first imported, so everything is set here
before `api.main` is imported. No test here loads a model (they load on first use), and when the
ML libraries are not installed at all (pip install -r requirements-test.txt), the modules that
need them are replaced by stubs so the security tests still run anywhere in seconds.
"""
import importlib.util
import os
import sys
import tempfile
import types
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="voice-audit-tests-"))
os.environ.update({
    "APP_ENV": "test",
    "JWT_SECRET_KEY": "test-secret-" + "0" * 40,
    "ADMIN_USERNAME": "admin",
    "ADMIN_PASSWORD": "Initial-Admin-Pass-123",
    "ALLOW_SELF_REGISTRATION": "false",
    "ALLOW_DB_RESET": "false",
    "RATE_LIMIT_LOGIN": "40/minute",
    "RATE_LIMIT_DEFAULT": "1000/minute",
    "DATABASE_URL": f"sqlite:///{_TMP / 'test.db'}",
})

ML_LIBRARIES = ("torch", "transformers", "whisper", "detoxify", "shap", "librosa")
ML_INSTALLED = all(importlib.util.find_spec(name) for name in ML_LIBRARIES)


def _stub(name, **attrs):
    module = types.ModuleType(name)
    module.__dict__.update(attrs)
    sys.modules[name] = module


def _none(*args, **kwargs):
    return {}


if not ML_INSTALLED:
    _stub("whisper", load_model=lambda *a, **k: None)
    _stub("api.model", analyze_text=_none)
    _stub("api.explain", explain_toxicity=_none)
    _stub("api.explain_enhanced", comprehensive_explanation=_none)
    _stub("api.multilanguage", transcribe_with_language=_none, detect_language_from_text=_none,
          get_supported_languages=lambda: {"en": "English"})
    _stub("api.speaker_diarization", simple_speaker_segmentation=_none, analyze_speaker_turns=_none,
          create_speaker_timeline=_none)
    _stub("api.audio_quality", analyze_audio_quality=_none)
    _stub("api.summarization", summarize_conversation=_none)
    _stub("api.topic_extraction", extract_topics=_none)
    _stub("api.intent_classification", classify_intent=_none)
    _stub("api.sentiment_timeline", create_sentiment_timeline=_none)

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
    """The first admin: forced through its first password change, then signed in."""
    first = _login(client, "admin", os.environ["ADMIN_PASSWORD"])
    assert first["must_change_password"] is True
    headers = {"Authorization": f"Bearer {first['access_token']}"}
    blocked = client.get("/history", headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "password_change_required"
    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": os.environ["ADMIN_PASSWORD"], "new_password": ADMIN_PASSWORD},
        headers=headers,
    )
    assert changed.status_code == 200, changed.text
    second = _login(client, "admin", ADMIN_PASSWORD)
    assert second["must_change_password"] is False
    return second["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def grant_role(client, admin_headers, user_id, role_name):
    roles = client.get("/api/roles", headers=admin_headers).json()
    role = next(role for role in roles if role["name"] == role_name)
    response = client.post(f"/api/users/{user_id}/roles", json={"role_id": role["id"]}, headers=admin_headers)
    assert response.status_code == 200, response.text


@pytest.fixture(scope="session")
def viewer_headers(client, admin_headers):
    """A viewer created by the admin, given the viewer role, who then sets their own password."""
    created = client.post("/api/auth/register", json=VIEWER, headers=admin_headers)
    assert created.status_code == 200, created.text
    assert created.json()["must_change_password"] is True
    assert created.json()["roles"] == []  # new accounts start with no role
    grant_role(client, admin_headers, created.json()["id"], "viewer")
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
