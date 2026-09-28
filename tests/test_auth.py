"""Sign-in, permissions, the first-login password change, registration policy, and the audit trail."""
import re

from api.main import app

# Routes anyone may call without signing in. Everything else must reject an anonymous request.
PUBLIC = {
    ("GET", "/health"), ("GET", "/api/auth/config"), ("POST", "/api/auth/login"), ("POST", "/api/auth/register"),
    ("GET", "/supported_languages"),
}


def _sample_path(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", path)


def test_every_route_requires_a_signed_in_user(client):
    unprotected = []
    for route in app.routes:
        methods = getattr(route, "methods", None)
        path = getattr(route, "path", "")
        if not methods or path.startswith(("/docs", "/openapi", "/redoc")):
            continue
        for method in methods:
            if method in ("HEAD", "OPTIONS") or (method, path) in PUBLIC:
                continue
            response = client.request(method, _sample_path(path))
            if response.status_code not in (401, 403):
                unprotected.append((method, path, response.status_code))
    assert unprotected == []


def test_health_is_public_and_says_little(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert set(response.json()) == {"status", "version"}


def test_wrong_password_is_rejected_and_audited(client, admin_headers):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "not-the-password"})
    assert response.status_code == 401
    logs = client.get("/api/audit-logs", params={"action": "auth.login", "status": "failure"}, headers=admin_headers).json()
    assert any(row["username"] == "admin" and row["status"] == "failure" for row in logs["records"])


def test_me_reports_permissions(client, admin_headers, viewer_headers):
    admin = client.get("/api/auth/me", headers=admin_headers).json()
    assert "audit:read" in admin["permissions"] and admin["must_change_password"] is False
    viewer = client.get("/api/auth/me", headers=viewer_headers).json()
    assert viewer["roles"] == ["viewer"]
    assert "analysis:read" in viewer["permissions"] and "analysis:delete" not in viewer["permissions"]


def test_viewer_can_read_but_not_change(client, viewer_headers):
    assert client.get("/history", headers=viewer_headers).status_code == 200
    assert client.get("/compliance_rules", headers=viewer_headers).status_code == 200
    assert client.delete("/history/1", headers=viewer_headers).status_code == 403
    assert client.get("/webhooks", headers=viewer_headers).status_code == 403
    assert client.get("/api/audit-logs", headers=viewer_headers).status_code == 403
    rule = {"name": "x", "rule_type": "keyword", "pattern": "refund", "condition": "contains", "severity": "warning"}
    assert client.post("/compliance_rules", json=rule, headers=viewer_headers).status_code == 403


def test_self_registration_is_off_by_default(client):
    body = {"username": "stranger", "email": "stranger@example.com", "password": "Stranger-Password-2026"}
    assert client.post("/api/auth/register", json=body).status_code == 403


def test_admin_created_users_get_a_password_policy(client, admin_headers):
    body = {"username": "shortpass", "email": "shortpass@example.com", "password": "short"}
    response = client.post("/api/auth/register", json=body, headers=admin_headers)
    assert response.status_code == 400
    assert "at least" in response.json()["detail"]


def test_change_password_needs_the_current_one(client, viewer_headers):
    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong-current", "new_password": "Another-Good-Password-1"},
        headers=viewer_headers,
    )
    assert response.status_code == 400


def test_database_reset_is_disabled_unless_allowed(client, admin_headers):
    response = client.post("/api/admin/reset-database", json={"confirm": True}, headers=admin_headers)
    assert response.status_code == 403
    assert "ALLOW_DB_RESET" in response.json()["detail"]


def test_mutating_requests_land_in_the_audit_log(client, admin_headers):
    rule = {"name": "Audit me", "rule_type": "keyword", "pattern": "guarantee", "condition": "contains", "severity": "warning"}
    created = client.post("/compliance_rules", json=rule, headers=admin_headers)
    assert created.status_code in (200, 201), created.text
    logs = client.get("/api/audit-logs", params={"action": "POST /compliance_rules"}, headers=admin_headers).json()
    assert logs["total"] >= 1
    row = logs["records"][0]
    assert row["username"] == "admin" and row["status"] == "success" and row["resource_type"] == "compliance_rules"
    assert "password" not in str(row["details"])


def test_refused_registration_is_audited(client, admin_headers):
    body = {"username": "stranger2", "email": "stranger2@example.com", "password": "Stranger-Password-2026"}
    assert client.post("/api/auth/register", json=body).status_code == 403
    rows = client.get("/api/audit-logs", params={"action": "user.create", "status": "failure"}, headers=admin_headers).json()
    assert any((row["details"] or {}).get("username") == "stranger2" and row["username"] is None for row in rows["records"])


def test_account_events_are_recorded_once(client, admin_headers):
    body = {"username": "audited", "email": "audited@example.com", "password": "Audited-Password-2026"}
    assert client.post("/api/auth/register", json=body, headers=admin_headers).status_code == 200
    created = client.get("/api/audit-logs", params={"action": "user.create", "status": "success"}, headers=admin_headers).json()
    assert any((row["details"] or {}).get("username") == "audited" for row in created["records"])
    # Sign-in, registration and password changes write their own rows; the generic request row would repeat them.
    generic = client.get("/api/audit-logs", params={"action": "POST /api/auth"}, headers=admin_headers).json()
    assert generic["total"] == 0


def test_bad_rule_patterns_are_rejected_when_saved(client, admin_headers):
    bad_regex = {"name": "bad", "rule_type": "regex", "pattern": "(unclosed", "condition": "matches", "severity": "warning"}
    assert client.post("/compliance_rules", json=bad_regex, headers=admin_headers).status_code == 400
    code = {"name": "evil", "rule_type": "custom", "pattern": "__import__('os').system('id')", "condition": "custom", "severity": "critical"}
    response = client.post("/compliance_rules", json=code, headers=admin_headers)
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]
    good = {"name": "disclosure", "rule_type": "custom", "pattern": '"recorded" not in text.lower()', "condition": "custom", "severity": "warning"}
    assert client.post("/compliance_rules", json=good, headers=admin_headers).status_code in (200, 201)
