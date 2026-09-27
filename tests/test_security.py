"""Security checks: no default credentials, sign-in on every data route, safe custom rules."""
import pytest
from fastapi.testclient import TestClient

from api.safe_eval import UnsafeExpression, safe_eval

VARIABLES = {
    "text": "I can refund you today",
    "analysis": {"emotion": "anger"},
    "sentiment": "NEGATIVE",
    "toxicity_score": 0.82,
    "compliance_score": 55.0,
    "emotion": "anger",
}


@pytest.mark.parametrize("expression, expected", [
    ("toxicity_score > 0.7", True),
    ('"refund" in text.lower() and compliance_score < 60', True),
    ("len(text) > 100", False),
    ('analysis.get("emotion") == "anger"', True),
    ('sentiment in ["NEGATIVE", "neutral"]', True),
    ("not (compliance_score >= 70)", True),
    ("round(toxicity_score * 100) / 100", 0.82),
    ("text.split()[0]", "I"),
    ("text[:5].upper()", "I CAN"),
    ("max(toxicity_score, 0.9)", 0.9),
    ('"high" if toxicity_score > 0.5 else "low"', "high"),
])
def test_custom_rules_still_work(expression, expected):
    assert safe_eval(expression, VARIABLES) == expected


@pytest.mark.parametrize("expression", [
    "().__class__.__bases__[0].__subclasses__()",
    "text.__class__",
    '__import__("os").system("id")',
    'open("/etc/passwd").read()',
    "getattr(text, 'lower')",
    "(lambda: 1)()",
    "[c for c in text]",
    '"a" * 1000000000',
    "2 ** 1000000",
    "text.format(1)",
    '"{0.__class__}".format(text)',
    'analysis.update({"a": 1})',
    "len(text, x=1)",
    "_hidden",
    "x := 1",
])
def test_custom_rules_cannot_reach_python(expression):
    with pytest.raises(UnsafeExpression):
        safe_eval(expression, VARIABLES)


@pytest.fixture(scope="session")
def client():
    from api.main import app
    with TestClient(app) as c:
        yield c


def sign_in(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return sign_in(client, "admin", "test-admin-password")


def test_there_is_no_default_admin_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 401


def test_the_secret_key_is_never_a_published_example(monkeypatch):
    import api.auth as auth
    monkeypatch.setenv("JWT_SECRET_KEY", "your-very-secure-secret-key-here-change-in-production")
    assert auth._load_secret_key() not in auth._PLACEHOLDER_SECRETS
    monkeypatch.delenv("JWT_SECRET_KEY")
    key = auth._load_secret_key()
    assert len(key) == 64 and key not in auth._PLACEHOLDER_SECRETS
    assert auth._load_secret_key() != key  # random each time, not a constant


def test_a_generated_admin_password_signs_in(client, monkeypatch):
    import api.database as database
    from api.auth import ensure_admin_user
    monkeypatch.setenv("ADMIN_USERNAME", "second-admin")
    monkeypatch.delenv("ADMIN_PASSWORD")
    db = database.SessionLocal()
    try:
        password = ensure_admin_user(db)
        assert password and len(password) >= 16
        assert ensure_admin_user(db) is None  # created once
    finally:
        db.close()
    sign_in(client, "second-admin", password)


@pytest.mark.parametrize("method, path", [
    ("post", "/analyze_audio"), ("post", "/analyze_batch"), ("post", "/generate_report"),
    ("get", "/history"), ("get", "/history/1"), ("delete", "/history/1"), ("get", "/statistics"),
    ("get", "/export/csv"), ("get", "/export/json/all"), ("get", "/export/json/1"), ("post", "/compare"),
    ("get", "/compliance_rules"), ("post", "/compliance_rules"), ("put", "/compliance_rules/1"),
    ("delete", "/compliance_rules/1"), ("post", "/compliance_rules/1/test"),
    ("get", "/scheduled_reports"), ("post", "/scheduled_reports"), ("post", "/scheduled_reports/1/run_now"),
    ("get", "/webhooks"), ("post", "/webhooks"), ("post", "/webhooks/1/test"),
    ("get", "/notification_configs"), ("post", "/notification_configs"), ("post", "/notification_configs/1/test"),
])
def test_data_routes_need_sign_in(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_public_routes_stay_public(client):
    assert client.get("/supported_languages").status_code == 200


def test_a_new_account_sees_nothing_until_an_admin_grants_a_role(client, admin):
    r = client.post("/api/auth/register", json={
        "username": "newcomer", "email": "newcomer@example.com", "password": "a-long-password",
    })
    assert r.status_code == 200, r.text
    user_id = r.json()["id"]
    user = sign_in(client, "newcomer", "a-long-password")
    assert client.get("/history", headers=user).status_code == 403

    roles = client.get("/api/roles", headers=admin).json()
    viewer = next(role for role in roles if role["name"] == "viewer")
    assert client.post(f"/api/users/{user_id}/roles", json={"role_id": viewer["id"]}, headers=admin).status_code == 200

    assert client.get("/history", headers=user).status_code == 200
    assert client.get("/compliance_rules", headers=user).status_code == 200
    rule = {"name": "x", "rule_type": "keyword", "pattern": "refund", "condition": "contains"}
    assert client.post("/compliance_rules", json=rule, headers=user).status_code == 403
    assert client.get("/webhooks", headers=user).status_code == 403
    assert client.get("/scheduled_reports", headers=user).status_code == 403


def test_a_custom_rule_cannot_escape_through_the_api(client, admin):
    rule = {"name": "escape attempt", "rule_type": "custom", "condition": "custom",
            "pattern": "().__class__.__bases__[0].__subclasses__()"}
    r = client.post("/compliance_rules", json=rule, headers=admin)
    assert r.status_code == 200, r.text
    result = client.post(f"/compliance_rules/{r.json()['id']}/test", params={"text": "hello"}, headers=admin)
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["matched"] is False and "not allowed" in (body["message"] or "")

    ok = {"name": "angry and toxic", "rule_type": "custom", "condition": "custom",
          "pattern": 'toxicity_score > 0.7 and "refund" in text.lower()'}
    r = client.post("/compliance_rules", json=ok, headers=admin)
    result = client.post(f"/compliance_rules/{r.json()['id']}/test", params={"text": "About your refund"},
                         json={"toxicity_score": 0.9, "sentiment": "NEGATIVE", "compliance_score": 40.0, "emotion": "anger"},
                         headers=admin)
    assert result.status_code == 200 and result.json()["matched"] is True, result.text
