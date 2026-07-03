# The Tani Journal

This repository contains The Tani Journal — a FastAPI backend and React frontend for a simple journaling/share platform.

Quick start (backend)

Prereqs:
- Python 3.11
- MongoDB running and accessible via `MONGO_URL`

1. Create a virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Create `.env` files (do NOT commit them). Example keys used by the backend:

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_DRIVE_REDIRECT_URI=""
CORS_ORIGINS="http://localhost:3000"
APP_NAME="tani-journal"
```

3. Run the API server:

```bash
cd backend
.venv/bin/python -m uvicorn backend.server:app --reload --host 127.0.0.1 --port 8000
```

4. Run tests:

```bash
cd backend
REACT_APP_BACKEND_URL=http://127.0.0.1:8000 .venv/bin/pytest
```

Frontend
- The frontend is in `frontend/`. Use `npm install` and `npm start` or the equivalent in your environment.

Security
- Do not commit `.env` files or secrets. This repo has push-protection enabled; remove secrets from commits before push.

Contributing
- Open issues or PRs on GitHub.
# Here are your Instructions
