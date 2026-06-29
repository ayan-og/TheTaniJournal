"""Tani Journal — Phase 3 Google Drive export integration tests.

Covers:
- GET /api/drive/status (auth-gated, returns connected=false initially)
- GET /api/drive/connect (auth-gated, returns authorization_url containing
  expected client_id, scope, redirect_uri)
- POST /api/drive/callback (auth-gated, 400 on bad code, 400 on state mismatch)
- DELETE /api/drive/disconnect (auth-gated, idempotent ok when not connected)
- POST /api/posts/{id}/export-drive (401, 404, 403, 400 not-connected)
"""
import os
import urllib.parse
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tani-share.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = os.environ.get("TANI_DEMO_EMAIL", "demo@tanijournal.com")
DEMO_PASSWORD = os.environ.get("TANI_DEMO_PASSWORD", "Tani@2026")

EXPECTED_CLIENT_ID_PREFIX = "988059460414"
EXPECTED_REDIRECT_HOST = "tani-share.preview.emergentagent.com"
EXPECTED_REDIRECT_PATH = "/drive/callback"
EXPECTED_SCOPE = "https://www.googleapis.com/auth/drive.file"


# --------------- fixtures ---------------
@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def demo_user_id(demo_token):
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {demo_token}"},
    )
    assert r.status_code == 200, r.text
    return r.json()["user_id"]


@pytest.fixture(scope="module")
def secondary_user():
    """A second TEST_ user for cross-user authorization checks."""
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_drive_{suffix}@example.com",
        "password": "TestPass#2026",
        "name": f"TEST Drive {suffix}",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body["session_token"], "user_id": body["user"]["user_id"]}


# --------------- /api/drive/status ---------------
class TestDriveStatus:
    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/drive/status")
        assert r.status_code == 401, r.text

    def test_status_initial(self, demo_token):
        r = requests.get(
            f"{BASE_URL}/api/drive/status",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "connected" in body and "connected_at" in body
        assert body["connected"] is False
        assert body["connected_at"] is None


# --------------- /api/drive/connect ---------------
class TestDriveConnect:
    def test_connect_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/drive/connect")
        assert r.status_code == 401, r.text

    def test_connect_returns_authorization_url(self, demo_token):
        r = requests.get(
            f"{BASE_URL}/api/drive/connect",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 200, r.text
        url = r.json().get("authorization_url", "")
        assert url.startswith("https://accounts.google.com/o/oauth2/auth"), url

        parsed = urllib.parse.urlparse(url)
        qs = urllib.parse.parse_qs(parsed.query)
        # client_id (full or partial match)
        assert EXPECTED_CLIENT_ID_PREFIX in (qs.get("client_id", [""])[0]), qs
        # scope must include drive.file
        assert EXPECTED_SCOPE in (qs.get("scope", [""])[0]), qs
        # redirect_uri points to our frontend callback
        redirect = qs.get("redirect_uri", [""])[0]
        assert EXPECTED_REDIRECT_HOST in redirect, redirect
        assert redirect.endswith(EXPECTED_REDIRECT_PATH), redirect
        # response_type code
        assert qs.get("response_type", [""])[0] == "code", qs

    def test_connect_url_scope_url_encoded(self, demo_token):
        """Raw URL should contain the URL-encoded scope value."""
        r = requests.get(
            f"{BASE_URL}/api/drive/connect",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 200
        url = r.json()["authorization_url"]
        # %3A is URL-encoded ':' — scope=https%3A//www.googleapis.com/auth/drive.file
        assert "scope=https%3A" in url, url
        assert "drive.file" in url, url


# --------------- /api/drive/callback ---------------
class TestDriveCallback:
    def test_callback_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/drive/callback",
            json={"code": "anything"},
        )
        assert r.status_code == 401, r.text

    def test_callback_bad_code_returns_400(self, demo_token):
        r = requests.post(
            f"{BASE_URL}/api/drive/callback",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"code": "invalid-code-xyz"},
        )
        assert r.status_code == 400, r.text

    def test_callback_state_mismatch_returns_400(self, demo_token):
        r = requests.post(
            f"{BASE_URL}/api/drive/callback",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"code": "anything", "state": "definitely-not-the-user-id"},
        )
        assert r.status_code == 400, r.text

    def test_callback_missing_code_returns_422(self, demo_token):
        """Pydantic validation: missing required 'code' field => 422."""
        r = requests.post(
            f"{BASE_URL}/api/drive/callback",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"state": "x"},
        )
        assert r.status_code == 422, r.text


# --------------- /api/drive/disconnect (idempotent) ---------------
class TestDriveDisconnect:
    def test_disconnect_requires_auth(self):
        r = requests.delete(f"{BASE_URL}/api/drive/disconnect")
        assert r.status_code == 401, r.text

    def test_disconnect_idempotent_when_not_connected(self, demo_token):
        r = requests.delete(
            f"{BASE_URL}/api/drive/disconnect",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True


# --------------- /api/posts/{id}/export-drive ---------------
class TestExportDrive:
    @pytest.fixture(scope="class")
    def demo_post_id(self, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "title": "TEST_Drive_Export",
                "content": "<p>drive content</p>",
                "tags": [],
                "visibility": "public",
            },
            headers=h,
        )
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{BASE_URL}/api/posts/{pid}", headers=h)

    def test_export_requires_auth(self, demo_post_id):
        r = requests.post(f"{BASE_URL}/api/posts/{demo_post_id}/export-drive")
        assert r.status_code == 401, r.text

    def test_export_nonexistent_post_404(self, demo_token):
        r = requests.post(
            f"{BASE_URL}/api/posts/no-such-post-id-xxx/export-drive",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 404, r.text

    def test_export_other_users_post_403(self, demo_post_id, secondary_user):
        r = requests.post(
            f"{BASE_URL}/api/posts/{demo_post_id}/export-drive",
            headers={"Authorization": f"Bearer {secondary_user['token']}"},
        )
        assert r.status_code == 403, r.text

    def test_export_not_connected_400(self, demo_token, demo_post_id):
        # Make sure not connected first
        requests.delete(
            f"{BASE_URL}/api/drive/disconnect",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        r = requests.post(
            f"{BASE_URL}/api/posts/{demo_post_id}/export-drive",
            headers={"Authorization": f"Bearer {demo_token}"},
        )
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "not connected" in detail, detail
