from __future__ import annotations
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pathlib import Path
import shutil
import tempfile
import os
from anyio import to_thread
from datetime import datetime, timedelta
from io import BytesIO
import asyncio
from concurrent.futures import ThreadPoolExecutor
from .config import settings

try:
    from PIL import Image
except Exception:
    Image = None  # type: ignore[assignment]

# Enable Pillow to open HEIC/HEIF/AVIF so previews work for those formats
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    # If registration fails, HEIC previews may not render; we'll still try to return original bytes
    pass

# Dedicated thread pool for preview work (download + resize)
PREVIEW_EXECUTOR = ThreadPoolExecutor(max_workers=settings.preview_workers)

from .utils.exif import get_capture_datetime, format_date_folder, format_time_for_name
from .services.gdrive import DriveClient

app = FastAPI(title="GDrive Upload Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    lastModified: List[int] | None = Form(None),
):
    # Initialize Drive client once per request
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()

    results = []

    # Process sequentially to make UI progress simple
    for idx, f in enumerate(files):
        temp_dir = Path(tempfile.mkdtemp(prefix="gdupload_"))
        temp_path = temp_dir / f.filename
        try:
            # Save upload to temp
            with temp_path.open("wb") as out:
                content = await f.read()  # type: ignore[arg-type]
                out.write(content)

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


@app.get("/find_photos")
async def find_photos(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str | None = Query(None, description="End date YYYY-MM-DD (inclusive)"),
):
    """Find photos in date-named folders within an optional date range.

    Returns a flat list of image items with minimal metadata and the matching folders.
    """
    # Parse dates
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d")
        end_dt = datetime.strptime(end, "%Y-%m-%d") if end else start_dt
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="end must be >= start")

    # Build date list
    days = (end_dt - start_dt).days + 1
    date_names = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]

    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()

    # Find matching folders and list images
    items: list[dict] = []
    folders: list[dict] = []

    def _work():
        for dname in date_names:
            fid = drive.find_folder_id(dname, parent_id=main_parent)
            if not fid:
                continue
            folders.append({"id": fid, "name": dname})
            imgs = drive.list_images_in_folder(fid)
            for it in imgs:
                it["folder"] = dname
                items.append(it)

    await to_thread.run_sync(_work)
    return {"folders": folders, "items": items}


@app.get("/preview/{file_id}")
async def preview_image(file_id: str, w: int = 480, q: int = 75):
    """Return a resized JPEG preview for a Drive image file.

    Falls back to original bytes if Pillow is not available.
    """
    drive = DriveClient()

    def _work():
        raw = drive.download_image_bytes(file_id)
        if Image is None:
            return raw, "image/jpeg"  # best effort; original mime may vary
        try:
            im = Image.open(BytesIO(raw))
            im = im.convert("RGB")
            im.thumbnail((w, w))
            out = BytesIO()
            im.save(out, format="JPEG", quality=max(1, min(95, q)))
            return out.getvalue(), "image/jpeg"
        except Exception:
            # On failure, return original
            return raw, "application/octet-stream"

    loop = asyncio.get_running_loop()
    data, ctype = await loop.run_in_executor(PREVIEW_EXECUTOR, _work)
    return Response(content=data, media_type=ctype)
