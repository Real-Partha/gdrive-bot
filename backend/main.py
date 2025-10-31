from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings

from .routes.upload import router as upload_router
from .routes.find import router as find_router
from .routes.utils import router as utils_router

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


# Include feature routers
app.include_router(upload_router)
app.include_router(find_router)
app.include_router(utils_router)
