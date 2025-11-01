from dataclasses import dataclass
from pathlib import Path
import os
import base64
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

@dataclass
class Settings:
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    frontend_origin_regex: str | None = os.getenv("FRONTEND_ORIGIN_REGEX") or None
    main_drive_folder_id: str | None = os.getenv("MAIN_DRIVE_FOLDER_ID") or None
    main_drive_folder_name: str | None = os.getenv("MAIN_DRIVE_FOLDER_NAME") or None
    google_credentials_file: str = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    google_token_file: str = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
    google_credentials_json_env: str | None = os.getenv("GOOGLE_CREDENTIALS_JSON") or None
    google_token_json_env: str | None = os.getenv("GOOGLE_TOKEN_JSON") or None
    preview_workers: int = int(os.getenv("PREVIEW_WORKERS", "12"))

    def credentials_path(self) -> Path:
        p = Path(self.google_credentials_file)
        return p if p.is_absolute() else BASE_DIR / p

    def token_path(self) -> Path:
        p = Path(self.google_token_file)
        return p if p.is_absolute() else BASE_DIR / p

    def _decode_possible_b64(self, value: str) -> str:
        """Decode base64 if it looks like base64; otherwise return as-is."""
        value = value.strip()
        if not value:
            return value
        # Heuristic: if it starts with '{' it's raw JSON
        if value.startswith("{"):
            return value
        try:
            decoded = base64.b64decode(value).decode("utf-8")
            # basic sanity check
            return decoded if decoded.strip().startswith("{") else value
        except Exception:
            return value

    def ensure_secret_files(self) -> None:
        """If credentials/token are provided via env vars, materialize them to files expected by the app.
        Safe to call on every startup.
        """
        cred_path = self.credentials_path()
        tok_path = self.token_path()

        if self.google_credentials_json_env:
            content = self._decode_possible_b64(self.google_credentials_json_env)
            cred_path.write_text(content, encoding="utf-8")

        if self.google_token_json_env:
            content = self._decode_possible_b64(self.google_token_json_env)
            tok_path.write_text(content, encoding="utf-8")

settings = Settings()
