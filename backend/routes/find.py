from __future__ import annotations
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
from anyio import to_thread

from ..services.gdrive import DriveClient

router = APIRouter()


@router.get("/find_photos")
async def find_photos(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str | None = Query(None, description="End date YYYY-MM-DD (inclusive)"),
):
    """Find photos in date-named folders within an optional date range.

    Returns a flat list of media items (images + videos) with minimal metadata and the matching folders.
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

    # Find matching folders and list media (images + videos)
    items: list[dict] = []
    folders: list[dict] = []

    def _work():
        for dname in date_names:
            fid = drive.find_folder_id(dname, parent_id=main_parent)
            if not fid:
                continue
            folders.append({"id": fid, "name": dname})
            media = drive.list_media_in_folder(fid)
            for it in media:
                it["folder"] = dname
                items.append(it)

    await to_thread.run_sync(_work)
    return {"folders": folders, "items": items}
