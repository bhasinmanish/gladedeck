import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — return all picks for the current user, newest first
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("morning_picks")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — save today's picks and pull a market data snapshot
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bullish, bearish, date } = await request.json();
  const pickDate = date ?? new Date().toISOString().split("T")[0];

  const bullishTickers: string[] = (bullish ?? []).map((t: string) => t.toUpperCase().trim()).filter(Boolean);
  const bearishTickers: string[] = (bearish ?? []).map((t: string) => t.toUpperCase().trim()).filter(Boolean);
  const allTickers = Array.from(new Set([...bullishTickers, ...bearishTickers]));

  // Fetch market data snapshot from Python service
  let marketData: Record<string, unknown> = {};
  const serviceUrl = process.env.PYTHON_SERVICE_URL;
  if (serviceUrl && allTickers.length > 0) {
    try {
      const res = await fetch(`${serviceUrl}/snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": process.env.PYTHON_SERVICE_SECRET!,
        },
        body: JSON.stringify({ tickers: allTickers }),
      });
      if (res.ok) marketData = await res.json();
    } catch (e) {
      console.warn("[morning-picks] snapshot fetch failed:", e);
    }
  }

  const { data, error } = await supabase
    .from("morning_picks")
    .upsert({
      user_id:          user.id,
      date:             pickDate,
      bullish_tickers:  bullishTickers,
      bearish_tickers:  bearishTickers,
      market_data:      marketData,
      updated_at:       new Date().toISOString(),
    }, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
