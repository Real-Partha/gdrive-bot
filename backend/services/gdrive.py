from __future__ import annotations
from pathlib import Path
from typing import Optional, Dict, Tuple, List
import io
import threading

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from ..config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",  # read/write files the app creates or opens
]

# Module-level lock registry and cache to prevent duplicate folder creation under concurrency
_FOLDER_LOCKS_GUARD = threading.Lock()
_FOLDER_LOCKS: Dict[Tuple[str, str], threading.Lock] = {}
_FOLDER_CACHE: Dict[Tuple[str, str], str] = {}

def _get_folder_lock(parent_id: Optional[str], name: str) -> threading.Lock:
    key = ((parent_id or ""), name)
    with _FOLDER_LOCKS_GUARD:
        lock = _FOLDER_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _FOLDER_LOCKS[key] = lock
        return lock
    
class DriveClient:
    def __init__(self) -> None:
        self.service = self._authorize()


    def _authorize(self):
        creds: Optional[Credentials] = None
        token_path = settings.token_path()
        creds_path = settings.credentials_path()

        if token_path.exists():
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not creds_path.exists():
                    raise FileNotFoundError(
                        f"Google API credentials not found at {creds_path}. Place your OAuth client credentials JSON file there (download from Google Cloud Console)."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
                # Use a more robust local server flow: set host and trailing slash to avoid callback issues
                try:
                    creds = flow.run_local_server(
                        host="localhost",
                        port=0,
                        authorization_prompt_message="Please visit this URL to authorize: {url}",
                        success_message="Authentication complete. You may close this window.",
                        open_browser=True,
                        redirect_uri_trailing_slash=True,
                    )
                except AttributeError:
                    # Fallback to console-based flow if callback wasn't captured
                    creds = flow.run_console()
            # Save the credentials for the next run
            token_path.write_text(creds.to_json(), encoding="utf-8")

        return build("drive", "v3", credentials=creds)

    # ---------- Folders ----------
    def _find_folder(self, name: str, parent_id: Optional[str]) -> Optional[str]:
        q_parts = ["mimeType='application/vnd.google-apps.folder'", "trashed=false"]
        if name:
            q_parts.append(f"name='{name.replace("'", "\\'")}'")
        if parent_id:
            q_parts.append(f"'{parent_id}' in parents")
        q = " and ".join(q_parts)
        res = self.service.files().list(q=q, spaces="drive", fields="files(id, name)").execute()
        files = res.get("files", [])
        return files[0]["id"] if files else None

    def ensure_folder(self, name: str, parent_id: Optional[str]) -> str:
        """
        Ensure a folder with the given name exists under parent_id and return its id.
        Thread-safe and cached per process to avoid duplicate creation under concurrency.
        """
        key = ((parent_id or ""), name)
        lock = _get_folder_lock(parent_id, name)
        with lock:
            # Check cache first
            cached = _FOLDER_CACHE.get(key)
            if cached:
                return cached

            # Lookup existing in Drive (authoritative)
            folder_id = self._find_folder(name, parent_id)
            if folder_id:
                _FOLDER_CACHE[key] = folder_id
                return folder_id

            # Create new folder
            file_metadata = {
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                **({"parents": [parent_id]} if parent_id else {}),
            }
            folder = self.service.files().create(body=file_metadata, fields="id").execute()
            folder_id = folder["id"]
            _FOLDER_CACHE[key] = folder_id
            return folder_id

    def get_main_parent_folder(self) -> Optional[str]:
        if settings.main_drive_folder_id:
            return settings.main_drive_folder_id
        if settings.main_drive_folder_name:
            return self._find_folder(settings.main_drive_folder_name, parent_id=None)
        return None

    # ---------- Files ----------
    def _file_exists_in_folder(self, name: str, parent_id: str) -> bool:
        q = (
            "name='{}' and '{}' in parents and trashed=false".format(
                name.replace("'", "\\'"), parent_id
            )
        )
        res = self.service.files().list(q=q, spaces="drive", fields="files(id)").execute()
        return len(res.get("files", [])) > 0

    def upload_file(self, local_path: Path, upload_name: str, parent_id: Optional[str]) -> dict:
        # De-duplicate name inside folder: append -1, -2, ... if needed
        base, ext = Path(upload_name).stem, Path(upload_name).suffix
        final_name = upload_name
        if parent_id:
            counter = 1
            while self._file_exists_in_folder(final_name, parent_id):
                final_name = f"{base}-{counter}{ext}"
                counter += 1
        media = MediaFileUpload(str(local_path), resumable=False)
        body = {"name": final_name}
        if parent_id:
            body["parents"] = [parent_id]
        file = (
            self.service.files()
            .create(body=body, media_body=media, fields="id, name, webViewLink")
            .execute()
        )
        return file

    # ---------- Public helpers for search/browse ----------
    def find_folder_id(self, name: str, parent_id: Optional[str]) -> Optional[str]:
        """Return folder id if a folder with name exists under parent_id; do not create."""
        return self._find_folder(name, parent_id)

    def list_images_in_folder(self, parent_id: str) -> List[dict]:
        """List image files under a folder. Returns minimal fields for UI."""
        # Google query: images mime types
        q = (
            f"'{parent_id}' in parents and trashed=false and mimeType contains 'image/'"
        )
        items: List[dict] = []
        page_token = None
        while True:
            res = (
                self.service.files()
                .list(
                    q=q,
                    spaces="drive",
                    fields="nextPageToken, files(id, name, mimeType, webViewLink)",
                    pageToken=page_token,
                )
                .execute()
            )
            for f in res.get("files", []):
                items.append(
                    {
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "mimeType": f.get("mimeType"),
                        "webViewLink": f.get("webViewLink"),
                    }
                )
            page_token = res.get("nextPageToken")
            if not page_token:
                break
        return items

    def download_image_bytes(self, file_id: str) -> bytes:
        """Download the original image bytes. Caller may downscale for thumbnails."""
        from googleapiclient.http import MediaIoBaseDownload

        request = self.service.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            # Optionally, could log status.progress()
        return buf.getvalue()
