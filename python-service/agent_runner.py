"""
Runs user-created AI agents, on either a daily or an intraday cadence.

Each agent row in `agents` stores a spec:
  - universe_type       : "watchlist" | "holdings" | "symbols" | "market"
  - symbols             : explicit list, used when universe_type == "symbols"
  - structured_triggers : machine-evaluable triggers (see _eval_trigger)
  - run_interval        : "5m" | "15m" | "30m" | "1h" | "4h" | "daily"
  - cooldown_hours      : per-symbol quiet period (falls back to cooldown_days)
  - context             : judgement layer handed to Claude when writing the note
  - output_style        : how the alert note should read

Data strategy — the important bit:
  Slow-moving reference levels (SMAs, average volume, prior close) come from DAILY
  bars via yfinance and are cached once per calendar day. Live prices come from
  TradingView's batch quote endpoint on every tick. That way a "200-day SMA break"
  is detected the moment it happens without ever needing 200 days of minute bars.

Deterministic triggers decide *whether* to speak. Claude decides *what to say*, and
only ever sees real numbers computed here plus real headlines — never a live feed.
"""

import asyncio
import datetime
import json
import logging
import os
from typing import Any, Optional

import yfinance as yf
from supabase import create_client, Client

from news import fetch_news_for_symbols
from email_sender import send_agent_alert_email, get_notif_prefs, get_user_email
# Reuses the batched TradingView quote fetch already proven by the price-alert checker.
from price_alert_checker import _fetch_quotes

log = logging.getLogger(__name__)

HISTORY_PERIOD = "1y"          # enough for a 200-day SMA
MAX_SYMBOLS_PER_AGENT = 60
NEWS_LOOKBACK_HOURS = 72

INTERVAL_MINUTES = {
    "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "daily": 1440,
}
DEFAULT_INTRADAY_COOLDOWN_H = 4.0
DEFAULT_DAILY_COOLDOWN_H    = 168.0   # 7 days

# Daily reference levels, cached per calendar day: {symbol: (date, levels)}
_LEVELS_CACHE: dict[str, tuple[datetime.date, dict]] = {}


def _get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ── Cadence ──────────────────────────────────────────────────────────────────

def _interval_minutes(spec: dict) -> int:
    return INTERVAL_MINUTES.get(str(spec.get("run_interval") or "daily").lower(), 1440)


def _is_due(agent: dict, interval_min: int, now: datetime.datetime) -> bool:
    last = agent.get("last_run_at")
    if not last:
        return True
    try:
        prev = datetime.datetime.fromisoformat(str(last).replace("Z", "+00:00"))
    except ValueError:
        return True
    elapsed_min = (now - prev).total_seconds() / 60
    return elapsed_min >= interval_min - 1   # tolerate scheduler jitter


def _cooldown_hours(spec: dict, interval_min: int) -> float:
    if spec.get("cooldown_hours") is not None:
        return float(spec["cooldown_hours"])
    if spec.get("cooldown_days") is not None:
        return float(spec["cooldown_days"]) * 24
    return DEFAULT_INTRADAY_COOLDOWN_H if interval_min < 1440 else DEFAULT_DAILY_COOLDOWN_H


# ── Universe resolution ──────────────────────────────────────────────────────

def _resolve_universe(db: Client, agent: dict, user_id: str) -> list[str]:
    spec = agent.get("spec") or {}
    kind = (spec.get("universe_type") or "watchlist").lower()

    if kind == "symbols":
        return [s.upper() for s in (spec.get("symbols") or [])][:MAX_SYMBOLS_PER_AGENT]

    if kind == "holdings":
        rows = db.table("trades").select("symbol").eq("user_id", user_id).execute().data or []
        return list(dict.fromkeys(r["symbol"].upper() for r in rows))[:MAX_SYMBOLS_PER_AGENT]

    if kind == "watchlist":
        rows = db.table("watchlists").select("symbols").eq("user_id", user_id).execute().data or []
        out: list[str] = []
        for r in rows:
            for s in (r.get("symbols") or []):
                if s.upper() not in out:
                    out.append(s.upper())
        return out[:MAX_SYMBOLS_PER_AGENT]

    return []   # "market" — not a per-symbol universe


# ── Daily reference levels (cached once per day) ─────────────────────────────

