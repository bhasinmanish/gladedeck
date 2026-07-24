// Coinbase Advanced Trade API — JWT auth with CDP API keys
// Docs: https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-auth

import { createPrivateKey, createSign, randomBytes } from "crypto";

const API_BASE = "https://api.coinbase.com/api/v3/brokerage";

// Coinbase provides the private key as raw base64 (PKCS#8 DER, no PEM headers).
// Wrap it so Node.js crypto can load it.
function normalizePem(raw: string): string {
  const cleaned = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (cleaned.includes("-----BEGIN")) return cleaned;
  const b64     = cleaned.replace(/\s+/g, "");
  const chunked = (b64.match(/.{1,64}/g) ?? [b64]).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----`;
}

// Coinbase uses ES256 (ECDSA P-256). The DER signature from Node.js must be
// converted to the raw r||s format that JWTs expect.
function derToRawES256(der: Buffer): Buffer {
  let pos = 2; // skip outer SEQUENCE tag + length (assume single-byte length)
  if (der[1] & 0x80) pos += der[1] & 0x7f; // long-form length

  // R
  pos++;                        // INTEGER tag
  const rLen = der[pos++];
  const r    = der.slice(pos, pos + rLen);
  pos += rLen;

  // S
  pos++;                        // INTEGER tag
  const sLen = der[pos++];
  const s    = der.slice(pos, pos + sLen);

  // Pad each to 32 bytes (P-256 coordinate size) and concatenate
  const pad = (buf: Buffer) =>
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - buf.length)), buf.slice(-32)]);
  return Buffer.concat([pad(r), pad(s)]);
}

export function buildCoinbaseJWT(
  keyName: string,
  privateKeyPem: string,
  method: string,
  path: string,
): string {
  const pem   = normalizePem(privateKeyPem);
  const now   = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex");

  const header  = { alg: "ES256", kid: keyName, nonce };
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
  const signer     = createSign("SHA256");
  signer.update(sigInput);
  const derSig = signer.sign(privateKey);
  const rawSig = derToRawES256(derSig);

  return `${sigInput}.${rawSig.toString("base64url")}`;
}

function authHeaders(keyName: string, privateKey: string, method: string, path: string) {
  return {
    Authorization: `Bearer ${buildCoinbaseJWT(keyName, privateKey, method, path)}`,
    "Content-Type": "application/json",
  };
}

// Lightweight auth check — just verifies the credentials work
export async function testCoinbaseCredentials(
  keyName: string,
  privateKeyPem: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const path = "/api/v3/brokerage/accounts?limit=1";
    const res  = await fetch(`https://api.coinbase.com${path}`, {
      headers: authHeaders(keyName, privateKeyPem, "GET", path),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Coinbase returned ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export interface CoinbaseAsset {
  id:            string;
  name:          string;
  currency:      string;
  balance:       number;
  nativeBalance: number;
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

  const nonZero = raw.filter(
    a => a.type !== "ACCOUNT_TYPE_FIAT" && parseFloat(a.available_balance?.value ?? "0") > 0,
  );
  if (nonZero.length === 0) return [];

  // Batch-fetch mid prices for all held assets
  const productIds = nonZero.map(a => `${a.currency}-USD`).filter(id => id !== "USD-USD");
  const priceMap: Record<string, number> = {};

  if (productIds.length > 0) {
    const qs        = productIds.map(id => `product_ids=${id}`).join("&");
    const pricePath = `/api/v3/brokerage/best_bid_ask?${qs}`;
    const pRes      = await fetch(`https://api.coinbase.com${pricePath}`, {
      headers: authHeaders(keyName, privateKeyPem, "GET", pricePath),
    });
    if (pRes.ok) {
      const pJson = await pRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const book of pJson.pricebooks ?? [] as any[]) {
        const bid = parseFloat(book.bids?.[0]?.price ?? "0");
        const ask = parseFloat(book.asks?.[0]?.price ?? "0");
        if (bid > 0 && ask > 0) priceMap[book.product_id.replace("-USD", "")] = (bid + ask) / 2;
      }
    }
  }

  return nonZero.map(a => {
    const balance = parseFloat(a.available_balance?.value ?? "0");
    return {
      id:            a.uuid,
      name:          a.name,
      currency:      a.currency,
      balance,
      nativeBalance: balance * (priceMap[a.currency] ?? 0),
    };
  });
}
