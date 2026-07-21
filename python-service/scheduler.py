"""
APScheduler configuration.

Schedule:
  06:00–20:00 ET every 15 min  — market-wide news monitor (all active stocks)
  07:30 ET                     — pre-market scanner scan
  09:30 ET                     — market open scanner scan
  09:35–16:00 ET every 5 min   — intraday scanner scans

Scanner scans also fire scanner-specific alerts (entry, high RVOL, big gap).
The market monitor fires news alerts for any actively traded stock or watchlist stock.
"""

import asyncio
import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import create_client

from scanner import run_scan, ScanRequest
from market_monitor import run_market_monitor
from price_alert_checker import check_price_alerts
from agent_runner import run_agents

log = logging.getLogger(__name__)

_scheduler = BackgroundScheduler(timezone="America/New_York")


def _get_all_user_ids() -> list[str]:
    db = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    # Query distinct user_ids from watchlists as a proxy for active users
    result = db.table("watchlists").select("user_id").execute()
    seen: set[str] = set()
    ids: list[str] = []
    for r in result.data or []:
        uid = r["user_id"]
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)
    return ids


def _scan_job():
    try:
        user_ids = _get_all_user_ids()
    except Exception as exc:
        log.error("Could not fetch user ids: %s", exc)
        return

    for uid in user_ids:
        try:
            asyncio.run(run_scan(ScanRequest(user_id=uid)))
        except Exception as exc:
            log.error("Scan failed for user %s: %s", uid, exc)


def _market_monitor_job():
    try:
        user_ids = _get_all_user_ids()
    except Exception as exc:
        log.error("Market monitor could not fetch user ids: %s", exc)
        return

    if user_ids:
        try:
            asyncio.run(run_market_monitor(user_ids))
        except Exception as exc:
            log.error("Market monitor failed: %s", exc)


def _price_alert_job():
    try:
        asyncio.run(check_price_alerts())
    except Exception as exc:
        log.error("Price alert checker failed: %s", exc)


def _agent_job():
    try:
        run_agents()
    except Exception as exc:
        log.error("Agent run failed: %s", exc)


def start_scheduler():
    # Market-wide news monitor every 15 min during extended hours (6 AM – 8 PM ET)
    _scheduler.add_job(
        _market_monitor_job,
        CronTrigger(
            hour="6-20",
            minute="0,15,30,45",
            day_of_week="mon-fri",
        ),
        id="market_monitor",
    )
    # Price alert checker every 2 min from 7:00 to 20:00 ET
    _scheduler.add_job(
        _price_alert_job,
        CronTrigger(
            hour="7-20",
            minute="*/2",
            day_of_week="mon-fri",
        ),
        id="price_alerts",
    )
    # Pre-market scanner scan at 07:30 ET
    _scheduler.add_job(
        _scan_job,
        CronTrigger(hour=7, minute=30, day_of_week="mon-fri"),
        id="premarket",
    )
    # Market open scanner scan at 09:30 ET
    _scheduler.add_job(
        _scan_job,
        CronTrigger(hour=9, minute=30, day_of_week="mon-fri"),
        id="open",
    )
    # Intraday scanner every 5 min from 09:35 to 16:00 ET
    _scheduler.add_job(
        _scan_job,
        CronTrigger(
            hour="9-15",
            minute="35,40,45,50,55,0,5,10,15,20,25,30",
            day_of_week="mon-fri",
        ),
        id="intraday",
    )
    # AI agents — after the close (16:15 ET) so daily bars are settled,
    # plus a pre-open pass at 08:00 ET for earnings/event style agents.
    _scheduler.add_job(
        _agent_job,
        CronTrigger(hour=16, minute=15, day_of_week="mon-fri"),
        id="agents_close",
    )
    _scheduler.add_job(
        _agent_job,
        CronTrigger(hour=8, minute=0, day_of_week="mon-fri"),
        id="agents_open",
    )
    _scheduler.start()
    log.info("Scheduler started.")


def stop_scheduler():
    _scheduler.shutdown(wait=False)
