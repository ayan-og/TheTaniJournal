# The Tani Journal — Product Requirements Document

## Original Problem Statement
Build a responsive journal website "The Tani Journal" with:
- Google OAuth + Email/Password authentication
- Storage originally requested on Google Drive (deferred — using MongoDB as primary)
- Real-time online status indicator (blue dot online, dark dot offline)
- CRUD on journal entries (private/public toggle)
- Community feed with public posts, comments, report flagging
- WYSIWYG rich text editor (Quill)
- Searchable feed with category/tag filter and pagination
- User profiles (avatar w/ online dot, bio, public entries)
- Responsive nav (hamburger on mobile), light/dark mode

## User Personas
- Solo writer: journals privately, occasionally shares publicly
- Reader: browses public journals, comments, reports abuse
- Returning user: edits/deletes own entries, manages public/private visibility

## Architecture (Implemented)
- **Frontend**: React 19, React Router v7, TailwindCSS, Shadcn UI, react-quill-new, sonner, lucide-react
- **Backend**: FastAPI, Motor (async MongoDB), bcrypt, httpx
- **Auth**: Dual — Email/Password (bcrypt + session_token) + Emergent Google OAuth (session_id exchange). Sessions in `user_sessions` collection, httpOnly cookies + Bearer header fallback.
- **Presence**: 30-second client heartbeat → `users.last_seen`. Online if last_seen within 60s. No WebSocket needed; works behind k8s ingress reliably.
- **Storage**: MongoDB collections — users, user_sessions, posts, comments, reports.
- **Design system**: Earthy / serif (Cormorant Garamond) + Manrope sans, FDFBF7 / 121413 backgrounds, primary accent #2B4C3E, all CSS vars driven through HSL.

## Implemented (2026-02 release)
- Landing page (hero, feature bento, recent posts strip)
- /login with Tabs (Sign in / Sign up) + Continue with Google
- AuthCallback that processes `#session_id=…` synchronously
- Feed with search, tag filters, "Load more" pagination
- Single post view with Quill HTML render (DOMPurify-sanitized), edit/delete (owner), report dialog (non-owner)
- Comments thread + comment reports
- Personal Dashboard listing own entries with public/private icons, edit/delete
- Editor for create + edit (Quill toolbar slimmed for distraction-free writing) **+ image upload via Emergent object storage**
- Profile page /u/:userId with avatar+presence dot, bio, public entries **+ "Edit profile" dialog for self (name, bio, avatar upload)**
- Navbar with hamburger drawer, theme toggle (persisted to localStorage)
- Online presence dots everywhere user avatars appear
- Seed data: demo user + 2 sample posts

## Implemented (2026-02 — phase 2)
- **Profile Edit UI**: dialog on Profile page (own profile only) — name, bio (280 char limit), avatar upload via object storage. Updates flow through `PUT /api/users/me` and refresh both Profile + AuthContext user.
- **Image uploads in editor**: Quill toolbar image button now triggers a file picker → uploads via `POST /api/upload` → inserts the returned `<img>` into the post content. 5MB cap, JPEG/PNG/WebP/GIF only.
- **File storage**: Backend `POST /api/upload` (auth required) + `GET /api/files/{path}` (public read, cache-controlled) backed by Emergent object storage. MongoDB `files` collection tracks all uploads with `is_deleted` flag for soft delete.

## Test Credentials
- `demo@tanijournal.com` / `Tani@2026` (seeded)

## Verified
- Backend pytest: 21/21 pass — auth, posts CRUD, comments, reports, presence, profiles.
- Frontend Playwright: landing, login, dashboard, editor (Quill publish), post view, theme toggle, presence dots, delete with confirm, search filter, logout, mobile menu.

## Prioritised Backlog
- P0 (none — core flows verified)
- P1: Google Drive sync (export journals on demand), draft autosave, profile editing UI (PUT /api/users/me wired backend-only), email verification + password reset
- P2: Image upload in editor (object storage), rate-limiting on auth/comment/report, notifications for comments on your post, follow/subscribe to authors, RSS feed for profiles
- P3: WebSocket presence upgrade, monetised "premium reader" tier, AI writing prompts

## Known Non-blocking Notes
- `/api/users/me` PUT exists but no UI yet (profile editing form deferred to P1).
- Drive integration intentionally deferred — requires user-supplied Google Cloud OAuth credentials. Wire-in point: add `/api/drive/sync` endpoint and a profile setting after credentials provided.
