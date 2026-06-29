from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from scheduler import start_scheduler, stop_scheduler
from scanner import run_scan, ScanRequest
from alerts import dispatch_alert, AlertRequest

import os

load_dotenv()


def verify_secret(x_service_secret: str = Header(...)):
    if x_service_secret != os.environ["SERVICE_SECRET"]:
        raise HTTPException(status_code=403, detail="Forbidden")


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Glade Scanner Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your Vercel domain in production
    allow_methods=["*"],
    allow_headers=["*"],
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
