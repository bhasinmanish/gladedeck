from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import logging

from scheduler import start_scheduler, stop_scheduler
from scanner import run_scan, ScanRequest
from alerts import dispatch_alert, AlertRequest
from snapshot import get_snapshot, SnapshotRequest
from morning_agent import run_morning_agent
from pick_analyzer import run_analysis_for_user

log = logging.getLogger(__name__)

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


@app.post("/morning-agent/run", dependencies=[Depends(verify_secret)])
async def trigger_morning_agent():
    """Manually trigger the morning AI watchlist agent."""
    try:
        return await run_morning_agent()
    except Exception as exc:
        log.error("[morning_agent] Unhandled error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


class AnalyzePicksRequest(BaseModel):
    user_id: str


@app.post("/analyze-picks", dependencies=[Depends(verify_secret)])
async def analyze_picks(request: AnalyzePicksRequest, background_tasks: BackgroundTasks):
    """Kick off pattern analysis for a user. Runs Claude in the background — returns immediately."""
    log.info("[analyze_picks] Starting background analysis for user %s", request.user_id)
    background_tasks.add_task(run_analysis_for_user, request.user_id)
    return {"status": "started"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
