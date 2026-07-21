import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";

const PROPOSE_AGENT_TOOL: Anthropic.Tool = {
  name: "propose_agent",
  description:
    "Propose a ready-to-create agent. Call this ONLY once the user has given enough detail " +
    "(or has clearly accepted one of your suggestions) to define a concrete agent. " +
    "Always write a short message alongside the proposal explaining the design choices.",
  input_schema: {
    type: "object",
    properties: {
      name:          { type: "string", description: "Short, specific agent name." },
      description:   { type: "string", description: "One or two sentences on what it does and when it speaks up." },
      universe:      { type: "string", description: "Human-readable description of what it watches." },
      universe_type: {
        type: "string",
        enum: ["watchlist", "holdings", "symbols", "market"],
        description: "Which set of symbols to evaluate. Use 'symbols' only when the user named specific tickers.",
      },
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "Explicit tickers. Required when universe_type is 'symbols'.",
      },
      triggers:      { type: "array", items: { type: "string" }, description: "Human-readable trigger descriptions, for display." },
      structured_triggers: {
        type: "array",
        description:
          "The machine-evaluable form of the triggers — this is what actually runs. Include ONLY conditions " +
          "expressible with the supported types below. Anything needing judgement (thesis drift, guidance " +
          "language, news tone) is NOT a trigger — put it in `context` instead.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["sma_cross", "drawdown", "gain", "volume_spike", "earnings_within"],
            },
            period:    { type: "number", description: "sma_cross: moving-average length in days (e.g. 50, 100, 200)." },
            direction: { type: "string", enum: ["above", "below"], description: "sma_cross: which way price crosses." },
            pct:       { type: "number", description: "drawdown/gain: percent move threshold." },
            window:    { type: "string", enum: ["1d", "5d", "1mo"], description: "drawdown/gain: lookback window." },
            multiple:  { type: "number", description: "volume_spike: multiple of 20-day average volume (e.g. 2)." },
            days:      { type: "number", description: "earnings_within: calendar days ahead." },
            require_volume_spike: { type: "boolean", description: "drawdown/gain: only fire on abnormal volume." },
          },
          required: ["type"],
        },
      },
      trigger_logic: {
        type: "string",
        enum: ["any", "all"],
        description:
          "'any' (default) fires when a single trigger hits. 'all' requires every trigger to hit at " +
          "once — use it to demand confirmation, e.g. a 200-day break AND a volume spike.",
      },
      schedule:      { type: "string", description: "Human-readable cadence, e.g. 'Every 15 minutes during market hours'." },
      run_interval: {
        type: "string",
        enum: ["5m", "15m", "30m", "1h", "4h", "daily"],
        description:
          "How often the agent actually evaluates. Sub-daily intervals run during market hours only. " +
          "Use 'daily' for earnings/event and end-of-day trend agents; use intraday intervals only when " +
          "the user genuinely needs to know within the session.",
      },
      cooldown_days:  { type: "number", description: "Per-symbol quiet period in days. Prefer cooldown_hours for intraday agents." },
      cooldown_hours: { type: "number", description: "Per-symbol quiet period in hours. Use this for any intraday agent (4-8 is sensible)." },
      suppress:      { type: "array", items: { type: "string" }, description: "Cases it should deliberately stay quiet about." },
      context:       { type: "array", items: { type: "string" }, description: "Context to layer onto every qualifying trigger." },
      output_style:  { type: "string", description: "How the alert note should read." },
    },
    required: ["name", "description", "triggers", "structured_triggers", "universe_type", "schedule"],
  },
};

