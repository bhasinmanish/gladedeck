import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Rallies AI posts to this endpoint when a breakout fires.
// Configure Rallies to POST to: https://<your-domain>/api/webhooks/rallies
export async function POST(request: NextRequest) {
  const body = await request.json();

  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.RALLIES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : null;
  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the user_id actually exists — prevents attacker-controlled writes
  const { data: userResult } = await admin.auth.admin.getUserById(userId);
  if (!userResult?.user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 400 });
  }

  const { error } = await admin.from("alerts").insert({
    user_id:      userId,
    type:         "rallies_breakout",
    symbol:       typeof body.symbol    === "string" ? body.symbol.slice(0, 20)    : null,
    condition:    typeof body.condition === "string" ? body.condition.slice(0, 500) : null,
    triggered_at: new Date().toISOString(),
    delivered_via: ["in_app"],
    is_read: false,
  });

  if (error) return NextResponse.json({ error: "Internal error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
