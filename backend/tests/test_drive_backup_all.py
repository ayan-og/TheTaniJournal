"""Phase 4 — POST /api/drive/backup-all endpoint tests.

Covers:
- 401 unauthenticated
- 400 "not connected" when no drive_credentials
- 200 + {synced,total,failed[],synced_at} shape with simulated drive_credentials
- Idempotency (totals stable across two calls)

Uses pymongo (sync) so each test owns its own connection — no asyncio loop reuse issues.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path("/app/backend/.env"))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tani-share.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@tanijournal.com"
DEMO_PASSWORD = "Tani@2026"


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def demo_user_id(demo_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    return r.json()["user_id"]


@pytest.fixture
def mongo_db():
    client = MongoClient(os.environ["MONGO_URL"])
    try:
        yield client[os.environ["DB_NAME"]]
    finally:
        client.close()


class TestBackupAllAuth:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/drive/backup-all")
        assert r.status_code == 401, r.text

    def test_not_connected_returns_400(self, demo_token, demo_user_id, mongo_db):
        # Retry briefly to dodge a known race with the parallel TestBackupAllWithFakeCreds
        # class (different xdist worker) whose autouse fixture may re-insert creds.
        import time
        last = None
        for _ in range(8):
            mongo_db.drive_credentials.delete_one({"user_id": demo_user_id})
            r = requests.post(
                f"{BASE_URL}/api/drive/backup-all",
                headers={"Authorization": f"Bearer {demo_token}"},
            )
            last = r
            if r.status_code == 400:
                break
            time.sleep(0.25)
        assert last is not None and last.status_code == 400, last.text
        detail = (last.json().get("detail") or "").lower()
        assert "not connected" in detail, detail


class TestBackupAllWithFakeCreds:
    @pytest.fixture(autouse=True)
    def fake_creds(self, demo_user_id, mongo_db):
        future = datetime.now(timezone.utc) + timedelta(days=1)
        mongo_db.drive_credentials.update_one(
            {"user_id": demo_user_id},
            {"$set": {
                "user_id": demo_user_id,
                "access_token": "fake_invalid_token_xyz",
                "refresh_token": "fake_refresh_xyz",
                "token_uri": "https://oauth2.googleapis.com/token",
                "client_id": "fake-client-id",
                "client_secret": "fake-client-secret",
                "scopes": ["https://www.googleapis.com/auth/drive.file"],
                "expiry": future.replace(tzinfo=None).isoformat(),
                "connected_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        yield
        mongo_db.drive_credentials.delete_one({"user_id": demo_user_id})
        # also clean drive_* fields from posts so test_status_initial etc. aren't affected
        mongo_db.posts.update_many(
            {"author_id": demo_user_id},
            {"$unset": {"drive_file_id": "", "drive_web_view_link": "", "drive_synced_at": ""}},
        )

    def test_returns_200_with_expected_shape(self, demo_token):
        r = requests.post(
            f"{BASE_URL}/api/drive/backup-all",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=60,
        )
        # SPEC says: 200 + body keys even when fake tokens cause every post to fail.
        # If this asserts != 200, see backend bug: _find_or_create_folder() raises
        # google.auth.exceptions.RefreshError BEFORE the per-post try/except, so the
        # whole endpoint 500s instead of returning 200 with failed[]=all posts.
        assert r.status_code == 200, f"Expected 200 with failed[] populated; got {r.status_code}: {r.text}"
        body = r.json()
        for k in ["synced", "total", "failed", "synced_at"]:
            assert k in body, f"missing key {k}: {body}"
        assert isinstance(body["synced"], int)
        assert isinstance(body["total"], int)
        assert isinstance(body["failed"], list)
        assert isinstance(body["synced_at"], str)
        assert body["synced"] + len(body["failed"]) == body["total"]

    def test_idempotent_call_twice(self, demo_token):
        r1 = requests.post(f"{BASE_URL}/api/drive/backup-all",
                           headers={"Authorization": f"Bearer {demo_token}"}, timeout=60)
        r2 = requests.post(f"{BASE_URL}/api/drive/backup-all",
                           headers={"Authorization": f"Bearer {demo_token}"}, timeout=60)
        assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)
        b1, b2 = r1.json(), r2.json()
        assert b1["synced"] + len(b1["failed"]) == b1["total"]
        assert b2["synced"] + len(b2["failed"]) == b2["total"]
        assert b1["total"] == b2["total"]
