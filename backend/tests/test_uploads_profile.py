"""Tani Journal — Phase 2 tests: file uploads, file download, profile PUT.

Tests:
- POST /api/upload: 200 (PNG), 401 (no auth), 415 (text/plain), 413 (>5MB).
- GET /api/files/{path}: 200 with image/png, 404 on random path.
- PUT /api/users/me: auth update name/bio/picture; 401 without auth.
"""
import io
import os
import struct
import uuid
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tani-share.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = os.environ.get("TANI_DEMO_EMAIL", "demo@tanijournal.com")
DEMO_PASSWORD = os.environ.get("TANI_DEMO_PASSWORD", "Tani@2026")


def _make_png(width: int = 1, height: int = 1) -> bytes:
    """Build a tiny valid PNG entirely in-memory (no external deps)."""
    sig = b"\x89PNG\r\n\x1a\n"

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    raw = b""
    for _ in range(height):
        raw += b"\x00" + b"\xff\x00\x00" * width  # red pixels with filter byte
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


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
        f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {demo_token}"}
    )
    assert r.status_code == 200, r.text
    return r.json()["user_id"]


@pytest.fixture(scope="module")
def uploaded_png(demo_token):
    """Upload a PNG once and reuse for download / persistence tests."""
    png = _make_png()
    files = {"file": ("tiny.png", io.BytesIO(png), "image/png")}
    r = requests.post(
        f"{BASE_URL}/api/upload",
        headers={"Authorization": f"Bearer {demo_token}"},
        files=files,
    )
    if r.status_code == 503:
        pytest.skip("Object storage unavailable (init_storage failed): %s" % r.text)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"png_bytes": png, **body}


# --------------- /api/upload ---------------
class TestUpload:
    def test_upload_png_success(self, uploaded_png):
        # Response shape
        assert "path" in uploaded_png and isinstance(uploaded_png["path"], str)
        assert uploaded_png["path"].startswith("tani-journal/uploads/")
        assert uploaded_png["url"].startswith("/api/files/")
        assert uploaded_png["url"].endswith(uploaded_png["path"])
        assert uploaded_png["size"] == len(uploaded_png["png_bytes"])

    def test_upload_requires_auth(self):
        png = _make_png()
        files = {"file": ("noauth.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert r.status_code == 401, r.text

    def test_upload_rejects_text(self, demo_token):
        files = {"file": ("notes.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {demo_token}"},
            files=files,
        )
        assert r.status_code == 415, r.text

    def test_upload_rejects_oversize(self, demo_token):
        # 6 MB of zero bytes labeled as PNG — should hit 413 (over 5MB cap)
        big = b"\x00" * (6 * 1024 * 1024)
        files = {"file": ("huge.png", io.BytesIO(big), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/upload",
            headers={"Authorization": f"Bearer {demo_token}"},
            files=files,
        )
        # 503 acceptable only if storage init failed (no upload attempted on small files
        # earlier), but typically should be 413 since size check happens before put_object.
        assert r.status_code == 413, r.text


# --------------- /api/files/{path} ---------------
class TestFilesDownload:
    def test_download_uploaded_png(self, uploaded_png):
        r = requests.get(f"{BASE_URL}{uploaded_png['url']}")
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert ctype.startswith("image/png"), ctype
        # Verify PNG signature on the returned body
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(r.content) == uploaded_png["size"]

    def test_download_nonexistent(self):
        bogus_path = f"tani-journal/uploads/__nope__/{uuid.uuid4().hex}.png"
        r = requests.get(f"{BASE_URL}/api/files/{bogus_path}")
        assert r.status_code == 404, r.text


# --------------- PUT /api/users/me ---------------
class TestProfileUpdate:
    def test_update_requires_auth(self):
        r = requests.put(
            f"{BASE_URL}/api/users/me",
            json={"name": "X", "bio": "Y"},
        )
        assert r.status_code == 401, r.text

    def test_update_name_bio_picture_persists(self, demo_token, demo_user_id):
        new_name = f"Demo {uuid.uuid4().hex[:6]}"
        new_bio = "Updated bio @ phase2 test"
        new_pic = "https://example.com/avatar.png"

        r = requests.put(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"name": new_name, "bio": new_bio, "picture": new_pic},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == new_name
        assert body["bio"] == new_bio
        assert body["picture"] == new_pic
        assert body["user_id"] == demo_user_id
        assert "_id" not in body  # MongoDB internal id stripped

        # GET to verify persistence
        g = requests.get(
            f"{BASE_URL}/api/users/{demo_user_id}"
        )
        assert g.status_code == 200, g.text
        fetched = g.json()
        assert fetched["name"] == new_name
        assert fetched["bio"] == new_bio
        assert fetched["picture"] == new_pic

        # Restore original demo values so subsequent runs / UI tests are not surprised
        requests.put(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"name": "Demo Tani", "bio": "", "picture": ""},
        )
