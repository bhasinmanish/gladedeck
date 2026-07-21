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
      universe:      { type: "string", description: "What it watches — e.g. 'My watchlist', 'Portfolio holdings', 'NVDA, AMD, AVGO'." },
      triggers:      { type: "array", items: { type: "string" }, description: "Concrete conditions that fire the agent." },
      schedule:      { type: "string", description: "Human-readable cadence, e.g. 'Daily at 8:00 AM ET'." },
      cooldown_days: { type: "number", description: "Per-symbol quiet period in days after an alert fires." },
      suppress:      { type: "array", items: { type: "string" }, description: "Cases it should deliberately stay quiet about." },
      context:       { type: "array", items: { type: "string" }, description: "Context to layer onto every qualifying trigger." },
      output_style:  { type: "string", description: "How the alert note should read." },
    },
    required: ["name", "description", "triggers", "schedule"],
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

If the user is vague, offer 2-3 concrete tailored directions and invite them to send one sentence in
this format: "Watch [what] for [condition], check [how often], notify me with [what kind of note]."

When you have enough to define a concrete agent — or the user accepts one of your suggestions —
call the propose_agent tool. Do not call it while still exploring options.

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
