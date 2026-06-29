"""One-off cleanup to remove stale drive_credentials from prior test runs."""
import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path("/app/backend/.env"))
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
res = db.drive_credentials.delete_many({})
print(f"Deleted {res.deleted_count} drive_credentials docs")
res2 = db.posts.update_many({}, {"$unset": {"drive_file_id": "", "drive_web_view_link": "", "drive_synced_at": ""}})
print(f"Unset drive_* on {res2.modified_count} posts")
client.close()