def _daily_levels(symbol: str) -> Optional[dict]:
    """
    Slow-moving levels from daily bars. Cached per calendar day so a 5-minute
    job doesn't hammer yfinance — one fetch per symbol per day.
    """
    today = datetime.date.today()
    cached = _LEVELS_CACHE.get(symbol)
    if cached and cached[0] == today:
        return cached[1]

    try:
        df = yf.Ticker(symbol).history(period=HISTORY_PERIOD)
        if df is None or df.empty or len(df) < 2:
            return None
        closes = [float(c) for c in df["Close"].tolist()]
        volumes = [float(v) for v in df["Volume"].tolist()]
        levels = {
            "closes":        closes,
            "prev_close":    closes[-1],
            "avg_volume_20": sum(volumes[-20:]) / min(20, len(volumes)) if volumes else 0.0,
        }
        _LEVELS_CACHE[symbol] = (today, levels)
        return levels
    except Exception as exc:
        log.warning("Daily levels fetch failed for %s: %s", symbol, exc)
        return None


def _sma(levels: dict, period: int) -> Optional[float]:
    closes = levels.get("closes") or []
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period


def _pct_change_over(levels: dict, bars: int, live_close: float) -> Optional[float]:
    closes = levels.get("closes") or []
    if len(closes) < bars:
        return None
    start = closes[-bars]
    if start == 0:
        return None
    return (live_close - start) / start * 100


def _earnings_in_days(symbol: str) -> Optional[int]:
    try:
        cal = yf.Ticker(symbol).calendar
        dates = cal.get("Earnings Date") if isinstance(cal, dict) else None
        if not dates:
            return None
        nxt = dates[0] if isinstance(dates, (list, tuple)) else dates
        if isinstance(nxt, datetime.datetime):
            nxt = nxt.date()
        return (nxt - datetime.date.today()).days
    except Exception:
        return None


def _recent_news(symbol: str) -> list[dict]:
    try:
        results = asyncio.run(fetch_news_for_symbols([symbol], since_hours=NEWS_LOOKBACK_HOURS))
        return results.get(symbol, [])[:6]
    except Exception as exc:
        log.warning("News fetch failed for %s: %s", symbol, exc)
        return []


# ── Trigger evaluation ───────────────────────────────────────────────────────

def _eval_trigger(trigger: dict, symbol: str, quote: dict, levels: Optional[dict]) -> Optional[dict]:
    """
    Returns evidence (real numbers) when the trigger fires, else None.
    `quote` is the live TradingView row; `levels` are today's daily reference levels.
    """
    ttype = (trigger.get("type") or "").lower()

    if ttype == "earnings_within":
        days_ahead = _earnings_in_days(symbol)
        limit = int(trigger.get("days") or 10)
        if days_ahead is not None and 0 <= days_ahead <= limit:
            return {"trigger": "earnings_within", "days_until_earnings": days_ahead, "limit": limit}
        return None

    live_close = quote.get("close")
    if live_close is None:
        return None
    live_close = float(live_close)

    if ttype == "sma_cross":
        if not levels:
            return None
        period = int(trigger.get("period") or 200)
        sma = _sma(levels, period)
        prev_close = levels.get("prev_close")
        if sma is None or prev_close is None:
            return None

        direction = (trigger.get("direction") or "below").lower()
        # "Crossed since yesterday's close" — stateless, and fires the moment
        # price moves through the level intraday rather than waiting for 4pm.
        crossed_up   = prev_close <= sma and live_close > sma
        crossed_down = prev_close >= sma and live_close < sma
        if (direction == "above" and crossed_up) or (direction == "below" and crossed_down):
            return {
                "trigger":    "sma_cross",
                "period":     period,
                "direction":  direction,
                "close":      round(live_close, 2),
                "sma":        round(sma, 2),
                "prev_close": round(float(prev_close), 2),
            }
        return None

    if ttype in ("drawdown", "gain"):
        window = (trigger.get("window") or "1d").lower()
        threshold = float(trigger.get("pct") or 5)

        if window == "1d":
            pct_move = quote.get("change")          # TradingView day change %
            if pct_move is None and levels:
                prev = levels.get("prev_close")
                pct_move = (live_close - prev) / prev * 100 if prev else None
        else:
            bars = {"5d": 5, "1mo": 21}.get(window, 5)
            pct_move = _pct_change_over(levels, bars, live_close) if levels else None

        if pct_move is None:
            return None
        pct_move = float(pct_move)

        fired = pct_move <= -threshold if ttype == "drawdown" else pct_move >= threshold
        if not fired:
            return None

        evidence = {
            "trigger":   ttype,
            "window":    window,
            "pct_move":  round(pct_move, 2),
            "threshold": threshold,
            "close":     round(live_close, 2),
        }
        if trigger.get("require_volume_spike"):
            rvol = quote.get("relative_volume_10d_calc")
            if rvol is None or float(rvol) < 1.5:
                return None
            evidence["volume_vs_avg"] = round(float(rvol), 2)
        return evidence

    if ttype == "volume_spike":
        multiple = float(trigger.get("multiple") or 2)
        rvol = quote.get("relative_volume_10d_calc")
        if rvol is not None and float(rvol) >= multiple:
            return {
                "trigger":       "volume_spike",
                "volume_vs_avg": round(float(rvol), 2),
                "multiple":      multiple,
                "close":         round(live_close, 2),
            }
        return None

    log.warning("Unknown trigger type: %s", ttype)
    return None


