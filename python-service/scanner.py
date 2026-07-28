"""
TradingView screener — supports dynamic filters, rich columns, and pagination.

Default filter criteria (used by scheduler):
  Gap%      >= 3
  Avg vol   >= 500_000
  ATR       >= 0.5
"""

import os
import datetime
import logging
from typing import Any
import httpx
from pydantic import BaseModel
from supabase import create_client, Client
from alert_triggers import check_and_fire_alerts

log = logging.getLogger(__name__)


# ─── Models ───────────────────────────────────────────────────────────────────

ALLOWED_FILTER_FIELDS = {
    "gap", "average_volume_10d_calc", "ATR", "close", "change",
    "relative_volume_10d_calc", "sector", "market_cap_basic",
    "float_shares_outstanding", "volume", "EPS_diluted_TTM",
    "P/E", "return_on_equity", "debt_to_equity", "beta_1_year",
    "RSI", "change_from_open", "Perf.1W", "Perf.1M", "short_ratio",
    "gross_margin", "net_margin", "name",
}

ALLOWED_FILTER_OPERATIONS = {
    "greater", "less", "greater_or_equal", "less_or_equal",
    "equal", "not_equal", "in_range", "not_in_range",
}


class FilterItem(BaseModel):
    left: str
    operation: str
    right: float

    def validate_fields(self) -> None:
        if self.left not in ALLOWED_FILTER_FIELDS:
            raise ValueError(f"Unknown filter field: {self.left!r}")
        if self.operation not in ALLOWED_FILTER_OPERATIONS:
            raise ValueError(f"Unknown filter operation: {self.operation!r}")


class ScanRequest(BaseModel):
    user_id: str
    filters: list[FilterItem] | None = None
    page: int = 0
    page_size: int = 50


# ─── TradingView config ───────────────────────────────────────────────────────

TRADINGVIEW_URL = "https://scanner.tradingview.com/america/scan"

# All columns requested from TradingView — order determines index in the response
TV_COLUMNS = [
    "name",                      # 0  → symbol
    "close",                     # 1  → price
    "change",                    # 2  → change_pct
    "gap",                       # 3  → gap_pct
    "relative_volume_10d_calc",  # 4  → rvol
    "ATR",                       # 5  → atr
    "sector",                    # 6  → sector
    "market_cap_basic",          # 7  → market_cap
    "float_shares_outstanding",  # 8  → float_shares
    "volume",                    # 9  → volume
    "average_volume_10d_calc",   # 10 → avg_volume
    "EPS_diluted_TTM",           # 11 → eps
    "P/E",                       # 12 → pe
    "return_on_equity",          # 13 → roe
    "debt_to_equity",            # 14 → debt_equity
    "beta_1_year",               # 15 → beta
    "RSI",                       # 16 → rsi
    "change_from_open",          # 17 → change_from_open
    "Perf.1W",                   # 18 → perf_1w
    "Perf.1M",                   # 19 → perf_1m
    "short_ratio",               # 20 → short_ratio
    "gross_margin",              # 21 → gross_margin
    "net_margin",                # 22 → net_margin
]

DEFAULT_FILTERS = [
    {"left": "gap", "operation": "greater", "right": 3},
    {"left": "average_volume_10d_calc", "operation": "greater", "right": 500_000},
    {"left": "ATR", "operation": "greater", "right": 0.5},
]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _map_row(item: dict[str, Any]) -> dict[str, Any] | None:
    d = item.get("d", [])
    if len(d) < len(TV_COLUMNS):
        return None
    symbol = (item.get("s", "") or "").split(":")[-1]
    if not symbol:
        return None
    return {
        "symbol":           symbol,
        "price":            d[1]  or 0,
        "change_pct":       d[2]  or 0,
        "gap_pct":          d[3]  or 0,
        "rvol":             d[4]  or 0,
        "atr":              d[5]  or 0,
        "sector":           d[6],
        "market_cap":       d[7],
        "float_shares":     d[8],
        "volume":           d[9],
        "avg_volume":       d[10],
        "eps":              d[11],
        "pe":               d[12],
        "roe":              d[13],
        "debt_equity":      d[14],
        "beta":             d[15],
        "rsi":              d[16],
        "change_from_open": d[17],
        "perf_1w":          d[18],
        "perf_1m":          d[19],
        "short_ratio":      d[20],
        "gross_margin":     d[21],
        "net_margin":       d[22],
        "catalyst_tag":     None,
    }


