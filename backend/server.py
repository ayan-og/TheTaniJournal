"""The Tani Journal — FastAPI Backend
Auth: Emergent Google OAuth + Email/Password (both produce a session_token).
Storage: MongoDB. Presence: heartbeat-based (online if heartbeat within 60s).
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File
from fastapi.responses import JSONResponse, Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging
import secrets
import re
import bcrypt
import httpx
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="The Tani Journal API")
api = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
PRESENCE_ONLINE_WINDOW_SECONDS = 60

# ---------- object storage ----------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "tani-journal")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
EXT_BY_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB
_storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=15)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logging.getLogger("tani").error("Storage init failed: %s", e)
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not configured")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=60,
    )
    if r.status_code == 403:
        # key expired — refresh once and retry
        globals()["_storage_key"] = None
        key = init_storage()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=60,
        )
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(503, "Storage not configured")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 403:
        globals()["_storage_key"] = None
        key = init_storage()
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tani")


# ---------- helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()


# ---------- models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = ""
    created_at: str

class PostIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str  # HTML from Quill
    excerpt: Optional[str] = ""
    tags: List[str] = []
    visibility: Literal["public", "private"] = "public"

class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[Literal["public", "private"]] = None

class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

class ReportIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    picture: Optional[str] = None


# ---------- auth dependency ----------
async def _resolve_token(request: Request) -> Optional[str]:
    tok = request.cookies.get("session_token")
    if tok:
        return tok
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None

async def get_current_user(request: Request) -> dict:
    token = await _resolve_token(request)
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    # opportunistic heartbeat
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_seen": iso(now_utc())}})
    return user

async def get_current_user_optional(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ---------- session helpers ----------
async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(40)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": iso(now_utc() + timedelta(days=7)),
        "created_at": iso(now_utc()),
    })
    return token

def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )

def clear_session_cookie(response: Response):
    response.delete_cookie("session_token", path="/")

def serialize_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name") or u["email"].split("@")[0],
        "picture": u.get("picture"),
        "bio": u.get("bio", ""),
        "created_at": u.get("created_at", iso(now_utc())),
    }


# ---------- auth routes ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    existing = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = make_id("user")
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name.strip(),
        "picture": None,
        "bio": "",
        "password_hash": hash_pw(body.password),
        "auth_provider": "email",
        "created_at": iso(now_utc()),
        "last_seen": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = await create_session(user_id)
    set_session_cookie(response, token)
    return {"user": serialize_user(doc), "session_token": token}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_seen": iso(now_utc())}})
    return {"user": serialize_user(user), "session_token": token}

@api.post("/auth/session")
async def emergent_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        log.error("Emergent session exchange failed: %s %s", r.status_code, r.text)
        raise HTTPException(401, "Invalid Google session")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(400, "Email missing from Google profile")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token") or secrets.token_urlsafe(40)

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": existing.get("name") or name, "picture": picture or existing.get("picture"), "last_seen": iso(now_utc())}},
        )
        user_doc = {**existing, "name": existing.get("name") or name, "picture": picture or existing.get("picture")}
    else:
        user_id = make_id("user")
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "bio": "",
            "password_hash": None,
            "auth_provider": "google",
            "created_at": iso(now_utc()),
            "last_seen": iso(now_utc()),
        }
        await db.users.insert_one(user_doc)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": iso(now_utc() + timedelta(days=7)),
        "created_at": iso(now_utc()),
    })
    set_session_cookie(response, session_token)
    return {"user": serialize_user(user_doc), "session_token": session_token}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await _resolve_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}


# ---------- presence ----------
@api.post("/presence/heartbeat")
async def heartbeat(user: dict = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_seen": iso(now_utc())}})
    return {"ok": True, "last_seen": iso(now_utc())}

@api.get("/presence/status")
async def presence_status(user_ids: str = Query(..., description="Comma-separated user_ids")):
    ids = [x for x in user_ids.split(",") if x]
    if not ids:
        return {"online": {}}
    cursor = db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "last_seen": 1})
    threshold = now_utc() - timedelta(seconds=PRESENCE_ONLINE_WINDOW_SECONDS)
    out = {}
    async for u in cursor:
        ls = u.get("last_seen")
        if ls and isinstance(ls, str):
            try:
                ls_dt = datetime.fromisoformat(ls)
                if ls_dt.tzinfo is None:
                    ls_dt = ls_dt.replace(tzinfo=timezone.utc)
                out[u["user_id"]] = ls_dt > threshold
            except Exception:
                out[u["user_id"]] = False
        else:
            out[u["user_id"]] = False
    return {"online": out}


# ---------- post helpers ----------
def serialize_post(p: dict, author: Optional[dict] = None) -> dict:
    return {
        "id": p["id"],
        "title": p["title"],
        "content": p["content"],
        "excerpt": p.get("excerpt") or (strip_html(p["content"])[:200] + ("…" if len(strip_html(p["content"])) > 200 else "")),
        "tags": p.get("tags", []),
        "visibility": p.get("visibility", "public"),
        "author_id": p["author_id"],
        "author": {
            "user_id": author["user_id"],
            "name": author.get("name"),
            "picture": author.get("picture"),
        } if author else None,
        "created_at": p["created_at"],
        "updated_at": p.get("updated_at", p["created_at"]),
        "comment_count": p.get("comment_count", 0),
        "drive_file_id": p.get("drive_file_id"),
        "drive_web_view_link": p.get("drive_web_view_link"),
        "drive_synced_at": p.get("drive_synced_at"),
    }

async def _attach_authors(posts: list) -> list:
    if not posts:
        return []
    author_ids = list({p["author_id"] for p in posts})
    authors = {}
    async for a in db.users.find({"user_id": {"$in": author_ids}}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1}):
        authors[a["user_id"]] = a
    return [serialize_post(p, authors.get(p["author_id"])) for p in posts]


# ---------- posts ----------
@api.get("/posts")
async def list_posts(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    author_id: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
):
    limit = max(1, min(limit, 50))
    skip = (max(1, page) - 1) * limit
    filt: dict = {"visibility": "public"}
    if tag:
        filt["tags"] = tag
    if author_id:
        filt["author_id"] = author_id
    if q:
        filt["$or"] = [
            {"title": {"$regex": re.escape(q), "$options": "i"}},
            {"content": {"$regex": re.escape(q), "$options": "i"}},
            {"tags": {"$regex": re.escape(q), "$options": "i"}},
        ]
    total = await db.posts.count_documents(filt)
    cursor = db.posts.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    posts = await cursor.to_list(length=limit)
    return {"items": await _attach_authors(posts), "total": total, "page": page, "limit": limit}

@api.get("/posts/tags")
async def list_tags():
    pipeline = [
        {"$match": {"visibility": "public"}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    tags = []
    async for t in db.posts.aggregate(pipeline):
        tags.append({"name": t["_id"], "count": t["count"]})
    return {"tags": tags}

@api.get("/posts/mine")
async def list_my_posts(user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"author_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    posts = await cursor.to_list(length=500)
    return {"items": await _attach_authors(posts)}

@api.post("/posts")
async def create_post(body: PostIn, user: dict = Depends(get_current_user)):
    post = {
        "id": make_id("post"),
        "author_id": user["user_id"],
        "title": body.title.strip(),
        "content": body.content,
        "excerpt": body.excerpt or "",
        "tags": [t.strip().lower() for t in body.tags if t.strip()][:8],
        "visibility": body.visibility,
        "comment_count": 0,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    }
    await db.posts.insert_one(post)
    return serialize_post(post, user)

@api.get("/posts/{post_id}")
async def get_post(post_id: str, user: Optional[dict] = Depends(get_current_user_optional)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["visibility"] == "private" and (not user or user["user_id"] != post["author_id"]):
        raise HTTPException(403, "This post is private")
    author = await db.users.find_one({"user_id": post["author_id"]}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1})
    return serialize_post(post, author)

@api.put("/posts/{post_id}")
async def update_post(post_id: str, body: PostUpdate, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(403, "Not your post")
    upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "tags" in upd:
        upd["tags"] = [t.strip().lower() for t in upd["tags"] if t.strip()][:8]
    upd["updated_at"] = iso(now_utc())
    await db.posts.update_one({"id": post_id}, {"$set": upd})
    post.update(upd)
    return serialize_post(post, user)

@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(403, "Not your post")
    await db.posts.delete_one({"id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    return {"ok": True}


# ---------- comments ----------
@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "visibility": 1})
    if not post or post.get("visibility") != "public":
        return {"items": []}
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1)
    comments = await cursor.to_list(length=500)
    if not comments:
        return {"items": []}
    author_ids = list({c["author_id"] for c in comments})
    authors = {}
    async for a in db.users.find({"user_id": {"$in": author_ids}}, {"_id": 0, "user_id": 1, "name": 1, "picture": 1}):
        authors[a["user_id"]] = a
    items = []
    for c in comments:
        a = authors.get(c["author_id"], {})
        items.append({
            "id": c["id"],
            "post_id": c["post_id"],
            "content": c["content"],
            "author_id": c["author_id"],
            "author": {"user_id": a.get("user_id"), "name": a.get("name"), "picture": a.get("picture")},
            "created_at": c["created_at"],
        })
    return {"items": items}

@api.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentIn, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["visibility"] != "public":
        raise HTTPException(403, "Cannot comment on private posts")
    c = {
        "id": make_id("cmt"),
        "post_id": post_id,
        "author_id": user["user_id"],
        "content": body.content.strip(),
        "created_at": iso(now_utc()),
    }
    await db.comments.insert_one(c)
    await db.posts.update_one({"id": post_id}, {"$inc": {"comment_count": 1}})
    return {
        "id": c["id"], "post_id": post_id, "content": c["content"], "author_id": user["user_id"],
        "author": {"user_id": user["user_id"], "name": user["name"], "picture": user.get("picture")},
        "created_at": c["created_at"],
    }


# ---------- reports ----------
@api.post("/posts/{post_id}/report")
async def report_post(post_id: str, body: ReportIn, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(404, "Post not found")
    await db.reports.insert_one({
        "id": make_id("rpt"),
        "type": "post",
        "target_id": post_id,
        "reporter_id": user["user_id"],
        "reason": body.reason.strip(),
        "created_at": iso(now_utc()),
    })
    return {"ok": True}

@api.post("/comments/{comment_id}/report")
async def report_comment(comment_id: str, body: ReportIn, user: dict = Depends(get_current_user)):
    c = await db.comments.find_one({"id": comment_id}, {"_id": 0, "id": 1})
    if not c:
        raise HTTPException(404, "Comment not found")
    await db.reports.insert_one({
        "id": make_id("rpt"),
        "type": "comment",
        "target_id": comment_id,
        "reporter_id": user["user_id"],
        "reason": body.reason.strip(),
        "created_at": iso(now_utc()),
    })
    return {"ok": True}


# ---------- profiles ----------
@api.get("/users/{user_id}")
async def get_user(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    return serialize_user(u)

@api.get("/users/{user_id}/posts")
async def get_user_posts(user_id: str):
    cursor = db.posts.find({"author_id": user_id, "visibility": "public"}, {"_id": 0}).sort("created_at", -1)
    posts = await cursor.to_list(length=200)
    return {"items": await _attach_authors(posts)}

@api.put("/users/me")
async def update_me(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return serialize_user(u)


# ---------- file upload (avatars & post images) ----------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(415, "Only JPEG, PNG, WebP, or GIF images are allowed")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image is too large (max 5MB)")
    ext = EXT_BY_MIME.get(file.content_type, "bin")
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    try:
        result = put_object(path, data, file.content_type)
    except HTTPException:
        raise
    except Exception as e:
        log.error("Upload failed: %s", e)
        raise HTTPException(500, "Upload failed")
    await db.files.insert_one({
        "id": make_id("file"),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "owner_id": user["user_id"],
        "is_deleted": False,
        "created_at": iso(now_utc()),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}", "size": result.get("size", len(data))}

@api.get("/files/{path:path}")
async def download_file(path: str):
    # Public read for journal images/avatars; access by guessing UUID-based paths is infeasible.
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    try:
        data, ctype = get_object(path)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "File not found")
    return FastResponse(
        content=data,
        media_type=record.get("content_type") or ctype,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ---------- Google Drive integration (per-user OAuth, drive.file scope) ----------
from googleapiclient.discovery import build  # noqa: E402
from googleapiclient.http import MediaIoBaseUpload  # noqa: E402
from google_auth_oauthlib.flow import Flow  # noqa: E402
from google.oauth2.credentials import Credentials as GoogleCredentials  # noqa: E402
from google.auth.transport.requests import Request as GoogleRequest  # noqa: E402
import io as _io  # noqa: E402

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_DRIVE_REDIRECT_URI = os.environ.get("GOOGLE_DRIVE_REDIRECT_URI")
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
DRIVE_FOLDER_NAME = "The Tani Journal"


def _drive_flow(scopes=None):
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_DRIVE_REDIRECT_URI],
            }
        },
        scopes=scopes,
        redirect_uri=GOOGLE_DRIVE_REDIRECT_URI,
    )


async def _drive_service_for(user_id: str):
    creds_doc = await db.drive_credentials.find_one({"user_id": user_id}, {"_id": 0})
    if not creds_doc:
        raise HTTPException(400, "Google Drive is not connected for this account")
    creds = GoogleCredentials(
        token=creds_doc.get("access_token"),
        refresh_token=creds_doc.get("refresh_token"),
        token_uri=creds_doc.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=creds_doc.get("client_id", GOOGLE_CLIENT_ID),
        client_secret=creds_doc.get("client_secret", GOOGLE_CLIENT_SECRET),
        scopes=creds_doc.get("scopes", DRIVE_SCOPES),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        await db.drive_credentials.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": iso(now_utc()),
            }},
        )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _find_or_create_folder(service, name: str) -> str:
    q = f"mimeType='application/vnd.google-apps.folder' and name='{name}' and trashed=false"
    res = service.files().list(q=q, fields="files(id,name)", pageSize=1).execute()
    files = res.get("files", [])
    if files:
        return files[0]["id"]
    meta = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
    folder = service.files().create(body=meta, fields="id").execute()
    return folder["id"]


@api.get("/drive/connect")
async def drive_connect(user: dict = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google Drive is not configured")
    flow = _drive_flow(scopes=DRIVE_SCOPES)
    authorization_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user["user_id"],
    )
    return {"authorization_url": authorization_url}


class DriveCallbackIn(BaseModel):
    code: str
    state: Optional[str] = None


@api.post("/drive/callback")
async def drive_callback(body: DriveCallbackIn, user: dict = Depends(get_current_user)):
    """Frontend /drive/callback page posts {code, state} here. state must equal user_id."""
    if body.state and body.state != user["user_id"]:
        raise HTTPException(400, "OAuth state mismatch")
    try:
        flow = _drive_flow(scopes=None)
        flow.fetch_token(code=body.code)
        creds = flow.credentials
    except Exception as e:
        log.error("Drive token exchange failed: %s", e)
        raise HTTPException(400, "Could not exchange code with Google")

    granted = set(creds.scopes or [])
    if not set(DRIVE_SCOPES).issubset(granted):
        raise HTTPException(400, "Required Drive scope was not granted")

    await db.drive_credentials.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes or []),
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "updated_at": iso(now_utc()),
            "connected_at": iso(now_utc()),
        }},
        upsert=True,
    )
    return {"ok": True}


@api.get("/drive/status")
async def drive_status(user: dict = Depends(get_current_user)):
    doc = await db.drive_credentials.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0, "connected_at": 1, "scopes": 1},
    )
    return {"connected": bool(doc), "connected_at": doc.get("connected_at") if doc else None}


@api.delete("/drive/disconnect")
async def drive_disconnect(user: dict = Depends(get_current_user)):
    doc = await db.drive_credentials.find_one({"user_id": user["user_id"]}, {"_id": 0, "access_token": 1})
    if doc and doc.get("access_token"):
        try:
            async with httpx.AsyncClient(timeout=10) as cli:
                await cli.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": doc["access_token"]},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
        except Exception as e:
            log.warning("Drive revoke failed (continuing): %s", e)
    await db.drive_credentials.delete_one({"user_id": user["user_id"]})
    return {"ok": True}


@api.post("/posts/{post_id}/export-drive")
async def export_post_to_drive(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(403, "Not your post")

    service = await _drive_service_for(user["user_id"])
    folder_id = _find_or_create_folder(service, DRIVE_FOLDER_NAME)

    html = (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{post['title']}</title>"
        f"<style>body{{font-family:Georgia,serif;max-width:680px;margin:48px auto;padding:0 24px;line-height:1.7;color:#1a332b}}"
        f"h1{{font-size:2rem;margin-bottom:.25rem}} .meta{{color:#6a7a72;font-size:.85rem;margin-bottom:2rem}}</style>"
        f"</head><body>"
        f"<h1>{post['title']}</h1>"
        f"<div class='meta'>Tani Journal · {post['created_at']} · {post.get('visibility','public')}</div>"
        f"{post['content']}"
        f"</body></html>"
    )
    media = MediaIoBaseUpload(_io.BytesIO(html.encode("utf-8")), mimetype="text/html", resumable=False)
    safe_title = re.sub(r"[^\w\- ]+", "", post["title"]).strip() or post["id"]
    file_meta = {
        "name": f"{safe_title}.html",
        "parents": [folder_id],
        "description": f"Exported from The Tani Journal · post {post['id']}",
    }

    existing_drive_id = post.get("drive_file_id")
    if existing_drive_id:
        try:
            drive_file = service.files().update(
                fileId=existing_drive_id,
                media_body=media,
                fields="id,webViewLink,name,modifiedTime",
            ).execute()
        except Exception as e:
            log.warning("Drive update failed, creating new: %s", e)
            drive_file = service.files().create(
                body=file_meta, media_body=media, fields="id,webViewLink,name,modifiedTime",
            ).execute()
    else:
        drive_file = service.files().create(
            body=file_meta, media_body=media, fields="id,webViewLink,name,modifiedTime",
        ).execute()

    await db.posts.update_one(
        {"id": post_id},
        {"$set": {
            "drive_file_id": drive_file["id"],
            "drive_web_view_link": drive_file.get("webViewLink"),
            "drive_synced_at": iso(now_utc()),
        }},
    )
    return {
        "drive_file_id": drive_file["id"],
        "web_view_link": drive_file.get("webViewLink"),
        "name": drive_file.get("name"),
        "synced_at": iso(now_utc()),
    }


# ---------- mount ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- startup: seed demo + index ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index([("created_at", -1)])
    await db.comments.create_index("id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)

    # Initialize Emergent object storage (non-blocking on failure)
    init_storage()

    demo_email = "demo@tanijournal.com"
    existing = await db.users.find_one({"email": demo_email}, {"_id": 0})
    if not existing:
        uid = make_id("user")
        await db.users.insert_one({
            "user_id": uid,
            "email": demo_email,
            "name": "Demo Writer",
            "picture": None,
            "bio": "Curator of quiet thoughts. Writing one page at a time.",
            "password_hash": hash_pw("Tani@2026"),
            "auth_provider": "email",
            "created_at": iso(now_utc()),
            "last_seen": iso(now_utc()),
        })
        # seed a couple of public posts
        seed_posts = [
            {
                "id": make_id("post"),
                "author_id": uid,
                "title": "On the quiet ritual of mornings",
                "content": "<p>There is a particular kind of stillness that lives in the first light of day. A held breath before the world begins to speak.</p><p>I have come to love it the way one loves a old wooden table — for its silence, for the way it asks nothing of you.</p>",
                "excerpt": "There is a particular kind of stillness that lives in the first light of day.",
                "tags": ["morning", "reflection", "ritual"],
                "visibility": "public",
                "comment_count": 0,
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            },
            {
                "id": make_id("post"),
                "author_id": uid,
                "title": "Notes from a rainy afternoon",
                "content": "<p>The window fogs in slow circles. Tea cools faster than I read.</p><p>I wrote three pages today, then crossed out two. Honest work, mostly.</p>",
                "excerpt": "The window fogs in slow circles. Tea cools faster than I read.",
                "tags": ["weather", "writing"],
                "visibility": "public",
                "comment_count": 0,
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            },
        ]
        await db.posts.insert_many(seed_posts)
    log.info("Tani Journal API ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
