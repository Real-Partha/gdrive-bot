from __future__ import annotations
from fastapi import APIRouter, Response, UploadFile, File
from io import BytesIO
import asyncio
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

from ..config import settings
from ..services.gdrive import DriveClient

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

router = APIRouter()


@router.get("/preview/{file_id}")
async def preview_image(file_id: str, w: int = 480, q: int = 75):
    """Return a resized JPEG preview for a Drive file (image or video)."""
    drive = DriveClient()

    def _work():
        meta = drive.get_file_metadata(file_id)
        mime = meta.get("mimeType", "")
        raw = drive.download_file_bytes(file_id)
        # If it's a video, extract a frame
        if mime.startswith("video/"):
            try:
                # Write to temp file with extension hint
                ext = ".mp4" if "/mp4" in mime or mime.endswith("mp4") else ".mov"
                with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
                    tf.write(raw)
                    tmp_path = tf.name
                try:
                    import importlib
                    mpe = importlib.import_module("moviepy.editor")
                    clip = mpe.VideoFileClip(tmp_path)
                    duration = max(clip.duration or 0, 0.0)
                    t = min(1.0, duration / 2.0) if duration > 0 else 0
                    frame = clip.get_frame(t)  # numpy array HxWx3
                    clip.close()
                    # Convert to PIL and thumbnail
                    if Image is None:
                        # Fallback: return the raw bytes if PIL unavailable
                        return raw, "application/octet-stream"
                    import importlib
                    np = importlib.import_module("numpy")
                    im = Image.fromarray(np.asarray(frame)).convert("RGB")
                    im.thumbnail((w, w))
                    out = BytesIO()
                    im.save(out, format="JPEG", quality=max(1, min(95, q)))
                    return out.getvalue(), "image/jpeg"
                finally:
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
            except Exception:
                # If thumbnailing fails, return placeholder solid image
                if Image is not None:
                    im = Image.new("RGB", (w, w), color=(30, 30, 30))
                    out = BytesIO()
                    im.save(out, format="JPEG", quality=70)
                    return out.getvalue(), "image/jpeg"
                return raw, "application/octet-stream"
        # Else treat as image
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


@router.post("/preview_local")
async def preview_local(file: UploadFile = File(...), w: int = 320, q: int = 80):
    """Return a resized JPEG preview for an uploaded local file (e.g., HEIC).

    This is used by the frontend to preview formats the browser can't decode natively.
    """
    content = await file.read()  # bytes of the client-selected file

    def _work():
        if Image is None:
            return content, "application/octet-stream"
        try:
            im = Image.open(BytesIO(content))
            im = im.convert("RGB")
            im.thumbnail((w, w))
            out = BytesIO()
            im.save(out, format="JPEG", quality=max(1, min(95, q)))
            return out.getvalue(), "image/jpeg"
        except Exception:
            # On failure, return original bytes (may not render in browser)
            return content, "application/octet-stream"

    loop = asyncio.get_running_loop()
    data, ctype = await loop.run_in_executor(PREVIEW_EXECUTOR, _work)
    return Response(content=data, media_type=ctype)
