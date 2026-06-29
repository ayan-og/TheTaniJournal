"""Insert fake drive_credentials + patch ONE demo post to look synced.

Prints: demo_user_id, synced_post_id, unsynced_post_id
"""
import os, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path("/app/backend/.env"))
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

mode = sys.argv[1] if len(sys.argv) > 1 else "seed"

u = db.users.find_one({"email": "demo@tanijournal.com"}, {"_id": 0, "user_id": 1})
user_id = u["user_id"]

if mode == "clean":
    db.drive_credentials.delete_one({"user_id": user_id})
    db.posts.update_many({"author_id": user_id},
                         {"$unset": {"drive_file_id": "", "drive_web_view_link": "", "drive_synced_at": ""}})
    print(f"CLEAN user={user_id}")
else:
    future = datetime.now(timezone.utc) + timedelta(days=1)
    db.drive_credentials.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "access_token": "fake_invalid_token_xyz",
            "refresh_token": "fake_refresh_xyz",
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": "fake-client-id",
            "client_secret": "fake-client-secret",
            "scopes": ["https://www.googleapis.com/auth/drive.file"],
            "expiry": future.replace(tzinfo=None).isoformat(),
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }}, upsert=True,
    )
    posts = list(db.posts.find({"author_id": user_id}, {"_id": 0, "id": 1}).sort("created_at", 1))
    if len(posts) < 2:
        print("NEED at least 2 posts"); sys.exit(1)
    synced_id = posts[0]["id"]
    unsynced_id = posts[1]["id"]
    db.posts.update_one({"id": synced_id}, {"$set": {
        "drive_file_id": "fake_drive_id",
        "drive_web_view_link": "https://drive.google.com/file/d/fake_drive_id/view",
        "drive_synced_at": datetime.now(timezone.utc).isoformat(),
    }})
    db.posts.update_one({"id": unsynced_id}, {"$unset": {"drive_file_id": "", "drive_web_view_link": "", "drive_synced_at": ""}})
    print(f"USER={user_id}")
    print(f"SYNCED={synced_id}")
    print(f"UNSYNCED={unsynced_id}")
client.close()
