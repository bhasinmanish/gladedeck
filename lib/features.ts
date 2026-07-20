// Central catalog of features that can be gated behind a paywall.
// The mutable state (is_paid + price) lives in the `feature_settings`
// table and is edited by the admin from the Admin Portal → Feature Pricing.

export const ADMIN_EMAIL = "manshabhasin9@gmail.com";

export interface FeatureDef {
  key:         string;
  name:        string;
  description: string;
  route?:      string; // dashboard route this feature gates, if any
}

export const FEATURES: FeatureDef[] = [
  { key: "scanner",      name: "Market Scanner",        description: "Daily gap / RVOL scanner and custom filter presets.", route: "/scanner" },
  { key: "charts",       name: "Charts",                description: "TradingView charts and watchlist workspace.",         route: "/charts" },
  { key: "pine_script",  name: "Pine Script Generator", description: "AI-generated Pine Script & ThinkScript indicators." },
  { key: "alerts",       name: "Alerts",                description: "Price alerts and alert history.",                     route: "/alerts" },
  { key: "daily_review", name: "Daily Review",          description: "Per-trade reflections and daily journaling.",         route: "/daily-review" },
  { key: "trade_log",    name: "Trade Log",             description: "Full trade history and performance stats.",           route: "/trade-log" },
  { key: "strategies",   name: "Strategies",            description: "Strategy library, custom strategies, trade ideas.",   route: "/strategies" },
  { key: "reports",      name: "Reports & Analytics",   description: "Performance analytics and reporting.",                route: "/reports" },
  { key: "broker_sync",  name: "Broker Integration",    description: "Connect Schwab and auto-import trades.",              },
];

export const DEFAULT_FEATURE_PRICE = 1.0;

export interface FeatureSetting {
  key:     string;
  is_paid: boolean;
  price:   number;
}

export function featureByKey(key: string): FeatureDef | undefined {
  return FEATURES.find(f => f.key === key);
}

export function featureByRoute(route: string): FeatureDef | undefined {
  return FEATURES.find(f => f.route === route);
}