# ── Cooldown ─────────────────────────────────────────────────────────────────

def _recently_alerted(db: Client, agent_id: str, symbol: str, cooldown_hours: float) -> bool:
    since = (datetime.datetime.now(datetime.timezone.utc)
             - datetime.timedelta(hours=cooldown_hours)).isoformat()
    rows = (db.table("agent_alerts")
              .select("id")
              .eq("agent_id", agent_id)
              .eq("symbol", symbol)
              .gte("created_at", since)
              .limit(1)
              .execute().data) or []
    return len(rows) > 0


# ── Note composition ─────────────────────────────────────────────────────────

_NOTE_SYSTEM = """You write short trading alert notes for an agent monitoring a trader's portfolio.

The mechanical trigger is only the messenger — your job is the thesis. Use the recent headlines to
explain whether the move looks like it has a real catalyst behind it or is just noise.

Hard rules on facts:
- The computed evidence and the headlines are the ONLY facts you have.
- Never invent prices, volumes, dates, news, fundamentals, or analyst views beyond them.
- If there are no headlines, say the move has no obvious catalyst — do not speculate about one.
- You have no live feed and no position sizing information.

Write a practical note in 2-4 sentences — no jargon, no hype, no emoji. End with a clear read:
buy, hold, sell, or stay away.

Respond with strict JSON only, no markdown fence:
{"title": "<8 words max>", "body": "<the note>", "conviction": "high" | "medium" | "low"}

Set conviction by how well the trigger and the context agree. A 200-day break on heavy volume with a
confirming headline is high. A marginal cross on quiet volume with no news is low. When the trigger and
the news point in opposite directions, say so and lean low."""


