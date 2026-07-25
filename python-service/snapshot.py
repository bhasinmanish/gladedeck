"""
Market data snapshot for a list of tickers.
Called when a user submits their morning picks — captures gap %, volume ratio,
SMA distances, and sector at the time of submission.
"""

import logging
import yfinance as yf
from pydantic import BaseModel

log = logging.getLogger(__name__)

MAX_TICKERS = 40


class SnapshotRequest(BaseModel):
    tickers: list[str]


def get_snapshot(tickers: list[str]) -> dict:
    result: dict = {}

    for raw in tickers[:MAX_TICKERS]:
        ticker = raw.upper().strip()
        if not ticker:
            continue
        try:
            t    = yf.Ticker(ticker)
            hist = t.history(period="1y", interval="1d", auto_adjust=True)

            if len(hist) < 21:
                result[ticker] = {"error": "insufficient history"}
                continue

            info = {}
            try:
                info = t.info
            except Exception:
                pass

            prev_close  = float(hist["Close"].iloc[-2])
            today_open  = float(hist["Open"].iloc[-1])
            today_close = float(hist["Close"].iloc[-1])
            today_vol   = float(hist["Volume"].iloc[-1])
            avg_vol_20  = float(hist["Volume"].iloc[-21:-1].mean())

            close   = hist["Close"]
            sma20   = float(close.rolling(20).mean().iloc[-1])
            sma50   = float(close.rolling(50).mean().iloc[-1]) if len(hist) >= 50  else None
            sma200  = float(close.rolling(200).mean().iloc[-1]) if len(hist) >= 200 else None

            gap_pct   = (today_open - prev_close) / prev_close * 100 if prev_close else 0
            vol_ratio = today_vol / avg_vol_20 if avg_vol_20 > 0 else 1

            price = today_close
            sma20_dist  = (price - sma20)  / sma20  * 100
            sma50_dist  = (price - sma50)  / sma50  * 100 if sma50  else None
            sma200_dist = (price - sma200) / sma200 * 100 if sma200 else None

            result[ticker] = {
                "price":       round(price,       2),
                "prev_close":  round(prev_close,  2),
                "open":        round(today_open,  2),
                "gap_pct":     round(gap_pct,     2),
                "vol_ratio":   round(vol_ratio,   2),
                "sma20_dist":  round(sma20_dist,  2),
                "sma50_dist":  round(sma50_dist,  2) if sma50_dist  is not None else None,
                "sma200_dist": round(sma200_dist, 2) if sma200_dist is not None else None,
                "sector":      info.get("sector", "Unknown"),
                "market_cap":  info.get("marketCap"),
                "float_shares":info.get("floatShares"),
            }
            log.info(f"[snapshot] {ticker}: gap={gap_pct:.1f}% vol_ratio={vol_ratio:.1f}x")

        except Exception as e:
            log.warning(f"[snapshot] {ticker} error: {e}")
            result[ticker] = {"error": str(e)}

    return result
