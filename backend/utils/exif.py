from __future__ import annotations
from datetime import datetime
import os
from pathlib import Path
import exifread
from io import BytesIO
import sys

HEIC_EXTS = {".heic", ".heif", ".heics", ".avif"}

EXIF_DATE_TAGS = [
    "EXIF DateTimeOriginal",
    "EXIF DateTimeDigitized",
    "Image DateTime",
]


def parse_exif_datetime(dt_str: str) -> datetime | None:
    # Common EXIF formats: "YYYY:MM:DD HH:MM:SS"
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(dt_str, fmt)
        except Exception:
            continue
    return None


def _fs_timestamp_datetime(p: Path) -> datetime:
    """Return a best-effort filesystem timestamp as datetime.

    Precedence:
    - Creation/birth time when available (Windows: st_ctime, macOS: st_birthtime)
    - Otherwise, modified time (st_mtime)
    """
    try:
        st = p.stat()
        # macOS provides st_birthtime
        birth = getattr(st, 'st_birthtime', None)
        if isinstance(birth, (int, float)) and birth > 0:
            return datetime.fromtimestamp(birth)
        # Windows uses st_ctime as creation time
        if os.name == 'nt' or sys.platform.startswith('win'):
            return datetime.fromtimestamp(st.st_ctime)
        # Fallback to modified time
        return datetime.fromtimestamp(st.st_mtime)
    except Exception:
        return datetime.now()


def get_capture_datetime(path: str | os.PathLike[str], fallback_ts: float | None = None) -> datetime:
    p = Path(path)
    suffix = p.suffix.lower()
    # Try EXIF for JPEG/TIFF directly
    if suffix not in HEIC_EXTS:
        try:
            with p.open('rb') as f:
                tags = exifread.process_file(f, details=False)
                for key in EXIF_DATE_TAGS:
                    if key in tags:
                        dt_val = str(tags[key])
                        dt = parse_exif_datetime(dt_val)
                        if dt:
                            return dt
        except Exception:
            # Ignore and fallback
            pass
    else:
        # HEIC/HEIF/AVIF: use pillow-heif to read embedded EXIF and parse
        try:
            try:
                from pillow_heif import read_heif
            except Exception:
                read_heif = None  # type: ignore[assignment]

            if read_heif is not None:
                hf = read_heif(str(p))
                exif_bytes = None
                # Common API: info dict may contain raw EXIF bytes
                info = getattr(hf, 'info', {}) or {}
                exif_bytes = info.get('exif') if isinstance(info, dict) else None

                # Some versions expose .metadata list with {'type': 'Exif', 'data': bytes}
                if not exif_bytes:
                    meta_list = getattr(hf, 'metadata', None)
                    if isinstance(meta_list, (list, tuple)):
                        for md in meta_list:
                            if isinstance(md, dict) and md.get('type', '').lower() == 'exif':
                                exif_bytes = md.get('data')
                                break

                if exif_bytes:
                    b = exif_bytes
                    # Strip leading Exif header if present
                    if isinstance(b, (bytes, bytearray)) and b[:6] == b'Exif\x00\x00':
                        b = b[6:]
                    try:
                        tags = exifread.process_file(BytesIO(b), details=False)
                        for key in EXIF_DATE_TAGS:
                            if key in tags:
                                dt_val = str(tags[key])
                                dt = parse_exif_datetime(dt_val)
                                if dt:
                                    return dt
                    except Exception:
                        pass
        except Exception:
            # Ignore and fallback
            pass

    # No EXIF date found, fallback sequence
    # 1) Client-provided timestamp (e.g., browser File.lastModified)
    if isinstance(fallback_ts, (int, float)) and fallback_ts > 0:
        try:
            return datetime.fromtimestamp(fallback_ts)
        except Exception:
            pass
    # 2) Filesystem timestamps (creation/birth time if available, else modified)
    return _fs_timestamp_datetime(p)


def format_date_folder(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def format_time_for_name(dt: datetime) -> str:
    return dt.strftime("%H-%M-%S")
