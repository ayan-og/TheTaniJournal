"""Phase 3.6 — verify asyncio.to_thread() releases event loop on /api/upload.

Simulate 5 concurrent uploads via asyncio.gather + httpx.AsyncClient. All
should return 200 with distinct paths.
"""
import asyncio
import io
import os
import struct
import zlib

import httpx
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tani-share.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@tanijournal.com"
DEMO_PASSWORD = "Tani@2026"


def _make_tiny_png(seed: int) -> bytes:
    """Produce a deterministic 1x1 PNG with `seed` as the red channel."""
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1, 8-bit RGB
    raw = b"\x00" + bytes([seed & 0xFF, 0, 0])           # filter byte + RGB pixel
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def test_five_concurrent_uploads_succeed(demo_token):
    headers = {"Authorization": f"Bearer {demo_token}"}

    async def upload_one(i: int, client: httpx.AsyncClient):
        png = _make_tiny_png(i + 1)
        files = {"file": (f"TEST_concurrent_{i}.png", io.BytesIO(png), "image/png")}
        r = await client.post(f"{BASE_URL}/api/upload", files=files, headers=headers)
        return r

    async def run():
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            return await asyncio.gather(*(upload_one(i, client) for i in range(5)))

    responses = asyncio.run(run())
    statuses = [r.status_code for r in responses]
    assert all(s == 200 for s in statuses), statuses

    paths = [r.json().get("path") or r.json().get("url") or r.json().get("file_path") for r in responses]
    assert len(set(paths)) == 5, paths
    assert all(p for p in paths), paths
