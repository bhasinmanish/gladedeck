"""
Resend integration for Glade Deck alert email notifications.

Uses the Resend REST API via httpx (no extra pip dependency).
Sending domain: onboarding@resend.dev (Resend shared domain — no custom domain needed).
"""

import datetime
import logging
import os
from typing import Any

import httpx

log = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS   = "Glade Deck Alerts <onboarding@resend.dev>"
APP_URL        = os.getenv("GLADE_APP_URL", "http://localhost:3000")

# ── Category labels ───────────────────────────────────────────────────────────

CATEGORY_LABELS: dict[str, str] = {
    "news_earnings":   "Earnings Alert",
    "news_fda":        "FDA Alert",
    "news_ma":         "M&A Alert",
    "news_analyst":    "Analyst Alert",
    "news_regulatory": "Regulatory Alert",
    "news_corporate":  "Corporate News",
    "news_general":    "Market News",
    "scanner_entry":   "Scanner Alert",
    "high_rvol":       "High RVOL Alert",
    "big_gap":         "Big Gap Alert",
    "price_alert":     "Price Alert",
}

# ── HTML email template ───────────────────────────────────────────────────────

def _build_html(category_label: str, symbol: str | None, condition: str | None) -> str:
    now_str = datetime.datetime.now().strftime("%b %d, %Y %H:%M ET")

    symbol_block = (
        f'<div style="font-size:22px;font-weight:700;color:#e2e8f0;margin-bottom:4px;">{symbol}</div>'
        if symbol else ""
    )
    condition_block = (
        f'<div style="font-size:13px;color:#94a3b8;margin-top:6px;line-height:1.6;">{condition}</div>'
        if condition else ""
    )

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:36px 24px;">

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
      <span style="font-size:18px;font-weight:700;color:#818cf8;letter-spacing:-0.02em;">Glade Deck</span>
      <span style="background:#1e293b;color:#64748b;font-size:10px;padding:2px 10px;border-radius:99px;font-weight:500;letter-spacing:0.04em;">
        {category_label}
      </span>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:10px;">
        {category_label}
      </div>
      {symbol_block}
      {condition_block}
      <a href="{APP_URL}/alerts"
         style="display:inline-block;margin-top:20px;background:#6366f1;color:#ffffff;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;">
        View in Glade Deck →
      </a>
    </div>

    <div style="text-align:center;margin-top:24px;font-size:11px;color:#475569;">
      {now_str} ·
      <a href="{APP_URL}/dashboard" style="color:#6366f1;text-decoration:none;">Dashboard</a>
    </div>

  </div>
</body>
</html>"""


# ── Send ──────────────────────────────────────────────────────────────────────

async def send_alert_email(
    to: str,
    alert_type: str,
    symbol: str | None = None,
    condition: str | None = None,
) -> bool:
    """
    Send a single alert notification email via Resend.
    Returns True on success, False on any error.
    """
    api_key = os.getenv("RESEND_API_KEY", "")
    if not api_key:
        log.warning("RESEND_API_KEY not set — skipping email for %s", to)
        return False

    category_label = CATEGORY_LABELS.get(alert_type, "Alert")
    subject = f"{symbol} — {category_label} | Glade Deck" if symbol else f"{category_label} | Glade Deck"
    html    = _build_html(category_label, symbol, condition)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"from": FROM_ADDRESS, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code in (200, 201):
            log.info("Email sent → %s (%s)", to, subject)
            return True
        log.warning("Resend %d: %s", resp.status_code, resp.text[:200])
        return False
    except Exception as exc:
        log.warning("Email send failed: %s", exc)
        return False


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_notif_prefs(db: Any, user_id: str) -> dict:
    """Return notification_prefs row for user, or empty dict (treats email as disabled)."""
    try:
        result = (
            db.table("notification_prefs")
            .select("email_enabled,email_news,email_scanner,email_price_alerts")
            .eq("user_id", user_id)
            .maybeSingle()
            .execute()
        )
        return result.data or {}
    except Exception as exc:
        log.warning("Could not load notification prefs for %s: %s", user_id, exc)
        return {}


def get_user_email(db: Any, user_id: str) -> str | None:
    """Fetch the user's email address via Supabase auth admin API."""
    try:
        resp = db.auth.admin.get_user_by_id(user_id)
        return resp.user.email
    except Exception as exc:
        log.warning("Could not fetch email for user %s: %s", user_id, exc)
        return None
