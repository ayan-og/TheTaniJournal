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

Deployment to Vercel (frontend + backend)
---------------------------------------

This repo can be deployed to Vercel as two services (frontend and backend). The backend uses a Dockerfile so it runs as a standalone service. Steps:

1. Push your repo to GitHub (if not already).
2. In Vercel, "Import Project" → choose this GitHub repo.
3. Create two projects in Vercel:
	- Frontend: point root to `frontend`. Vercel will detect Create React App and run the build. Set the Environment Variable `REACT_APP_BACKEND_URL` to your backend URL after deploying backend.
	- Backend: point root to `backend`. Vercel will detect the `Dockerfile` and build the container. Add required Environment Variables: `MONGO_URL`, `DB_NAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, `APP_NAME`, `CORS_ORIGINS`.
4. After both projects are deployed set the frontend's `REACT_APP_BACKEND_URL` to the backend deployment URL (e.g. `https://your-backend.vercel.app`).

Alternatively you can deploy the whole monorepo with a single Vercel project and use `vercel.json` rewrites. A `vercel.json` is included in the repo with example builds/routes.

Security
--------
- Do not commit `.env` or secrets. Set them in the Vercel project settings (Environment Variables).


Frontend
- The frontend is in `frontend/`. Use `npm install` and `npm start` or the equivalent in your environment.

Security
- Do not commit `.env` files or secrets. This repo has push-protection enabled; remove secrets from commits before push.

Contributing
- Open issues or PRs on GitHub.
# Here are your Instructions
