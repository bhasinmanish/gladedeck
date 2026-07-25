import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: picks, error } = await supabase
    .from("morning_picks")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!picks || picks.length < 3) {
    return NextResponse.json({ error: "Need at least 3 days of picks to analyze patterns." }, { status: 400 });
  }

  // Build a structured summary of all picks + their market data
  const summary = picks.map(p => {
    const md = p.market_data as Record<string, Record<string, unknown>>;
    const formatTicker = (ticker: string, side: "bullish" | "bearish") => {
      const d = md?.[ticker];
      if (!d || d.error) return `${ticker} (no data)`;
      const newsItems = Array.isArray(d.news) ? (d.news as {title: string; category: string}[]) : [];
      const newsStr = newsItems.length > 0
        ? ` | catalysts: ${newsItems.map(n => `"${n.title}" [${n.category}]`).join("; ")}`
        : "";
      return `${ticker} [${side}]: gap=${d.gap_pct}% vol_ratio=${d.vol_ratio}x sma20_dist=${d.sma20_dist}% sma50_dist=${d.sma50_dist ?? "?"}% sma200_dist=${d.sma200_dist ?? "?"}% sector=${d.sector}${newsStr}`;
    };
    const bullLines = (p.bullish_tickers as string[]).map(t => formatTicker(t, "bullish"));
    const bearLines = (p.bearish_tickers as string[]).map(t => formatTicker(t, "bearish"));
    return `\n=== ${p.date} ===\n${bullLines.join("\n")}\n${bearLines.join("\n")}`;
  }).join("\n");

  const msg = await anthropic.messages.create({
    model:      "claude-sonnet-5",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `You are analyzing a trader's morning stock picks to find consistent patterns across both technical data and news catalysts.

Here are their picks over ${picks.length} trading days, with market data captured at the time of submission:
(gap_pct = gap vs previous close, vol_ratio = today volume / 20-day avg, sma*_dist = % above/below moving average, catalysts = same-day news headlines)

${summary}

Analyze this data and answer:
1. What do the BULLISH picks consistently have in common? (gap direction, volume, SMA positioning, sectors, news types)
2. What do the BEARISH picks consistently have in common?
3. What are the clearest distinguishing criteria between their bullish vs bearish selections? Include any news catalyst patterns you notice (e.g. earnings beats, upgrades, M&A on bullish vs regulatory/downgrade on bearish).
4. Write a simple scoring formula (in plain English) that could be used to automatically identify similar picks each morning — include both technical and catalyst signals.

Be specific with numbers where patterns are clear. Keep the response concise and actionable.`,
    }],
  });

  const analysis = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Store the analysis back on the most recent pick row as metadata
  await supabase
    .from("morning_picks")
    .update({ pattern_analysis: analysis, analysis_updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("date", picks[picks.length - 1].date);

  return NextResponse.json({ analysis, days_analyzed: picks.length });
}