def _compose_note(agent: dict, symbol: str, evidence: dict,
                  headlines: Optional[list[dict]] = None) -> Optional[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        log.warning("ANTHROPIC_API_KEY not set — writing a plain note instead")
        return None

    try:
        import anthropic
    except ImportError:
        log.warning("anthropic package not installed — writing a plain note instead")
        return None

    spec = agent.get("spec") or {}
    if headlines:
        news_block = "\n".join(
            f"- [{h.get('category', 'news')}] {h.get('title')} ({h.get('publisher') or 'unknown'})"
            for h in headlines
        )
    else:
        news_block = "(no notable headlines in the last 3 days)"

    prompt = (
        f"Agent: {agent.get('name')}\n"
        f"Purpose: {agent.get('description') or '—'}\n"
        f"Context the trader cares about: {', '.join(spec.get('context') or []) or '—'}\n"
        f"Preferred alert style: {spec.get('output_style') or 'concise and practical'}\n\n"
        f"Symbol: {symbol}\n"
        f"Computed evidence (mechanical trigger): {json.dumps(evidence)}\n\n"
        f"Recent headlines (context layer):\n{news_block}"
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=400,
            system=_NOTE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        return json.loads(text)
    except Exception as exc:
        log.warning("Note composition failed for %s: %s", symbol, exc)
        return None


def _fallback_note(symbol: str, evidence: dict) -> dict:
    """Used when Claude is unavailable — states the facts, claims nothing more."""
    t = evidence.get("trigger")
    if t == "sma_cross":
        title = f"{symbol} crossed {evidence['direction']} its {evidence['period']}-day SMA"
        body = f"Close {evidence['close']} vs SMA {evidence['sma']}."
    elif t in ("drawdown", "gain"):
        title = f"{symbol} moved {evidence['pct_move']}% ({evidence['window']})"
        body = f"Close {evidence['close']}, threshold {evidence['threshold']}%."
    elif t == "volume_spike":
        title = f"{symbol} volume {evidence['volume_vs_avg']}x average"
        body = f"Close {evidence['close']}."
    elif t == "earnings_within":
        title = f"{symbol} reports in {evidence['days_until_earnings']} days"
        body = "Event risk ahead."
    else:
        title = f"{symbol} triggered {t}"
        body = json.dumps(evidence)
    return {"title": title, "body": body, "conviction": "medium"}


# ── Email delivery ───────────────────────────────────────────────────────────

def _maybe_email(db: Client, user_id: str, agent: dict, symbol: str, note: dict) -> None:
    try:
        prefs = get_notif_prefs(db, user_id)
        if not prefs.get("email_enabled"):
            return
        if prefs.get("email_agents") is False:
            return
        to = get_user_email(db, user_id)
        if not to:
            return
        asyncio.run(send_agent_alert_email(
            to=to,
            agent_name=agent.get("name") or "Agent",
            title=note.get("title", f"{symbol} alert"),
            body=note.get("body"),
            symbol=symbol,
            conviction=note.get("conviction"),
        ))
    except Exception as exc:
        log.warning("Agent email step failed for %s: %s", symbol, exc)


# ── Main entry ───────────────────────────────────────────────────────────────

def run_agents(mode: str = "daily") -> int:
    """
    Evaluate active agents. `mode` is "intraday" (sub-daily cadences, only those
    whose interval has elapsed) or "daily". Returns the number of alerts written.
    """
    db = _get_supabase()
    now = datetime.datetime.now(datetime.timezone.utc)

    all_agents = (db.table("agents").select("*").eq("status", "active").execute().data) or []

    # Pick the agents that belong to this mode and are actually due.
    due: list[tuple[dict, int]] = []
    for agent in all_agents:
        spec = agent.get("spec") or {}
        if not (spec.get("structured_triggers") or []):
            continue
        interval = _interval_minutes(spec)
        wants_intraday = interval < 1440
        if (mode == "intraday") != wants_intraday:
            continue
        if mode == "intraday" and not _is_due(agent, interval, now):
            continue
        due.append((agent, interval))

    if not due:
        log.info("No %s agents due", mode)
        return 0

    # Resolve every universe first so live quotes can be fetched in one batch.
    universes: dict[str, list[str]] = {}
    all_symbols: set[str] = set()
    for agent, _ in due:
        try:
            syms = _resolve_universe(db, agent, agent["user_id"])
        except Exception as exc:
            log.error("Universe resolution failed for %s: %s", agent.get("name"), exc)
            syms = []
        universes[agent["id"]] = syms
        all_symbols.update(syms)

    quotes: dict[str, dict] = {}
    if all_symbols:
        try:
            quotes = asyncio.run(_fetch_quotes(sorted(all_symbols)))
        except Exception as exc:
            log.error("Live quote fetch failed: %s", exc)
            return 0

    written = 0
    for agent, interval in due:
        spec = agent.get("spec") or {}
        triggers = spec.get("structured_triggers") or []
        cooldown_h = _cooldown_hours(spec, interval)
        user_id = agent["user_id"]

        for symbol in universes.get(agent["id"], []):
            quote = quotes.get(symbol)
            if not quote:
                continue
            if _recently_alerted(db, agent["id"], symbol, cooldown_h):
                continue

            levels = _daily_levels(symbol)

            fired: list[dict] = []
            for trigger in triggers:
                try:
                    evidence = _eval_trigger(trigger, symbol, quote, levels)
                except Exception as exc:
                    log.warning("Trigger eval failed (%s / %s): %s", agent.get("name"), symbol, exc)
                    evidence = None
                if evidence:
                    fired.append(evidence)

            if not fired:
                continue

            combined = fired[0] if len(fired) == 1 else {"trigger": "multiple", "signals": fired}
            headlines = _recent_news(symbol)
            note = _compose_note(agent, symbol, combined, headlines) or _fallback_note(symbol, combined)

            try:
                db.table("agent_alerts").insert({
                    "user_id":    user_id,
                    "agent_id":   agent["id"],
                    "title":      note.get("title", f"{symbol} alert")[:200],
                    "body":       note.get("body"),
                    "symbol":     symbol,
                    "conviction": note.get("conviction", "medium"),
                }).execute()
                written += 1
            except Exception as exc:
                log.error("Failed writing alert for %s: %s", symbol, exc)
                continue

            _maybe_email(db, user_id, agent, symbol, note)

        try:
            db.table("agents").update({"last_run_at": now.isoformat()}) \
              .eq("id", agent["id"]).execute()
        except Exception as exc:
            log.warning("Could not update last_run_at for %s: %s", agent.get("name"), exc)

    log.info("Agent run (%s) complete — %d agent(s) evaluated, %d alert(s) written",
             mode, len(due), written)
    return written
