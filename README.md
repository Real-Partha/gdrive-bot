# GDrive Upload Bot

A fast, polished photo/video uploader and browser for Google Drive:

- Organizes uploads into date-based folders using EXIF/metadata
- Handles HEIC/HEIF/AVIF previews and video thumbs
- Robust for large files via streaming + resumable Drive uploads
- Parallel uploads with clean, modern UI
- Find Mode to browse media by date range

This README guides you end‑to‑end on Windows (PowerShell) to set up Google Cloud, configure OAuth, install backend and frontend, and run everything locally.

---

## 📦 What you get

- Backend: FastAPI + Google Drive API
  - EXIF date extraction with filesystem timestamp fallback
  - HEIC/AVIF support via Pillow + pillow‑heif
  - Video preview via MoviePy + NumPy (server-side) and client video thumbnails (upload mode)
  - Chunked, resumable uploads to Drive with exponential backoff
- Frontend: React + Vite + Tailwind
  - Drag & drop, previews, video duration, loaders, retry with one auto-retry
  - Upload Mode + Find Mode (date/date-range)

---

## ✅ Prerequisites

- Windows 10/11 with PowerShell
- Git (optional but recommended)
- Node.js 18+ (LTS recommended)
- Python 3.12.x (recommended for prebuilt MoviePy/NumPy wheels on Windows)

> If you have multiple Python versions, prefer 3.12 for best wheel availability.

---

## 🧭 Folder layout

```
GDrive Upload Bot/
  backend/
    config.py
    requirements.txt
    credentials.json        # You will add this (Google OAuth client secrets)
    token.json              # Will be generated on first auth
    .env                    # You will add this (backend config)
  frontend/
    package.json
    src/ ...
  README.md                 # This file
```

---

## 🔐 Google Cloud setup (Drive API + OAuth)

We’ll create a project, enable the Drive API, configure OAuth consent, and create Desktop credentials.

1) Create a Google Cloud project
- Go to https://console.cloud.google.com
- Top bar → Project selector → New Project
- Name: "GDrive Upload Bot" (or anything)
- Create → Select it after creation

2) Enable the Google Drive API
- Left menu → APIs & Services → Library
- Search: "Google Drive API"
- Click it → Enable

3) Configure OAuth consent screen
- Left menu → APIs & Services → OAuth consent screen
- User Type: External (easiest for testing), then Create
- App information:
  - App name: GDrive Upload Bot
  - User support email: your email
- App domain: leave empty for local testing
- Developer contact information: your email
- Scopes: Add or remove scopes → Add "../auth/drive.file"
  - This allows read/write to files created/opened by this app
- Test users: Add your Google account email
- Save & continue through the steps → Back to dashboard

4) Create OAuth client credentials (Desktop)
- Left menu → APIs & Services → Credentials
- Create Credentials → OAuth client ID
- Application type: Desktop app
- Name: GDrive Upload Bot (Desktop)
- Create → Download JSON
- Save the downloaded file as `backend/credentials.json`

> Important: We use the "Installed app" (Desktop) flow. The backend will open a browser once on first use to authorize and will save `token.json` for subsequent runs.

---

## ⚙️ Backend configuration

`backend/config.py` reads settings from `backend/.env` and defaults. Create `backend/.env` with:

```ini
# Frontend origin for CORS (Vite dev server default)
FRONTEND_ORIGIN=http://localhost:5173

# Where to upload in Drive:
# Either set a specific parent folder by ID (recommended) or by name.
# If ID is unset, and NAME is set, the app uploads under the first folder it finds by that name at Drive root.
# If both are empty, uploads go to My Drive root.
MAIN_DRIVE_FOLDER_ID=
MAIN_DRIVE_FOLDER_NAME=

# Credential/token file names (relative to backend/)
GOOGLE_CREDENTIALS_FILE=credentials.json
GOOGLE_TOKEN_FILE=token.json

# Workers for preview generation (images/videos)
PREVIEW_WORKERS=12
```

Tips:
- To upload under a specific Drive folder, open it in Drive and copy the ID from the URL, then set `MAIN_DRIVE_FOLDER_ID`.
- If you prefer by name, set `MAIN_DRIVE_FOLDER_NAME` (exact match under root).

---

## 🐍 Backend setup (Windows PowerShell)

1) Create and activate a Python 3.12 virtual environment

