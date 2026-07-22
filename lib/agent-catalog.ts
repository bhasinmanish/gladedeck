// Prebuilt "popular" agents users can install with one click.
// Every spec here uses ONLY triggers the runner actually evaluates
// (sma_cross, drawdown, gain, volume_spike, earnings_within) so nothing
// in this catalog is a promise we can't keep.

import type { AgentSpec } from "@/lib/types";

export interface CatalogAgent {
  id:          string;
  name:        string;
  description: string;
  gradient:    string;   // tailwind classes for the avatar blob
  schedule:    string;
  spec:        AgentSpec;
}

const UNIVERSE_LABELS: Record<string, string> = {
  holdings:  "Uses your portfolio holdings",
  watchlist: "Uses your watchlist",
  market:    "Watches the broad market",
  symbols:   "Watches specific symbols",
};

export function universeLabel(spec: AgentSpec): string {
  return UNIVERSE_LABELS[spec.universe_type ?? "watchlist"] ?? "Uses your watchlist";
}

export const AGENT_CATALOG: CatalogAgent[] = [
  {
    id:          "unexplained-drop",
    name:        "Unexplained Drop",
    description:
      "Watches your holdings for sharp drops on heavy volume, then checks recent headlines to judge " +
      "whether the move has a real catalyst or is unexplained and worth a closer look.",
    gradient:    "from-rose-500 to-orange-500",
    schedule:    "Every hour during market hours",
    spec: {
      universe_type:       "holdings",
      run_interval:        "1h",
      cooldown_hours:      6,
      trigger_logic:       "all",
      structured_triggers: [
        { type: "drawdown", pct: 5, window: "1d", require_volume_spike: true },
      ],
      triggers:     ["Drops 5%+ in a day on abnormal volume"],
      context:      ["Is there news explaining the move?", "Sector / peer behavior", "Recent guidance"],
      output_style: "Practical, states whether the drop looks explained or not, ends with a read.",
    },
  },
  {
    id:          "earnings-radar",
    name:        "Earnings Radar",
    description:
      "Flags holdings reporting earnings within the next 10 days so you're never blindsided by an " +
      "event that can gap the stock against you.",
    gradient:    "from-violet-500 to-fuchsia-500",
    schedule:    "Daily at 8:00 AM ET",
    spec: {
      universe_type:       "holdings",
      run_interval:        "daily",
      cooldown_hours:      168,
      structured_triggers: [{ type: "earnings_within", days: 10 }],
      triggers:     ["A holding has earnings within 10 days"],
      context:      ["Last earnings reaction", "Any fresh guidance or analyst moves"],
      output_style: "Concise event-risk heads-up.",
    },
  },
  {
    id:          "200-day-break",
    name:        "200-Day Trend Break",
    description:
      "Tells you the moment a holding loses its 200-day moving average — the classic long-term trend " +
      "line — with news context to separate a real regime change from noise.",
    gradient:    "from-blue-500 to-cyan-500",
    schedule:    "Every hour during market hours",
    spec: {
      universe_type:       "holdings",
      run_interval:        "1h",
      cooldown_hours:      24,
      structured_triggers: [{ type: "sma_cross", period: 200, direction: "below" }],
      triggers:     ["Price crosses below its 200-day SMA"],
      context:      ["Recent guidance / news", "Volume behavior on the break"],
      output_style: "Says whether the break is confirmed by context, ends with buy/hold/sell/stay-away.",
    },
  },
  {
    id:          "breakout-watch",
    name:        "Breakout Watch",
    description:
      "Watches your watchlist for names breaking above their 50-day average on heavy volume — momentum " +
      "breakouts confirmed by real participation, not empty crossovers.",
    gradient:    "from-emerald-500 to-teal-500",
    schedule:    "Every hour during market hours",
    spec: {
      universe_type:       "watchlist",
      run_interval:        "1h",
      cooldown_hours:      12,
      trigger_logic:       "all",
      structured_triggers: [
        { type: "sma_cross", period: 50, direction: "above" },
        { type: "volume_spike", multiple: 1.5 },
      ],
      triggers:     ["Crosses above the 50-day SMA", "Volume 1.5x its average"],
      context:      ["What's driving the move", "Whether it's a fresh breakout or a retest"],
      output_style: "Momentum-focused, notes conviction of the breakout.",
    },
  },
  {
    id:          "volume-surge",
    name:        "Volume Surge",
    description:
      "Flags watchlist names trading at more than 2.5x their normal volume — an early tell that " +
      "something is happening before it shows up in the price.",
    gradient:    "from-amber-500 to-yellow-500",
    schedule:    "Every 30 minutes during market hours",
    spec: {
      universe_type:       "watchlist",
      run_interval:        "30m",
      cooldown_hours:      6,
      structured_triggers: [{ type: "volume_spike", multiple: 2.5 }],
      triggers:     ["Volume 2.5x its 20-day average"],
      context:      ["Any headline explaining the spike", "Direction of the move"],
      output_style: "Short, flags whether the volume looks meaningful.",
    },
  },
  {
    id:          "drawdown-guard",
    name:        "Portfolio Drawdown Guard",
    description:
      "A risk monitor that pings you when any holding falls 8% or more in a single day, so a bad print " +
      "never sits in your account unnoticed.",
    gradient:    "from-red-500 to-rose-600",
    schedule:    "Every 15 minutes during market hours",
    spec: {
      universe_type:       "holdings",
      run_interval:        "15m",
      cooldown_hours:      4,
      structured_triggers: [{ type: "drawdown", pct: 8, window: "1d" }],
      triggers:     ["A holding drops 8%+ in a day"],
      context:      ["Is there a catalyst?", "How it compares to sector / market"],
      output_style: "Risk-framed, direct.",
    },
  },
  {
    id:          "market-risk-off",
    name:        "Market Risk-Off",
    description:
      "Watches the broad market (SPY, QQQ, IWM, DIA) for a 2%+ down day and tells you when the tape has " +
      "turned materially risk-off.",
    gradient:    "from-slate-500 to-slate-700",
    schedule:    "Every hour during market hours",
    spec: {
      universe_type:       "market",
      run_interval:        "1h",
      cooldown_hours:      8,
      structured_triggers: [{ type: "drawdown", pct: 2, window: "1d" }],
      triggers:     ["A major index drops 2%+ in a day"],
      context:      ["What's driving the move", "Rates / macro backdrop from headlines"],
      output_style: "Macro read, risk-on vs risk-off framing.",
    },
  },
  {
    id:          "runner-alert",
    name:        "Weekly Runner",
    description:
      "Surfaces holdings that have gained 15% or more over the past month — your winners, so you can " +
      "decide whether to trim, hold, or let them run.",
    gradient:    "from-green-500 to-emerald-600",
    schedule:    "Daily after the close",
    spec: {
      universe_type:       "holdings",
      run_interval:        "daily",
      cooldown_hours:      168,
      structured_triggers: [{ type: "gain", pct: 15, window: "1mo" }],
      triggers:     ["Up 15%+ over the past month"],
      context:      ["Whether the move is news-driven or technical", "Any signs of exhaustion"],
      output_style: "Balanced, notes whether to trim or hold.",
    },
  },
];
