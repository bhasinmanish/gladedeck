from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from scheduler import start_scheduler, stop_scheduler
from scanner import run_scan, ScanRequest
from alerts import dispatch_alert, AlertRequest
from snapshot import get_snapshot, SnapshotRequest

import logging

load_dotenv()

# Without this, Python defaults to WARNING and every log.info() in the service
# (scheduler start, agent runs, alert counts) is silently dropped.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


def verify_secret(x_service_secret: str = Header(...)):
    if x_service_secret != os.environ["SERVICE_SECRET"]:
        raise HTTPException(status_code=403, detail="Forbidden")


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Glade Deck Scanner Service", lifespan=lifespan)

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "https://gladedeck.com,https://gladedeck-zeta.vercel.app,http://localhost:3000",
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Service-Secret"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/scan", dependencies=[Depends(verify_secret)])
async def scan(request: ScanRequest):
    """Run the scanner for a specific user and write results to Supabase."""
    return await run_scan(request)


@app.post("/alert", dependencies=[Depends(verify_secret)])
async def alert(request: AlertRequest):
    """Dispatch an alert via in-app, push, and/or SMS."""
    return await dispatch_alert(request)


@app.post("/snapshot", dependencies=[Depends(verify_secret)])
async def snapshot(request: SnapshotRequest):
    """Return gap %, volume ratio, SMA distances, sector, and news for a list of tickers."""
    return await get_snapshot(request.tickers)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
