"""
Morning AI agent — runs at 8:30 AM ET on trading days.

Scans pre-market movers, grabs snapshot data (gap %, volume, SMAs, news),
loads the admin user's stored pattern analysis, then asks Claude to
categorize the top stocks into bullish/bearish/favorites/scalps/explosives.

Saves the result to morning_picks for ADMIN_USER_ID so it appears on the
watchlist page. Skips if picks already exist for today.
"""

import json
import logging
import os
import datetime
import asyncio

import anthropic
from supabase import create_client

from scanner import _scan_tradingview, DEFAULT_FILTERS
from snapshot import get_snapshot

log = logging.getLogger(__name__)


async def run_morning_agent() -> dict:
    admin_id = os.getenv("ADMIN_USER_ID", "")
    if not admin_id:
        log.warning("[morning_agent] ADMIN_USER_ID not set — skipping")
        return {"skipped": True, "reason": "ADMIN_USER_ID not configured"}

    today = datetime.date.today().isoformat()
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # Skip if admin already has manually-entered picks for today
    existing = (
        db.table("morning_picks")
        .select("date, notes")
        .eq("user_id", admin_id)
        .eq("date", today)
        .maybe_single()
        .execute()
    )
    if existing.data:
        notes = existing.data.get("notes", "") or ""
        if not notes.startswith("[AI]"):
            log.info("[morning_agent] Admin already has manual picks for %s — skipping", today)
            return {"skipped": True, "reason": "manual picks already logged"}

    # 1. Scan for pre-market movers
    try:
        rows, _ = await _scan_tradingview(DEFAULT_FILTERS, page=0, page_size=40)
    except Exception as exc:
        log.error("[morning_agent] Scanner failed: %s", exc)
        return {"error": str(exc)}

    if not rows:
        log.warning("[morning_agent] No scanner results")
        return {"error": "no scanner results"}

    symbols = [r["symbol"] for r in rows[:25] if r.get("symbol")]
    if not symbols:
        return {"error": "no symbols"}

    # 2. Get detailed snapshot (pre-market data, SMAs, sector, news)
    try:
        snap = await get_snapshot(symbols)
    except Exception as exc:
        log.error("[morning_agent] Snapshot failed: %s", exc)
        return {"error": str(exc)}

    # 3. Load the admin's most recent pattern analysis
    pattern_rows = (
        db.table("morning_picks")
        .select("pattern_analysis, analysis_updated_at")
        .eq("user_id", admin_id)
        .order("analysis_updated_at", desc=True)
        .limit(5)
        .execute()
    )
    pattern_analysis = ""
    for row in pattern_rows.data or []:
        if row.get("pattern_analysis"):
            pattern_analysis = row["pattern_analysis"]
            break

    # 4. Build prompt
    stock_lines = []
    for sym in symbols:
        d = snap.get(sym, {})
        if not d or d.get("error"):
            continue
        pm = f" pm_gap={d['premarket_gap_pct']}%" if d.get("premarket_gap_pct") is not None else ""
        news = d.get("news", [])
        catalyst = " | " + "; ".join(f'"{n["title"]}"' for n in news[:2]) if news else ""
        stock_lines.append(
            f"{sym}: gap={d.get('gap_pct','?')}%{pm} vol={d.get('vol_ratio','?')}x "
            f"sma20={d.get('sma20_dist','?')}% sma50={d.get('sma50_dist','?')}% "
            f"sma200={d.get('sma200_dist','?')}% sector={d.get('sector','?')}{catalyst}"
        )

    if not stock_lines:
        log.warning("[morning_agent] No usable stock data")
        return {"error": "no usable stock data"}

    pattern_ctx = (
        f"\nYour established patterns (use these to guide categorization):\n{pattern_analysis}\n"
        if pattern_analysis else ""
    )

    prompt = f"""You are generating a pre-market watchlist for a day trader. Today is {today}.
{pattern_ctx}
Pre-market movers right now (sorted by gap/volume):
{chr(10).join(stock_lines)}

Categorize these stocks into a morning watchlist. Only include stocks with a clear edge — keep each list tight and actionable. Do not include a stock in multiple categories unless it truly fits both.

Categories:
- bullish: gap up, strong volume, good SMA setup for longs
- bearish: gap down or showing weakness, short candidates
- favorites: max 3 highest-conviction picks from either direction
- scalps: volatile, good for quick in-and-out momentum trades
- explosives: potential for a very large % move today
- notes: 2-3 sentences on the most important setups to watch and any key levels/catalysts

Output ONLY valid JSON with this exact structure, no extra text:
{{
  "bullish": ["SYMBOL", "SYMBOL"],
  "bearish": ["SYMBOL"],
  "favorites": ["SYMBOL"],
  "scalps": ["SYMBOL", "SYMBOL"],
  "explosives": ["SYMBOL"],
  "notes": "Your notes here."
}}"""

    # 5. Call Claude
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        resp = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
    except Exception as exc:
        log.error("[morning_agent] Claude failed: %s", exc)
        return {"error": f"Claude failed: {exc}"}

    # 6. Save to morning_picks
    try:
        db.table("morning_picks").upsert(
            {
                "user_id":           admin_id,
                "date":              today,
                "bullish_tickers":   result.get("bullish", []),
                "bearish_tickers":   result.get("bearish", []),
                "favorites_tickers": result.get("favorites", []),
                "scalp_tickers":     result.get("scalps", []),
                "explosive_tickers": result.get("explosives", []),
                "notes":             "[AI] " + result.get("notes", ""),
                "market_data":       snap,
            },
            on_conflict="user_id,date",
        ).execute()
    except Exception as exc:
        log.error("[morning_agent] DB save failed: %s", exc)
        return {"error": f"DB save failed: {exc}"}

    log.info(
        "[morning_agent] Done for %s — bullish=%d bearish=%d favorites=%d scalps=%d explosives=%d",
        today,
        len(result.get("bullish", [])),
        len(result.get("bearish", [])),
        len(result.get("favorites", [])),
        len(result.get("scalps", [])),
        len(result.get("explosives", [])),
    )
    return {"ok": True, "date": today, "symbols_processed": len(stock_lines)}
