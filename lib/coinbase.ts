// Coinbase Advanced Trade API — JWT auth with CDP API keys
// Docs: https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-auth

import { createPrivateKey, sign, randomBytes } from "crypto";

const API_BASE = "https://api.coinbase.com/api/v3/brokerage";

// Build a signed JWT for one request (valid 120 s)
export function buildCoinbaseJWT(
  keyName: string,
  privateKeyPem: string,
  method: string,
  path: string,
): string {
  // Coinbase sometimes delivers the PEM with literal \n instead of real newlines
  const pem   = privateKeyPem.replace(/\\n/g, "\n");
  const now   = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex");

  const header  = { alg: "EdDSA", kid: keyName, nonce };
  const payload = {
    sub: keyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    aud: ["retail_rest_api_proxy"],
    uri: `${method} api.coinbase.com${path}`,
  };

  const headerB64  = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sigInput   = `${headerB64}.${payloadB64}`;

  const privateKey = createPrivateKey(pem);
  const sig        = sign(null, Buffer.from(sigInput), privateKey);
  return `${sigInput}.${sig.toString("base64url")}`;
}

function authHeaders(keyName: string, privateKey: string, method: string, path: string) {
  return {
    Authorization: `Bearer ${buildCoinbaseJWT(keyName, privateKey, method, path)}`,
    "Content-Type": "application/json",
  };
}

export interface CoinbaseAsset {
  id:            string;
  name:          string;
  currency:      string;
  balance:       number;   // native crypto amount
  nativeBalance: number;   // USD equivalent
}

export async function getCoinbaseAccounts(
  keyName: string,
  privateKeyPem: string,
): Promise<CoinbaseAsset[]> {
  const path = "/api/v3/brokerage/accounts";
  const res  = await fetch(`${API_BASE}/accounts`, {
    headers: authHeaders(keyName, privateKeyPem, "GET", path),
  });
  if (!res.ok) throw new Error(`Coinbase accounts: ${res.status} ${await res.text()}`);

  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = json.accounts ?? [];

  // Filter to crypto accounts with a non-zero balance
  const nonZero = raw.filter(
    a => a.type !== "ACCOUNT_TYPE_FIAT" && parseFloat(a.available_balance?.value ?? "0") > 0,
  );

  if (nonZero.length === 0) return [];

  // Batch-fetch prices for all held assets
  const productIds = nonZero
    .map(a => `${a.currency}-USD`)
    .filter(id => id !== "USD-USD");

  let priceMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const qs       = productIds.map(id => `product_ids=${id}`).join("&");
    const pricePath = `/api/v3/brokerage/best_bid_ask?${qs}`;
    const pRes     = await fetch(`https://api.coinbase.com${pricePath}`, {
      headers: authHeaders(keyName, privateKeyPem, "GET", pricePath),
    });
    if (pRes.ok) {
      const pJson = await pRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const book of pJson.pricebooks ?? [] as any[]) {
        const bid = parseFloat(book.bids?.[0]?.price ?? "0");
        const ask = parseFloat(book.asks?.[0]?.price ?? "0");
        if (bid > 0 && ask > 0) {
          priceMap[book.product_id.replace("-USD", "")] = (bid + ask) / 2;
        }
      }
    }
  }

  return nonZero.map(a => {
    const balance = parseFloat(a.available_balance?.value ?? "0");
    const price   = priceMap[a.currency] ?? 0;
    return {
      id:            a.uuid,
      name:          a.name,
      currency:      a.currency,
      balance,
      nativeBalance: balance * price,
    };
  });
}
