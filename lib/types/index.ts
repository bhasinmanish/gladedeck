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

// ─── Scanner API response ─────────────────────────────────────────────────────

export interface ScannerResponse {
  results: ScanResult[];
  ran_at: string;
  source: "tradingview" | "polygon" | "yfinance";
  count: number;
}