```powershell
# In the project root
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2) Install dependencies

```powershell
pip install --upgrade pip
pip install -r backend\requirements.txt
```

3) Place credentials and config
- Put the downloaded OAuth JSON as `backend/credentials.json`.
- Create `backend/.env` as shown above.

4) Run the backend (developer mode)

```powershell
uvicorn backend.main:app --reload --port 8000
```

5) First-run authorization
- Trigger an API call that uses Drive (e.g., upload a small image or open the Find page in the app).
- A browser will open; log in with a Test User you added and grant access.
- `backend/token.json` will be created for future runs (no repeated prompts).

> Large files: The backend streams uploads to disk and uses Google Drive resumable uploads with 10MB chunks and backoff. This is robust for big videos.

---

## 🌐 Frontend setup (Windows PowerShell)

1) Install Node.js 18+ (LTS). Then install dependencies:

```powershell
cd frontend
npm install
```

2) Start the dev server

```powershell
npm run dev
```

- Vite will show a local URL, typically `http://localhost:5173`.
- Ensure `FRONTEND_ORIGIN` in `backend/.env` matches this URL.

---

## 🚀 Run the full app

- Backend (in one PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --port 8000
```

- Frontend (in another PowerShell):

```powershell
cd frontend
npm run dev
```

- Open the app at `http://localhost:5173`.

### Upload Mode
- Drag & drop images/videos.
- Previews: HEIC/AVIF via server; videos get client thumbnails and duration badges.
- Robust uploads: parallel workers, auto one-time retry, manual Retry button.
- After upload, files are renamed to `YYYY-MM-DD_HH-MM-SS.ext` and organized by date folder in Drive.

### Find Mode
- Choose a date or range and browse grouped media from Drive, with per-date image/video counts.

---

## 🔌 API Reference (local)

- Health: `GET http://localhost:8000/health`
- Upload: `POST http://localhost:8000/upload` (multipart form; frontend handles this)
- Find: `GET http://localhost:8000/find_photos?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Preview (Drive file): `GET http://localhost:8000/preview/{file_id}?w=480&q=75`
- Preview (local HEIC/etc): `POST http://localhost:8000/preview_local?w=320&q=80`

CORS allows the origin configured by `FRONTEND_ORIGIN`.

---

## 🧩 How it works (high level)

- Dates: Extracted from EXIF if present; else `File.lastModified`; else filesystem mtime.
- HEIC/AVIF: `pillow-heif` registers decoders; previews rendered to JPEG.
- Video previews:
  - Upload Mode: client-side thumbnail & duration via HTMLMediaElement + canvas
  - Find Mode: server-side frame extraction via MoviePy, returned as JPEG
- Large uploads: streamed to disk; Drive resumable uploads in 10MB chunks with exponential backoff
- Concurrency: upload workers on frontend; preview thread pool (`PREVIEW_WORKERS`) on backend

---

## 🧪 Troubleshooting

- OAuth window doesn’t open / token not saved:
  - Ensure `backend/credentials.json` exists and is from a Desktop OAuth client.
  - Ensure you added yourself as a Test User on the OAuth consent screen.
  - Check backend logs for errors.

- CORS error in browser:
  - Verify `FRONTEND_ORIGIN` matches the Vite URL (default `http://localhost:5173`).
  - Restart backend after changing `.env`.

- HEIC previews not showing:
  - Ensure `pillow-heif` is installed (it is in requirements) and no startup errors.

- Video previews (Find Mode) fail:
  - MoviePy uses FFmpeg under the hood via `imageio-ffmpeg`. If FFmpeg cannot be found or auto-downloaded, install it or ensure it’s on PATH. Alternatively, rely on Upload Mode’s client-side thumbs only.

- Large file uploads time out:
  - The app now uses streamed saves + resumable uploads with retries. If you’re behind a proxy (IIS/NGINX), ensure request body size/timeouts are large enough.

- Want to upload under a specific Drive folder:
  - Set `MAIN_DRIVE_FOLDER_ID` in `backend/.env` (copy from Drive folder URL), then restart backend.

---

## 🔒 Scopes & Permissions

- Scope requested: `https://www.googleapis.com/auth/drive.file`
  - Access limited to files created/opened by this app.
- Tokens are stored in `backend/token.json`. Treat this file as sensitive.

---

## 🧰 Scripts

- Backend (from project root):
  - Create venv: `py -3.12 -m venv .venv`
  - Activate: `.\.venv\Scripts\Activate.ps1`
  - Run dev: `uvicorn backend.main:app --reload --port 8000`

- Frontend:
  - Install: `npm install`
  - Dev: `npm run dev`
  - Build: `npm run build`

---

## ✨ Notes

- Recommended Python: 3.12.x on Windows for clean wheels.
- Vite requires Node.js 18+.
- All endpoints keep their original paths; the backend is organized into feature routers for clarity.

Enjoy your faster, smoother Google Drive uploads and browsing!
