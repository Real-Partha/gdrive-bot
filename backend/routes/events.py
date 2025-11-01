from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from io import BytesIO
import json

from ..services.gdrive import DriveClient

router = APIRouter()

EVENTS_FILENAME = "events.json"
SAVED_FOLDER_NAME = "saved"


class Event(BaseModel):
    id: str
    name: str
    start: str  # ISO datetime string (e.g., 2025-11-01T14:00)
    end: str    # ISO datetime string


def _ensure_saved_folder(drive: DriveClient, main_parent: Optional[str]) -> str:
    # Ensure a 'saved' folder under main parent
    return drive.ensure_folder(SAVED_FOLDER_NAME, parent_id=main_parent)


def _find_file_in_folder_by_name(drive: DriveClient, parent_id: str, name: str) -> Optional[str]:
    svc = drive.service
    q = (
        "name='{}' and '{}' in parents and trashed=false".format(
            name.replace("'", "\\'"), parent_id
        )
    )
    res = svc.files().list(q=q, spaces="drive", fields="files(id, name)").execute()
    files = res.get("files", [])
    return files[0]["id"] if files else None


def _download_events(drive: DriveClient, saved_folder_id: str) -> List[Event]:
    file_id = _find_file_in_folder_by_name(drive, saved_folder_id, EVENTS_FILENAME)
    if not file_id:
        return []
    data = drive.download_file_bytes(file_id)
    try:
        raw = json.loads(data.decode("utf-8"))
        events = [Event(**e) for e in raw if isinstance(e, dict)]
        return events
    except Exception:
        return []


def _upload_events(drive: DriveClient, saved_folder_id: str, events: List[Event]) -> None:
    payload = json.dumps([e.dict() for e in events], ensure_ascii=False).encode("utf-8")
    buf = BytesIO(payload)
    from googleapiclient.http import MediaIoBaseUpload

    media = MediaIoBaseUpload(buf, mimetype="application/json", resumable=False)
    svc = drive.service
    file_id = _find_file_in_folder_by_name(drive, saved_folder_id, EVENTS_FILENAME)
    if file_id:
        svc.files().update(fileId=file_id, media_body=media).execute()
    else:
        body = {"name": EVENTS_FILENAME, "mimeType": "application/json", "parents": [saved_folder_id]}
        svc.files().create(body=body, media_body=media, fields="id").execute()


@router.get("/events")
async def get_events():
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()
    saved_id = _ensure_saved_folder(drive, main_parent)
    events = _download_events(drive, saved_id)
    return {"events": [e.dict() for e in events]}


class UpsertEventRequest(BaseModel):
    id: Optional[str] = None
    name: str
    start: str
    end: str


@router.post("/events")
async def add_event(req: UpsertEventRequest):
    from uuid import uuid4
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()
    saved_id = _ensure_saved_folder(drive, main_parent)
    events = _download_events(drive, saved_id)

    ev = Event(id=req.id or str(uuid4()), name=req.name, start=req.start, end=req.end)
    # Simple validation
    try:
        s = datetime.fromisoformat(ev.start)
        e = datetime.fromisoformat(ev.end)
        if e < s:
            raise HTTPException(status_code=400, detail="end must be >= start")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format; use ISO like 2025-11-01T14:00")

    # Upsert by id
    by_id = {e.id: e for e in events}
    by_id[ev.id] = ev
    new_events = list(by_id.values())
    _upload_events(drive, saved_id, new_events)
    return {"events": [e.dict() for e in new_events]}


class ReplaceEventsRequest(BaseModel):
    events: List[Event]


@router.put("/events")
async def replace_events(req: ReplaceEventsRequest):
    # Validate all
    for ev in req.events:
        try:
            s = datetime.fromisoformat(ev.start)
            e = datetime.fromisoformat(ev.end)
            if e < s:
                raise HTTPException(status_code=400, detail="end must be >= start")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format in list")
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()
    saved_id = _ensure_saved_folder(drive, main_parent)
    _upload_events(drive, saved_id, req.events)
    return {"events": [e.dict() for e in req.events]}


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()
    saved_id = _ensure_saved_folder(drive, main_parent)
    events = _download_events(drive, saved_id)
    new_events = [e for e in events if e.id != event_id]
    _upload_events(drive, saved_id, new_events)
    return {"events": [e.dict() for e in new_events]}


# ---- Find by events ----
class FindByEventsRequest(BaseModel):
    eventIds: List[str]


def _merge_intervals(ranges: List[Tuple[datetime, datetime]]) -> List[Tuple[datetime, datetime]]:
    if not ranges:
        return []
    ranges = sorted(ranges, key=lambda x: x[0])
    merged: List[Tuple[datetime, datetime]] = []
    cur_s, cur_e = ranges[0]
    for s, e in ranges[1:]:
        if s <= cur_e:
            if e > cur_e:
                cur_e = e
        else:
            merged.append((cur_s, cur_e))
            cur_s, cur_e = s, e
    merged.append((cur_s, cur_e))
    return merged


def _dates_between(s: datetime, e: datetime) -> List[str]:
    days = (e.date() - s.date()).days
    return [(s.date() + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days + 1)]


def _parse_dt_from_name(name: str) -> Optional[datetime]:
    # Expect formats like YYYY-MM-DD_HH-MM-SS.ext
    import re
    m = re.match(r"^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})", name)
    if not m:
        return None
    d, t = m.group(1), m.group(2)
    try:
        return datetime.strptime(f"{d} {t}", "%Y-%m-%d %H-%M-%S")
    except Exception:
        return None


@router.post("/find_by_events")
async def find_by_events(req: FindByEventsRequest):
    # Load events
    drive = DriveClient()
    main_parent = drive.get_main_parent_folder()
    saved_id = _ensure_saved_folder(drive, main_parent)
    events = _download_events(drive, saved_id)
    by_id = {e.id: e for e in events}
    chosen: List[Tuple[datetime, datetime]] = []
    for eid in req.eventIds:
        ev = by_id.get(eid)
        if not ev:
            continue
        try:
            s = datetime.fromisoformat(ev.start)
            e = datetime.fromisoformat(ev.end)
            if e < s:
                s, e = e, s
            chosen.append((s, e))
        except ValueError:
            continue
    if not chosen:
        return {"folders": [], "items": []}

    merged = _merge_intervals(chosen)

    # Collect involved date folders
    dates_needed: List[str] = []
    for s, e in merged:
        dates_needed.extend(_dates_between(s, e))
    dates_needed = sorted(set(dates_needed))

    # Fetch items from those date folders and filter by time window
    items: List[dict] = []
    folders: List[dict] = []

    for dname in dates_needed:
        fid = drive.find_folder_id(dname, parent_id=main_parent)
        if not fid:
            continue
        folders.append({"id": fid, "name": dname})
        media = drive.list_media_in_folder(fid)
        # Filter each media by merged windows using filename time
        for it in media:
            dt = _parse_dt_from_name(it.get("name") or "")
            if not dt:
                continue
            for s, e in merged:
                if s <= dt <= e:
                    it["folder"] = dname
                    items.append(it)
                    break

    # Sort items by datetime ascending
    items.sort(key=lambda it: (_parse_dt_from_name(it.get("name") or "") or datetime.min))
    return {"folders": folders, "items": items}
