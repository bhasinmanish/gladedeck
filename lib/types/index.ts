// ─── Core domain types matching the Supabase schema ──────────────────────────

export type TimeHorizon = "scalp" | "day_trade" | "swing" | "investment";
export type TradeSource = "schwab" | "manual" | "chatbot";
export type IdeaStatus = "watching" | "active" | "closed";
export type AlertDelivery = "in_app" | "push" | "sms";

// ─── Scan results ─────────────────────────────────────────────────────────────

export interface ScanResult {
  id: string;
  user_id: string;
  date: string;
  symbol: string;
  gap_pct: number;
  rvol: number;
  atr: number;
  price: number;
  change_pct: number;
  catalyst_tag: string | null;
  sector: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  user_id: string;
  type: string;
  symbol: string | null;
  condition: string | null;
  triggered_at: string;
  delivered_via: AlertDelivery[];
  is_read: boolean;
}

// ─── Watchlists ───────────────────────────────────────────────────────────────

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  symbols: string[];
  created_at: string;
}

// ─── Strategies ───────────────────────────────────────────────────────────────

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string;
  time_horizon: TimeHorizon;
  catalyst_type: string | null;
  setup_pattern: string | null;
  entry_rules: string | null;
  exit_rules: string | null;
  risk_params: {
    max_risk_per_trade?: number;
    max_position_size?: number;
    [key: string]: unknown;
  };
  created_at: string;
}

// ─── Trades ───────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  user_id: string;
  strategy_id: string | null;
  symbol: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  qty: number;
  side: "long" | "short";
  pnl: number | null;
  account: string;
  trade_type: TimeHorizon;
  setup_notes: string | null;
  what_went_well: string | null;
  what_went_wrong: string | null;
  what_to_change: string | null;
  source: TradeSource;
  broker_order_id: string | null;
  created_at: string;
}

// ─── Trade ideas ──────────────────────────────────────────────────────────────

export interface TradeIdea {
  id: string;
  user_id: string;
  strategy_id: string | null;
  symbol: string;
  thesis: string;
  time_horizon: TimeHorizon;
  catalyst: string | null;
  status: IdeaStatus;
  created_at: string;
}

// ─── Price alerts (user-defined) ─────────────────────────────────────────────

export interface PriceAlert {
  id: string;
  user_id: string;
  name: string | null;
  symbol: string | null;
  watchlist_id: string | null;
  field: string;
  condition: "above" | "below" | "crosses_above" | "crosses_below";
  value: number;
  trigger_mode: "once" | "every_time";
  is_active: boolean;
  symbol_states: Record<string, number>;
  last_triggered_at: string | null;
  created_at: string;
}

// ─── Notification preferences ─────────────────────────────────────────────────

export interface NotificationPrefs {
  user_id: string;
  email_enabled: boolean;
  email_news: boolean;
  email_scanner: boolean;
  email_price_alerts: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Daily summaries ──────────────────────────────────────────────────────────

export interface DailySummary {
  id: string;
  user_id: string;
  date: string;
  pnl: number;
  trades_count: number;
  summary_text: string | null;
  raw_chat_json: Record<string, unknown> | null;
  created_at: string;
}

// ─── AI agents ────────────────────────────────────────────────────────────────

// Machine-evaluable trigger. The runner understands this fixed vocabulary;
// anything requiring judgement belongs in `context` instead.
export interface StructuredTrigger {
  type:                  "sma_cross" | "drawdown" | "gain" | "volume_spike" | "earnings_within";
  period?:               number;            // sma_cross: moving-average length
  direction?:            "above" | "below"; // sma_cross: which way price crosses
  pct?:                  number;            // drawdown/gain: % threshold
  window?:               "1d" | "5d" | "1mo";
  multiple?:             number;            // volume_spike: multiple of average volume
  days?:                 number;            // earnings_within: days ahead
  require_volume_spike?: boolean;           // drawdown/gain: demand abnormal volume
}

export interface AgentSpec {
  universe?:            string;   // human-readable description of what it watches
  universe_type?:       "watchlist" | "holdings" | "symbols" | "market";
  symbols?:             string[]; // used when universe_type is "symbols"
  triggers?:            string[]; // human-readable trigger descriptions (for display)
  structured_triggers?: StructuredTrigger[]; // what the runner actually evaluates
  schedule?:            string;   // human-readable cadence, e.g. "Daily at 8:00 AM ET"
  cooldown_days?:       number;   // per-symbol quiet period after an alert
  suppress?:            string[]; // things it should deliberately stay quiet about
  context?:             string[]; // context to layer onto every qualifying trigger
  output_style?:        string;   // how the alert note should read
  [key: string]: unknown;
}

export interface Agent {
  id:          string;
  user_id:     string;
  name:        string;
  description: string | null;
  spec:        AgentSpec;
  schedule:    string | null;
  status:      "active" | "paused";
  last_run_at: string | null;
  created_at:  string;
  updated_at:  string;
}

export interface AgentAlert {
  id:         string;
  user_id:    string;
  agent_id:   string | null;
  title:      string;
  body:       string | null;
  symbol:     string | null;
  conviction: "high" | "medium" | "low" | null;
  is_read:    boolean;
  created_at: string;
}

// ─── Scanner API response ─────────────────────────────────────────────────────

export interface ScannerResponse {
  results: ScanResult[];
  ran_at: string;
  source: "tradingview" | "polygon" | "yfinance";
  count: number;
}
