# Backend (FastAPI) - GDrive Upload Bot

This FastAPI server accepts one or more image files, reads their capture date from EXIF, renames them to `YYYY-MM-DD_HH-MM-SS.ext`, and uploads them to Google Drive inside a main folder. For each capture date it ensures a subfolder `YYYY-MM-DD` exists and uploads into it.

## Setup

1. Python 3.11+ recommended. Create a virtual environment:

   - Windows PowerShell:
     - `python -m venv .venv`
     - `.venv\Scripts\Activate.ps1`

2. Install dependencies:

   - `pip install -r requirements.txt`

3. Google API credentials:

   - Create OAuth client credentials (Desktop) in Google Cloud Console for the Drive API
   - Download the JSON and save it as `backend/credentials.json`

4. Configure environment:

   - Copy `.env.example` to `.env` and fill in either `MAIN_DRIVE_FOLDER_ID` or `MAIN_DRIVE_FOLDER_NAME`

## Run

From the project root (recommended):

- `uvicorn backend.main:app --reload --port 8000`

If you run from inside the `backend/` folder, use:

- `uvicorn main:app --reload --port 8000`

Note: Because the project path contains spaces, prefer quoting paths or running from the project root. An empty `__init__.py` is included so `backend` is a proper package.

The first upload will prompt a browser for Google OAuth and create `token.json` for reuse.

## API

- `GET /health` -> `{ status: 'ok' }`
- `POST /upload` -> multipart form with `files` (can include multiple). Returns per-file results with `status`, `newName`, `dateFolder`, `webViewLink`.