function systemPrompt(ctx: { watchlist: string[]; holdings: string[]; strategies: string[] }) {
  return `You are the agent builder for Glade Deck, a trading dashboard. You help a trader design
monitoring agents that watch markets and their portfolio, and alert them only when something matters.

Your voice: direct, opinionated, practical. Short paragraphs. No filler, no hype, no emoji.
You are a sharp analyst helping a peer — recommend a direction rather than listing every option.

Agents can range from simple deterministic triggers to high-judgement analyst monitors. Examples of the range:
- Simple trigger: alert when a symbol closes above its 50-day moving average.
- Portfolio risk monitor: flag a holding dropping more than 5% on abnormal volume.
- Thesis-crack analyst: watch holdings for guide-downs, margin pressure, demand softness, backlog
  cracks, or management language drift, and only ping when the thesis actually weakens.
- Options/flow watcher: unusual options flow or dark pool activity in watchlist names.
- Macro agent: CPI, payrolls, Fed speakers, rates — only when the read is materially risk-on or risk-off.
- Earnings risk agent: holdings reporting soon, with implied move and consensus.

Good agent design principles you should apply and explain:
- Fewer, higher-signal alerts beat many noisy ones. Add a silence rule: stay quiet when context is weak.
- Deterministic triggers are the messenger; the context overlay is the thesis.
- Use per-symbol cooldowns to avoid repeat noise.
- Suppress low-value cases (leveraged/inverse ETFs, duplicate share classes, illiquid microcaps
  without volume confirmation).
- Rank alerts by conviction (high / medium / low) rather than treating every trigger equally.

IMPORTANT — what can actually run today. Agents execute against daily market data, and only these
trigger types are machine-evaluable:
- sma_cross      — price crossing above/below a moving average (any period, e.g. 50/100/200)
- drawdown       — a drop of X% over 1 day, 5 days, or 1 month (optionally requiring abnormal volume)
- gain           — the same in the upward direction
- volume_spike   — volume at N times its 20-day average
- earnings_within — earnings landing within N calendar days

Combining triggers. By default any single trigger fires the agent. Set trigger_logic to "all" when the
user wants confirmation before being told — "a 200-day break ONLY if volume is heavy" is trigger_logic
"all" with an sma_cross plus a volume_spike. This is the main tool for cutting noise, so reach for it
whenever the user says they want fewer or higher-quality alerts.

Universes. universe_type "market" resolves to broad index proxies (SPY, QQQ, IWM, DIA) — use it for
macro or market-regime agents, not as a way to scan every stock.

Anything else — thesis drift, guidance language, margin pressure, backlog cracks, news tone, options
flow, macro reads — cannot be a trigger. Those belong in the context field: the judgement layer applied
when a trigger fires and the alert note is written. Be honest about this rather than promising a trigger
that cannot run. A good design pairs a mechanical trigger with a rich context overlay.

Cadence. Ask how quickly they need to know, then set run_interval accordingly:
- daily — earnings and event risk, end-of-day trend breaks, thesis monitoring. The right default.
- 1h / 4h — meaningful intraday moves without the noise of watching every tick.
- 5m / 15m — only when acting inside the session actually matters, e.g. a stop-loss style drawdown alert.
Intraday agents run during market hours only. Always pair an intraday interval with cooldown_hours
(4-8 hours is sensible) — without it the same condition can re-fire all day and drown the user.
Default to daily unless they say otherwise; more frequent is not better.

If the user is vague, offer 2-3 concrete tailored directions and invite them to send one sentence in
this format: "Watch [what] for [condition], check [how often], notify me with [what kind of note]."

When you have enough to define a concrete agent — or the user accepts one of your suggestions —
call the propose_agent tool. Do not call it while still exploring options. Every proposal must include
at least one structured trigger, otherwise the agent can never fire.

The user's current Glade Deck context:
- Watchlist symbols: ${ctx.watchlist.length ? ctx.watchlist.join(", ") : "none yet"}
- Symbols they have traded: ${ctx.holdings.length ? ctx.holdings.join(", ") : "none yet"}
- Strategies they follow: ${ctx.strategies.length ? ctx.strategies.join(", ") : "none yet"}

Use this context to tailor suggestions. Never invent prices, returns, or market data you have not been
given — you have no live market feed. If the user asks for a backtest or current market read, say plainly
that you cannot see live market data yet and offer to design the agent's logic instead.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("agents", user);
  if (gate.locked) return NextResponse.json({ error: "AI Agents is a premium feature." }, { status: 403 });

  const { messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  // Pull light portfolio context so suggestions are tailored to this user.
  const [{ data: watchlists }, { data: trades }, { data: strategies }] = await Promise.all([
    supabase.from("watchlists").select("symbols").eq("user_id", user.id),
    supabase.from("trades").select("symbol").eq("user_id", user.id).limit(200),
    supabase.from("strategies").select("name").eq("user_id", user.id).limit(20),
  ]);

  const ctx = {
    watchlist:  Array.from(new Set((watchlists ?? []).flatMap(w => (w.symbols as string[]) ?? []))).slice(0, 40),
    holdings:   Array.from(new Set((trades ?? []).map(t => t.symbol as string))).slice(0, 40),
    strategies: (strategies ?? []).map(s => s.name as string),
  };

  try {
    const anthropic = new Anthropic();
    const response  = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1500,
      system:     systemPrompt(ctx),
      tools:      [PROPOSE_AGENT_TOOL],
      messages:   messages as Anthropic.MessageParam[],
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n\n")
      .trim();

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "propose_agent"
    );

    return NextResponse.json({
      reply:    reply || (toolUse ? "Here's the agent I'd build:" : ""),
      proposal: toolUse ? toolUse.input : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agents/chat]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
