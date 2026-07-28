"""
Alert dispatching: in-app (Supabase insert), browser Web Push, Twilio SMS.
Rate limiting: max 1 SMS per symbol per hour.
"""

import os
import json
import datetime
from typing import Literal
from pydantic import BaseModel
from supabase import create_client

from twilio.rest import Client as TwilioClient
from pywebpush import webpush, WebPushException


class AlertRequest(BaseModel):
    user_id: str
    type: str
    symbol: str | None = None
    condition: str | None = None
    channels: list[Literal["in_app", "push", "sms"]] = ["in_app"]


def _get_supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _can_send_sms(db, user_id: str, symbol: str | None) -> bool:
    if not symbol:
        return True
    try:
        result = (
            db.table("sms_cooldowns")
            .select("last_sent_at")
            .eq("user_id", user_id)
            .eq("symbol", symbol)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return True
        last = datetime.datetime.fromisoformat(
            result.data["last_sent_at"].replace("Z", "+00:00")
        )
        return (datetime.datetime.now(datetime.timezone.utc) - last).total_seconds() >= 3600
    except Exception:
        return True  # fail open so alerts still fire if DB is unavailable


def _record_sms_sent(db, user_id: str, symbol: str | None) -> None:
    if not symbol:
        return
    try:
        db.table("sms_cooldowns").upsert(
            {"user_id": user_id, "symbol": symbol,
             "last_sent_at": datetime.datetime.now(datetime.timezone.utc).isoformat()},
            on_conflict="user_id,symbol",
        ).execute()
    except Exception:
        pass


async def dispatch_alert(request: AlertRequest) -> dict:
    db = _get_supabase()
    delivered: list[str] = []

    if "in_app" in request.channels:
        db.table("alerts").insert({
            "user_id": request.user_id,
            "type": request.type,
            "symbol": request.symbol,
            "condition": request.condition,
            "triggered_at": datetime.datetime.utcnow().isoformat(),
            "delivered_via": [],
            "is_read": False,
        }).execute()
        delivered.append("in_app")

    if "push" in request.channels:
        subs = (
            db.table("push_subscriptions")
            .select("endpoint,p256dh,auth")
            .eq("user_id", request.user_id)
            .execute()
        )
        payload = json.dumps({
            "title": f"Glade Deck: {request.symbol or request.type}",
            "body": request.condition or request.type,
        })
        for sub in subs.data or []:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                    vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
                )
            except WebPushException:
                pass  # stale subscription — clean up in a maintenance job
        delivered.append("push")

    if "sms" in request.channels and _can_send_sms(db, request.user_id, request.symbol):
        user_profile = (
            db.table("users")
            .select("phone")
            .eq("id", request.user_id)
            .maybe_single()
            .execute()
        )
        phone = (user_profile.data or {}).get("phone")
        if phone:
            try:
                twilio = TwilioClient(
                    os.environ["TWILIO_ACCOUNT_SID"],
                    os.environ["TWILIO_AUTH_TOKEN"],
                )
                body = f"Glade Deck alert: {request.symbol or ''} {request.condition or request.type}"
                twilio.messages.create(
                    body=body,
                    from_=os.environ["TWILIO_FROM_NUMBER"],
                    to=phone,
                )
                _record_sms_sent(db, request.user_id, request.symbol)
                delivered.append("sms")
            except Exception:
                pass

    return {"delivered": delivered}
