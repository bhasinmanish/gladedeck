import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Give ourselves 60 s — Python handles the Claude call (~15-30 s)
export const maxDuration = 60;

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? "https://gladedeck-production-08fa.up.railway.app";
const SERVICE_SECRET = process.env.PYTHON_SERVICE_SECRET!;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`analyze:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests — try again in an hour" }, { status: 429 });
  }

  // Fetch picks (lightweight columns — no market_data to keep payload small)
  const { data: picks, error: picksError } = await supabase
    .from("morning_picks")
    .select("date,bullish_tickers,bearish_tickers,favorites_tickers,scalp_tickers,explosive_tickers,notes,market_data")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  if (picksError) {
    console.error("[analyze]", picksError.message);
    return NextResponse.json({ error: "Failed to load picks" }, { status: 500 });
  }
  if (!picks || picks.length < 3) {
    return NextResponse.json({ error: "Need at least 3 days of picks to analyze patterns." }, { status: 400 });
  }

  // Send picks to Python for Claude analysis (Python doesn't need Supabase access)
  let res: Response;
  try {
    res = await fetch(`${PYTHON_URL}/analyze-picks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SERVICE_SECRET,
      },
      body: JSON.stringify({ picks }),
    });
  } catch (e) {
    console.error("[analyze] Could not reach Python service:", e);
    return NextResponse.json({ error: "Could not reach analysis service" }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[analyze] Python error:", res.status, text.slice(0, 300));
    return NextResponse.json({ error: `Analysis service error (${res.status})` }, { status: 500 });
  }

  const result = await res.json() as { analysis?: string; days_analyzed?: number; error?: string };

  if (result.error || !result.analysis) {
    return NextResponse.json({ error: result.error ?? "No analysis returned" }, { status: 500 });
  }

  const { analysis, days_analyzed } = result;
  const now = new Date().toISOString();

  // Save to pattern_analyses history table (best-effort — table may not exist yet)
  await supabase
    .from("pattern_analyses")
    .insert({ user_id: user.id, days_count: days_analyzed, analysis });

  // Always update the latest pick row so morning_agent.py can read it
  await supabase
    .from("morning_picks")
    .update({ pattern_analysis: analysis, analysis_updated_at: now })
    .eq("user_id", user.id)
    .eq("date", picks[picks.length - 1].date);

  return NextResponse.json({ analysis, days_analyzed });
}
