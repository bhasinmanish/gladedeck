// Schwab Developer API client
// Docs: https://developer.schwab.com/products/trader-api--individual-/details/documentation/Retail%20Trader%20API%20Production

import { createClient } from "@/lib/supabase/server";

const BASE_URL   = "https://api.schwabapi.com";
const AUTH_URL   = `${BASE_URL}/v1/oauth/authorize`;
const TOKEN_URL  = `${BASE_URL}/v1/oauth/token`;
const TRADER_URL = `${BASE_URL}/trader/v1`;

export const SCHWAB_CLIENT_ID     = process.env.SCHWAB_CLIENT_ID!;
export const SCHWAB_CLIENT_SECRET = process.env.SCHWAB_CLIENT_SECRET!;
export const SCHWAB_REDIRECT_URI  = process.env.SCHWAB_REDIRECT_URI!;

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id:     SCHWAB_CLIENT_ID,
    redirect_uri:  SCHWAB_REDIRECT_URI,
    response_type: "code",
    scope:         "readonly",
  });
  return `${AUTH_URL}?${params}`;
}

function basicAuth() {
  return Buffer.from(`${SCHWAB_CLIENT_ID}:${SCHWAB_CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: SCHWAB_REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  }>;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  }>;
}

// ── Token management ──────────────────────────────────────────────────────────

// Returns a valid access token for the current user, refreshing if needed.
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("broker_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("broker", "schwab")
    .single();

  if (error || !data) throw new Error("Schwab account not connected");

  const expiresAt = new Date(data.expires_at).getTime();
  const now       = Date.now();

  // Refresh if within 60 seconds of expiry
  if (now >= expiresAt - 60_000) {
    const tokens = await refreshAccessToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from("broker_connections")
      .update({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at:    newExpiry,
        updated_at:    new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("broker", "schwab");

    return tokens.access_token;
  }

  return data.access_token;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function schwabGet(path: string, accessToken: string) {
  const res = await fetch(`${TRADER_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Schwab API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getAccounts(accessToken: string) {
  return schwabGet("/accounts?fields=positions", accessToken);
}

// Returns the account number → hash mapping. The hash is what all other
// account-scoped endpoints (orders, positions) require in their path.
export async function getAccountNumbers(accessToken: string) {
  return schwabGet("/accounts/accountNumbers", accessToken) as Promise<
    Array<{ accountNumber: string; hashValue: string }>
  >;
}

export async function getOrders(
  accessToken: string,
  accountHash: string,
  fromDate: string,
  toDate: string,
) {
  const params = new URLSearchParams({ fromEnteredTime: fromDate, toEnteredTime: toDate, status: "FILLED" });
  return schwabGet(`/accounts/${accountHash}/orders?${params}`, accessToken);
}

// ── Trade mapping ─────────────────────────────────────────────────────────────

export interface SchwabOrder {
  orderId:              number;
  status:               string;
  enteredTime:          string;
  closeTime?:           string;
  orderLegCollection:   Array<{
    instruction:  string; // BUY | SELL | BUY_TO_OPEN | SELL_TO_CLOSE etc.
    quantity:     number;
    instrument: { symbol: string; assetType: string };
  }>;
  orderActivityCollection?: Array<{
    activityType:   string;
    executionLegs?: Array<{ price: number; quantity: number; time: string }>;
  }>;
}

export function mapOrderToTrade(order: SchwabOrder, userId: string) {
  const leg  = order.orderLegCollection?.[0];
  if (!leg) return null;

  const exec = order.orderActivityCollection?.find(a => a.activityType === "EXECUTION");
  const fill = exec?.executionLegs?.[0];
  const price = fill?.price ?? 0;

  const isBuy  = leg.instruction.includes("BUY");
  const isSell = leg.instruction.includes("SELL");
  if (!isBuy && !isSell) return null;

  // Keep the full execution timestamp (prefer the fill time, then order
  // entered/close time). Stored as timestamptz so the time is preserved.
  const entryDate = fill?.time ?? order.enteredTime ?? order.closeTime ?? new Date().toISOString();

  return {
    user_id:         userId,
    symbol:          leg.instrument.symbol,
    side:            isBuy ? "long" : "short",
    trade_type:      "day_trade" as const,
    entry_date:      entryDate,
    entry_price:     price,
    exit_price:      null,
    exit_date:       null,
    qty:             leg.quantity,
    pnl:             null,
    setup_notes:     null,
    strategy_id:     null,
    account:         "schwab",
    source:          "schwab" as const,
    // Stable Schwab order id — used to prevent duplicate imports on re-sync.
    broker_order_id: order.orderId != null ? String(order.orderId) : null,
  };
}
