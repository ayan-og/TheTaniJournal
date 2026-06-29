"""Tani Journal — Comprehensive backend API tests.
Covers: auth (register/login/me/logout/emergent-session reject),
presence (heartbeat/status), posts CRUD with auth, public/private visibility,
comments, reports, profile endpoints, list filters & pagination.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tani-share.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@tanijournal.com"
DEMO_PASSWORD = "Tani@2026"

# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def s():
    # Cookieless session — Bearer-only auth in tests to avoid cookie precedence over header
    return requests

@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]

@pytest.fixture(scope="session")
def demo_user_id(demo_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    return r.json()["user_id"]

@pytest.fixture(scope="session")
def secondary_user():
    """Register a TEST_ user used for non-author flows (comments/reports/403 checks)."""
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_user_{suffix}@example.com",
        "password": "TestPass#2026",
        "name": f"TEST User {suffix}",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["session_token"], "user_id": data["user"]["user_id"], "email": payload["email"]}


# ---------------- auth ----------------
class TestAuth:
    def test_login_demo(self, demo_token):
        assert isinstance(demo_token, str) and len(demo_token) > 10

    def test_login_invalid(self, s):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_login(self):
        suffix = uuid.uuid4().hex[:8]
        email = f"test_reg_{suffix}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Abc123!!", "name": "TEST Reg"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == email.lower()
        assert "session_token" in body and len(body["session_token"]) > 10
        # duplicate
        r2 = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Abc123!!", "name": "Dup"})
        assert r2.status_code == 400

    def test_me_with_bearer(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_without_token(self, s):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_logout(self, s):
        # login fresh, logout, then auth/me should 401
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        tok = r.json()["session_token"]
        rl = requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {tok}"})
        assert rl.status_code == 200
        rme = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert rme.status_code == 401

    def test_emergent_session_fake_rejected(self, s):
        r = s.post(f"{BASE_URL}/api/auth/session", json={"session_id": "not-a-real-session"})
        # should fail gracefully (401) — not crash with 500
        assert r.status_code in (400, 401), f"Got {r.status_code}: {r.text}"

    def test_emergent_session_missing_id(self, s):
        r = s.post(f"{BASE_URL}/api/auth/session", json={})
        assert r.status_code == 400


# ---------------- presence ----------------
class TestPresence:
    def test_heartbeat(self, s, demo_token):
        r = s.post(f"{BASE_URL}/api/presence/heartbeat", headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert "last_seen" in r.json()

    def test_heartbeat_requires_auth(self, s):
        r = requests.post(f"{BASE_URL}/api/presence/heartbeat")
        assert r.status_code == 401

    def test_status_returns_online_after_heartbeat(self, s, demo_token, demo_user_id):
        # ensure recent
        s.post(f"{BASE_URL}/api/presence/heartbeat", headers={"Authorization": f"Bearer {demo_token}"})
        r = s.get(f"{BASE_URL}/api/presence/status?user_ids={demo_user_id}")
        assert r.status_code == 200
        out = r.json()["online"]
        assert out.get(demo_user_id) is True


# ---------------- posts CRUD ----------------
class TestPostsCRUD:
    def test_list_public_no_auth(self, s):
        r = requests.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body and "total" in body
        assert isinstance(body["items"], list)

    def test_unauth_create_rejected(self, s):
        r = requests.post(f"{BASE_URL}/api/posts", json={"title": "x", "content": "<p>x</p>"})
        assert r.status_code == 401

    def test_full_crud_and_visibility(self, s, demo_token, demo_user_id, secondary_user):
        h = {"Authorization": f"Bearer {demo_token}"}
        # CREATE public
        payload = {
            "title": "TEST_Post Title",
            "content": "<p>hello <strong>world</strong></p>",
            "tags": ["TestTag", "morning"],
            "visibility": "public",
        }
        r = requests.post(f"{BASE_URL}/api/posts", json=payload, headers=h)
        assert r.status_code == 200, r.text
        post = r.json()
        post_id = post["id"]
        assert post["author_id"] == demo_user_id
        assert post["visibility"] == "public"
        assert "testtag" in post["tags"]  # lowercased

        # GET by id (anon)
        rg = requests.get(f"{BASE_URL}/api/posts/{post_id}")
        assert rg.status_code == 200
        assert rg.json()["title"] == "TEST_Post Title"

        # UPDATE
        ru = requests.put(f"{BASE_URL}/api/posts/{post_id}", json={"title": "TEST_Updated"}, headers=h)
        assert ru.status_code == 200
        assert ru.json()["title"] == "TEST_Updated"
        # verify persistence
        rg2 = requests.get(f"{BASE_URL}/api/posts/{post_id}")
        assert rg2.json()["title"] == "TEST_Updated"

        # Non-author update => 403
        h2 = {"Authorization": f"Bearer {secondary_user['token']}"}
        r403 = requests.put(f"{BASE_URL}/api/posts/{post_id}", json={"title": "hack"}, headers=h2)
        assert r403.status_code == 403

        # Non-author delete => 403
        rd403 = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=h2)
        assert rd403.status_code == 403

        # Toggle to private
        rpriv = requests.put(f"{BASE_URL}/api/posts/{post_id}", json={"visibility": "private"}, headers=h)
        assert rpriv.status_code == 200
        # anon GET => 403
        ranon = requests.get(f"{BASE_URL}/api/posts/{post_id}")
        assert ranon.status_code == 403
        # author can still see
        rauth = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=h)
        assert rauth.status_code == 200

        # DELETE by author
        rdel = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=h)
        assert rdel.status_code == 200
        # confirm gone
        rgone = requests.get(f"{BASE_URL}/api/posts/{post_id}")
        assert rgone.status_code == 404

    def test_list_query_params(self, s, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        # create unique-tagged post
        unique_tag = f"testtag-{uuid.uuid4().hex[:6]}"
        unique_title = f"TEST_Searchable {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"title": unique_title, "content": "<p>content body</p>", "tags": [unique_tag], "visibility": "public"},
            headers=h,
        )
        pid = r.json()["id"]
        try:
            # filter by tag
            rt = requests.get(f"{BASE_URL}/api/posts?tag={unique_tag}")
            assert rt.status_code == 200
            assert rt.json()["total"] >= 1
            # search query
            rq = requests.get(f"{BASE_URL}/api/posts?q=Searchable")
            assert rq.status_code == 200
            assert any(unique_title == it["title"] for it in rq.json()["items"]) or rq.json()["total"] >= 1
            # pagination
            rp = requests.get(f"{BASE_URL}/api/posts?page=1&limit=1")
            assert rp.status_code == 200
            assert len(rp.json()["items"]) <= 1
            assert "total" in rp.json()
        finally:
            requests.delete(f"{BASE_URL}/api/posts/{pid}", headers=h)


# ---------------- comments & reports ----------------
class TestCommentsReports:
    @pytest.fixture(scope="class")
    def public_post(self, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"title": "TEST_Commentable", "content": "<p>c</p>", "tags": [], "visibility": "public"},
            headers=h,
        )
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{BASE_URL}/api/posts/{pid}", headers=h)

    def test_comment_flow(self, public_post, secondary_user):
        h = {"Authorization": f"Bearer {secondary_user['token']}"}
        r = requests.post(f"{BASE_URL}/api/posts/{public_post}/comments", json={"content": "great"}, headers=h)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["author_id"] == secondary_user["user_id"]
        rl = requests.get(f"{BASE_URL}/api/posts/{public_post}/comments")
        assert rl.status_code == 200
        assert any(c["id"] == cid for c in rl.json()["items"])
        # report the comment
        rr = requests.post(f"{BASE_URL}/api/comments/{cid}/report", json={"reason": "TEST spam"}, headers=h)
        assert rr.status_code == 200

    def test_comment_unauth(self, public_post):
        r = requests.post(f"{BASE_URL}/api/posts/{public_post}/comments", json={"content": "x"})
        assert r.status_code == 401

    def test_report_post(self, public_post, secondary_user):
        h = {"Authorization": f"Bearer {secondary_user['token']}"}
        r = requests.post(f"{BASE_URL}/api/posts/{public_post}/report", json={"reason": "TEST off-topic"}, headers=h)
        assert r.status_code == 200


# ---------------- profile ----------------
class TestProfile:
    def test_get_user(self, demo_user_id):
        r = requests.get(f"{BASE_URL}/api/users/{demo_user_id}")
        assert r.status_code == 200
        assert r.json()["user_id"] == demo_user_id

    def test_get_user_posts_only_public(self, demo_token, demo_user_id):
        h = {"Authorization": f"Bearer {demo_token}"}
        # create one private + one public
        rpub = requests.post(f"{BASE_URL}/api/posts", json={"title": "TEST_PubProf", "content": "<p>p</p>", "visibility": "public"}, headers=h)
        rpriv = requests.post(f"{BASE_URL}/api/posts", json={"title": "TEST_PrivProf", "content": "<p>p</p>", "visibility": "private"}, headers=h)
        pub_id = rpub.json()["id"]; priv_id = rpriv.json()["id"]
        try:
            r = requests.get(f"{BASE_URL}/api/users/{demo_user_id}/posts")
            assert r.status_code == 200
            ids = [p["id"] for p in r.json()["items"]]
            assert pub_id in ids
            assert priv_id not in ids
        finally:
            requests.delete(f"{BASE_URL}/api/posts/{pub_id}", headers=h)
            requests.delete(f"{BASE_URL}/api/posts/{priv_id}", headers=h)

    def test_tags_endpoint(self):
        r = requests.get(f"{BASE_URL}/api/posts/tags")
        assert r.status_code == 200
        assert "tags" in r.json()