# ─── TradingView scan ─────────────────────────────────────────────────────────

async def _scan_tradingview(
    filters: list[dict[str, Any]] | None,
    page: int,
    page_size: int,
) -> tuple[list[dict[str, Any]], int]:
    payload: dict[str, Any] = {
        "filter": filters if filters is not None else DEFAULT_FILTERS,
        "options": {"lang": "en"},
        "markets": ["america"],
        "symbols": {"query": {"types": []}, "tickers": []},
        "columns": TV_COLUMNS,
        "sort": {"sortBy": "relative_volume_10d_calc", "sortOrder": "desc"},
        "range": [page * page_size, (page + 1) * page_size],
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(TRADINGVIEW_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()

    total_count: int = data.get("totalCount", 0)
    results: list[dict[str, Any]] = []
    for item in data.get("data", []):
        row = _map_row(item)
        if row:
            results.append(row)
    return results, total_count


# ─── Polygon fallback ─────────────────────────────────────────────────────────

async def _scan_polygon() -> tuple[list[dict[str, Any]], int]:
    api_key = os.environ.get("POLYGON_API_KEY", "")
    if not api_key:
        return [], 0

    url = f"https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey={api_key}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        if not resp.is_success:
            return [], 0
        data = resp.json()

    results = []
    for ticker in data.get("tickers", [])[:50]:
        day = ticker.get("day", {})
        results.append({
            "symbol":       ticker.get("ticker", ""),
            "price":        day.get("c", 0),
            "change_pct":   ticker.get("todaysChangePerc", 0),
            "gap_pct":      0,
            "rvol":         0,
            "atr":          0,
            "sector":       None,
            "market_cap":   None,
            "float_shares": None,
            "volume":       None,
            "avg_volume":   None,
            "eps":              None,
            "pe":               None,
            "roe":              None,
            "debt_equity":      None,
            "beta":             None,
            "rsi":              None,
            "change_from_open": None,
            "perf_1w":          None,
            "perf_1m":          None,
            "short_ratio":      None,
            "gross_margin":     None,
            "net_margin":       None,
            "catalyst_tag":     None,
        })
    return results, len(results)


# ─── Main entry point ─────────────────────────────────────────────────────────

async def run_scan(request: ScanRequest) -> dict[str, Any]:
    today = datetime.date.today().isoformat()
    source = "tradingview"

    if request.filters is not None:
        for f in request.filters:
            f.validate_fields()

    tv_filters = (
        [{"left": f.left, "operation": f.operation, "right": f.right}
         for f in request.filters]
        if request.filters is not None
        else None  # None → _scan_tradingview uses DEFAULT_FILTERS
    )

    try:
        rows, total_count = await _scan_tradingview(tv_filters, request.page, request.page_size)
    except Exception:
        source = "polygon"
        rows, total_count = await _scan_polygon()

    if not rows:
        return {"results": [], "source": source, "count": 0, "total_count": 0, "ran_at": today}

    # Save core fields to Supabase so the dashboard can show today's top setups
    db = _get_supabase()
    supabase_records = [
        {
            "user_id":      request.user_id,
            "date":         today,
            "symbol":       r["symbol"],
            "gap_pct":      r["gap_pct"],
            "rvol":         r["rvol"],
            "atr":          r["atr"],
            "price":        r["price"],
            "change_pct":   r["change_pct"],
            "catalyst_tag": r["catalyst_tag"],
            "sector":       r["sector"],
            "raw_json": {
                "market_cap":  r["market_cap"],
                "float":       r["float_shares"],
                "eps":         r["eps"],
                "pe":          r["pe"],
                "roe":         r["roe"],
                "debt_equity": r["debt_equity"],
                "beta":        r["beta"],
                "rsi":         r["rsi"],
            },
        }
        for r in rows
        if r["symbol"]
    ]

    if supabase_records:
        db.table("scan_results").upsert(
            supabase_records,
            on_conflict="user_id,date,symbol",
        ).execute()

    # Fire in-app alerts (scanner entry, high RVOL, big gap, news)
    try:
        fired = await check_and_fire_alerts(request.user_id, rows)
        log.info("Fired %d alert(s) for user %s", fired, request.user_id)
    except Exception as exc:
        log.warning("Alert triggers failed (non-fatal): %s", exc)

    return {
        "results":     rows,
        "source":      source,
        "count":       len(rows),
        "total_count": total_count,
        "ran_at":      today,
    }
