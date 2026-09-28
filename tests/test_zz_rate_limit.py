"""Sign-in is rate limited per client address. Runs last: it uses up the login budget."""


def test_login_is_rate_limited(client):
    statuses = []
    for _ in range(60):
        response = client.post("/api/auth/login", json={"username": "nobody", "password": "nothing"})
        statuses.append(response.status_code)
        if response.status_code == 429:
            break
    assert 429 in statuses
    assert statuses.index(429) <= 41  # the test budget is 40/minute; earlier tests spent some of it
