from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Form
from typing import List
from pathlib import Path
import shutil
import tempfile
from anyio import to_thread

from ..utils.exif import get_capture_datetime, format_date_folder, format_time_for_name
from ..services.gdrive import DriveClient

router = APIRouter()


@router.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    lastModified: List[int] | None = Form(None),
):
    """Handle file uploads from the client, determine date-based name/folder and upload to Drive."""
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()

    results = []

    # Process sequentially to make UI progress simple
    for idx, f in enumerate(files):
        temp_dir = Path(tempfile.mkdtemp(prefix="gdupload_"))
        temp_path = temp_dir / f.filename
        try:
            # Save upload to temp in chunks to avoid large memory usage
            with temp_path.open("wb") as out:
                while True:
                    chunk = await f.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    out.write(chunk)

            # Determine client-provided modified time (ms) if available
            lm_ts: float | None = None
            try:
                if isinstance(lastModified, list) and lastModified:
                    # If multiple values provided, try matching by index; else use the first
                    val = lastModified[idx] if idx < len(lastModified) else lastModified[0]
                    # Browser File.lastModified is milliseconds
                    lm_ts = float(val) / 1000.0
            except Exception:
                lm_ts = None

            # Heavy work (EXIF parsing and Drive API) offloaded to thread to avoid blocking event loop
            def _process_sync():
                dt = get_capture_datetime(temp_path, fallback_ts=lm_ts)
                date_folder_name = format_date_folder(dt)
                time_part = format_time_for_name(dt)
                ext = ''.join(Path(f.filename).suffixes) or ""
                new_name = f"{date_folder_name}_{time_part}{ext}"

                # Ensure date folder under main parent
                date_folder_id = drive.ensure_folder(date_folder_name, parent_id=main_parent)

                # Upload file with new name
                uploaded = drive.upload_file(temp_path, new_name, parent_id=date_folder_id)

                return date_folder_name, new_name, uploaded

            date_folder_name, new_name, uploaded = await to_thread.run_sync(_process_sync)

            results.append(
                {
                    "originalName": f.filename,
                    "newName": uploaded.get("name", new_name),
                    "dateFolder": date_folder_name,
                    "status": "ok",
                    "fileId": uploaded.get("id"),
                    "webViewLink": uploaded.get("webViewLink"),
                }
            )
        except Exception as e:
            results.append(
                {
                    "originalName": f.filename,
                    "status": "error",
                    "error": str(e),
                }
            )
        finally:
            # Cleanup temp file/dir
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

    return {"results": results}
