from dataclasses import dataclass
from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

@dataclass
class Settings:
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    main_drive_folder_id: str | None = os.getenv("MAIN_DRIVE_FOLDER_ID") or None
    main_drive_folder_name: str | None = os.getenv("MAIN_DRIVE_FOLDER_NAME") or None
    google_credentials_file: str = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    google_token_file: str = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
    preview_workers: int = int(os.getenv("PREVIEW_WORKERS", "12"))

    def credentials_path(self) -> Path:
        p = Path(self.google_credentials_file)
        return p if p.is_absolute() else BASE_DIR / p

    def token_path(self) -> Path:
        p = Path(self.google_token_file)
        return p if p.is_absolute() else BASE_DIR / p

settings = Settings()
