"""
Runs user-created AI agents.

Each agent row in `agents` stores a spec:
  - universe_type       : "watchlist" | "holdings" | "symbols" | "market"
  - symbols             : explicit list, used when universe_type == "symbols"
  - structured_triggers : machine-evaluable triggers (see _eval_trigger)
  - cooldown_days       : per-symbol quiet period after an alert fires
  - context             : judgement layer handed to Claude when writing the note
  - output_style        : how the alert note should read

Deterministic triggers decide *whether* to speak. Claude decides *what to say*,
and is only ever given real numbers computed here — it never sees a live feed and
is instructed not to invent data.
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

log = logging.getLogger(__name__)

HISTORY_PERIOD = "1y"          # enough for a 200-day SMA
DEFAULT_COOLDOWN_DAYS = 7
MAX_SYMBOLS_PER_AGENT = 60     # guard against runaway universes
NEWS_LOOKBACK_HOURS = 72       # context window for headlines attached to an alert


def _get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


# ── Universe resolution ──────────────────────────────────────────────────────

def _resolve_universe(db: Client, agent: dict, user_id: str) -> list[str]:
    spec = agent.get("spec") or {}
    kind = (spec.get("universe_type") or "watchlist").lower()

    if kind == "symbols":
        symbols = spec.get("symbols") or []
        return [s.upper() for s in symbols][:MAX_SYMBOLS_PER_AGENT]

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

    # "market" — not a per-symbol universe; handled as a no-op for now.
    return []


# ── Market data ──────────────────────────────────────────────────────────────

def _history(symbol: str, cache: dict[str, Any]) -> Optional[Any]:
    """Daily OHLCV for a symbol, cached for the duration of a run."""
    if symbol in cache:
        return cache[symbol]
    try:
        df = yf.Ticker(symbol).history(period=HISTORY_PERIOD)
        cache[symbol] = df if df is not None and not df.empty else None
    except Exception as exc:
        log.warning("History fetch failed for %s: %s", symbol, exc)
        cache[symbol] = None
    return cache[symbol]


def _earnings_in_days(symbol: str) -> Optional[int]:
    """Calendar days until the next earnings date, if yfinance knows one."""
    try:
        cal = yf.Ticker(symbol).calendar
        dates = None
        if isinstance(cal, dict):
            dates = cal.get("Earnings Date")
        if not dates:
            return None
        nxt = dates[0] if isinstance(dates, (list, tuple)) else dates
        if isinstance(nxt, datetime.datetime):
            nxt = nxt.date()
        return (nxt - datetime.date.today()).days
    except Exception:
        return None


# ── Trigger evaluation ───────────────────────────────────────────────────────

def _eval_trigger(trigger: dict, symbol: str, cache: dict[str, Any]) -> Optional[dict]:
    """
    Returns a dict of evidence when the trigger fires, else None.
    The evidence is what gets handed to Claude, so it must be real numbers.
    """
    ttype = (trigger.get("type") or "").lower()

    if ttype == "earnings_within":
        days_ahead = _earnings_in_days(symbol)
        limit = int(trigger.get("days") or 10)
        if days_ahead is not None and 0 <= days_ahead <= limit:
            return {"trigger": "earnings_within", "days_until_earnings": days_ahead, "limit": limit}
        return None

    df = _history(symbol, cache)
    if df is None or len(df) < 2:
        return None

    close = df["Close"]
    volume = df["Volume"]
    last_close = float(close.iloc[-1])

    if ttype == "sma_cross":
        period = int(trigger.get("period") or 200)
        if len(close) < period + 1:
            return None
        sma = close.rolling(period).mean()
        prev_c, last_c = float(close.iloc[-2]), last_close
        prev_s, last_s = float(sma.iloc[-2]), float(sma.iloc[-1])
        direction = (trigger.get("direction") or "below").lower()
        crossed_up   = prev_c <= prev_s and last_c > last_s
        crossed_down = prev_c >= prev_s and last_c < last_s
        if (direction == "above" and crossed_up) or (direction == "below" and crossed_down):
            return {
                "trigger": "sma_cross",
                "period": period,
                "direction": direction,
                "close": round(last_c, 2),
                "sma": round(last_s, 2),
            }
        return None

    if ttype in ("drawdown", "gain"):
        window = (trigger.get("window") or "1d").lower()
        bars = {"1d": 1, "5d": 5, "1mo": 21}.get(window, 1)
        if len(close) < bars + 1:
            return None
        start = float(close.iloc[-1 - bars])
        pct_move = (last_close - start) / start * 100
        threshold = float(trigger.get("pct") or 5)

        fired = pct_move <= -threshold if ttype == "drawdown" else pct_move >= threshold
        if not fired:
            return None

        evidence = {
            "trigger": ttype,
            "window": window,
            "pct_move": round(pct_move, 2),
            "threshold": threshold,
            "close": round(last_close, 2),
        }

        if trigger.get("require_volume_spike"):
            ratio = _volume_ratio(volume)
            if ratio is None or ratio < 1.5:
                return None
            evidence["volume_vs_avg"] = round(ratio, 2)
        return evidence

    if ttype == "volume_spike":
        multiple = float(trigger.get("multiple") or 2)
        ratio = _volume_ratio(volume)
        if ratio is not None and ratio >= multiple:
            return {
                "trigger": "volume_spike",
                "volume_vs_avg": round(ratio, 2),
                "multiple": multiple,
                "close": round(last_close, 2),
            }
        return None

    log.warning("Unknown trigger type: %s", ttype)
    return None


def _recent_news(symbol: str) -> list[dict]:
    """Recent important headlines for a symbol — the context layer for the note."""
    try:
        results = asyncio.run(fetch_news_for_symbols([symbol], since_hours=NEWS_LOOKBACK_HOURS))
        return results.get(symbol, [])[:6]
    except Exception as exc:
        log.warning("News fetch failed for %s: %s", symbol, exc)
        return []


def _volume_ratio(volume) -> Optional[float]:
    """Latest volume as a multiple of its trailing 20-day average."""
    if len(volume) < 21:
        return None
    avg = float(volume.iloc[-21:-1].mean())
    if avg <= 0:
        return None
    return float(volume.iloc[-1]) / avg


# ── Cooldown ─────────────────────────────────────────────────────────────────

def _recently_alerted(db: Client, agent_id: str, symbol: str, cooldown_days: int) -> bool:
    since = (datetime.datetime.now(datetime.timezone.utc)
             - datetime.timedelta(days=cooldown_days)).isoformat()
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
    """Email the note if the user has email alerts and agent alerts both enabled."""
    try:
        prefs = get_notif_prefs(db, user_id)
        if not prefs.get("email_enabled"):
            return
        # email_agents defaults to True when the column/row is absent.
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

def run_agents() -> int:
    """Evaluate every active agent. Returns the number of alerts written."""
    db = _get_supabase()

    agents = (db.table("agents")
                .select("*")
                .eq("status", "active")
                .execute().data) or []

    if not agents:
        log.info("No active agents")
        return 0

    history_cache: dict[str, Any] = {}
    written = 0

    for agent in agents:
        spec = agent.get("spec") or {}
        triggers = spec.get("structured_triggers") or []
        if not triggers:
            log.info("Agent %s has no structured triggers — skipping", agent.get("name"))
            continue

        cooldown = int(spec.get("cooldown_days") or DEFAULT_COOLDOWN_DAYS)
        user_id = agent["user_id"]

        try:
            symbols = _resolve_universe(db, agent, user_id)
        except Exception as exc:
            log.error("Universe resolution failed for agent %s: %s", agent.get("name"), exc)
            continue

        for symbol in symbols:
            if _recently_alerted(db, agent["id"], symbol, cooldown):
                continue

            fired: list[dict] = []
            for trigger in triggers:
                try:
                    evidence = _eval_trigger(trigger, symbol, history_cache)
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
            db.table("agents").update({
                "last_run_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }).eq("id", agent["id"]).execute()
        except Exception as exc:
            log.warning("Could not update last_run_at for %s: %s", agent.get("name"), exc)

    log.info("Agent run complete — %d alert(s) written", written)
    return written
