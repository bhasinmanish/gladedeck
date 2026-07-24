// Coinbase Advanced Trade API — JWT auth with CDP API keys
// Docs: https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-auth

import { createPrivateKey, sign, randomBytes } from "crypto";

const API_BASE = "https://api.coinbase.com/api/v3/brokerage";

// Coinbase provides Ed25519 private keys in NaCl format:
// 64 bytes = first 32 bytes (seed) + last 32 bytes (public key).
// Node.js needs PKCS#8 DER built from just the 32-byte seed.
function ed25519Pkcs8FromSeed(seed: Buffer): Buffer {
  //  30 2E           SEQUENCE (46 bytes)
  //    02 01 00      INTEGER 0  (version)
  //    30 05         SEQUENCE
  //      06 03 2B 65 70  OID 1.3.101.112 (id-EdDSA)
  //    04 22         OCTET STRING (34 bytes)
  //      04 20       OCTET STRING (32 bytes)
  //        <seed>
  const OID     = Buffer.from([0x06, 0x03, 0x2b, 0x65, 0x70]);
  const algoId  = Buffer.concat([Buffer.from([0x30, 0x05]), OID]);
  const privOct = Buffer.concat([Buffer.from([0x04, 0x20]), seed]);
  const wrapped = Buffer.concat([Buffer.from([0x04, 0x22]), privOct]);
  const version = Buffer.from([0x02, 0x01, 0x00]);
  const inner   = Buffer.concat([version, algoId, wrapped]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

function normalizePem(raw: string): string {
  const cleaned = raw.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (cleaned.includes("-----BEGIN")) return cleaned;

  const b64   = cleaned.replace(/\s+/g, "");
  const bytes = Buffer.from(b64, "base64");

  if (bytes.length === 64) {
    // NaCl Ed25519 key — extract the 32-byte seed
    const der     = ed25519Pkcs8FromSeed(bytes.slice(0, 32));
    const encoded = der.toString("base64").match(/.{1,64}/g)!.join("\n");
    return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`;
  }

  // Fallback: assume content is already raw PKCS#8 DER
  const chunked = (b64.match(/.{1,64}/g) ?? [b64]).join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----`;
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
    return { ok: false, error: `Coinbase returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}` };
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
