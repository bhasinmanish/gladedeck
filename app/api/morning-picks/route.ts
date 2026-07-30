import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — return all picks + pattern analysis history for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [picksRes, analysesRes] = await Promise.all([
    supabase
      .from("morning_picks")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("pattern_analyses")
      .select("id, created_at, days_count, analysis")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (picksRes.error) return NextResponse.json({ error: picksRes.error.message }, { status: 500 });

  let analyses = analysesRes.data ?? [];

  // If pattern_analyses table is missing or empty, fall back to the analysis
  // stored on the pick rows (pre-migration state)
  if (analyses.length === 0) {
    const allPicks = picksRes.data ?? [];
    const pickWithAnalysis = allPicks.find(
      (p: Record<string, unknown>) => p.pattern_analysis && p.analysis_updated_at
    );
    if (pickWithAnalysis) {
      analyses = [{
        id: `legacy_${pickWithAnalysis.id}`,
        created_at: pickWithAnalysis.analysis_updated_at,
        days_count: allPicks.length,
        analysis: pickWithAnalysis.pattern_analysis,
      }];
    }
  }

  return NextResponse.json({ picks: picksRes.data ?? [], analyses });
}

// POST — save today's picks and pull a market data snapshot
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bullish, bearish, favorites, scalps, explosives, notes, date } = await request.json();
  const pickDate = date ?? new Date().toISOString().split("T")[0];

  const normalize = (arr: unknown): string[] =>
    (Array.isArray(arr) ? arr : []).map((t: string) => t.toUpperCase().trim()).filter(Boolean);

  const bullishTickers   = normalize(bullish);
  const bearishTickers   = normalize(bearish);
  const favoritesTickers = normalize(favorites);
  const scalpTickers     = normalize(scalps);
  const explosiveTickers = normalize(explosives);

  const allTickers = Array.from(new Set([
    ...bullishTickers, ...bearishTickers,
    ...favoritesTickers, ...scalpTickers, ...explosiveTickers,
  ]));

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
      user_id:           user.id,
      date:              pickDate,
      bullish_tickers:   bullishTickers,
      bearish_tickers:   bearishTickers,
      favorites_tickers: favoritesTickers,
      scalp_tickers:     scalpTickers,
      explosive_tickers: explosiveTickers,
      notes:             typeof notes === "string" ? notes.trim() : null,
      market_data:       marketData,
      updated_at:        new Date().toISOString(),
    }, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
