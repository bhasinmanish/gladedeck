import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? "https://gladedeck-production-08fa.up.railway.app";
const SERVICE_SECRET = process.env.PYTHON_SERVICE_SECRET!;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`analyze:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — try again in an hour" }, { status: 429 });
  }

  // Quick check: need at least 3 days of picks
  const { count } = await supabase
    .from("morning_picks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count || count < 3) {
    return NextResponse.json({ error: "Need at least 3 days of picks to analyze patterns." }, { status: 400 });
  }

  // Delegate the heavy Claude call to the Python service (no timeout there).
  // It runs in the background and saves results directly to Supabase.
  const res = await fetch(`${PYTHON_URL}/analyze-picks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": SERVICE_SECRET,
    },
    body: JSON.stringify({ user_id: user.id }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[analyze] Python service error:", res.status, text.slice(0, 300));
    return NextResponse.json({ error: `Analysis service error (${res.status})` }, { status: 500 });
  }

  return NextResponse.json({ status: "started" });
}
