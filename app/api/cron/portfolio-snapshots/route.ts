import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken, getAccounts, mapPositions } from "@/lib/schwab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records one portfolio-value snapshot per connected Schwab user, so the
// longer return windows (1W/1M/YTD/All) can be computed over time.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We also accept
// the same secret via ?key= for manual runs.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get("authorization");
  const key    = new URL(request.url).searchParams.get("key");
  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: conns } = await admin
    .from("broker_connections")
    .select("user_id")
    .eq("broker", "schwab");

  let written = 0;
  const errors: string[] = [];

  for (const conn of conns ?? []) {
    const userId = conn.user_id as string;
    try {
      const accessToken = await getValidAccessToken(userId, admin);
      const accounts    = await getAccounts(accessToken);
      const { totalValue } = mapPositions(accounts);

      await admin.from("portfolio_snapshots").upsert(
        { user_id: userId, date: today, total_value: totalValue },
        { onConflict: "user_id,date" },
      );
      written++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${userId.slice(0, 8)}: ${msg}`);
    }
  }

  return NextResponse.json({ date: today, written, errors });
}
