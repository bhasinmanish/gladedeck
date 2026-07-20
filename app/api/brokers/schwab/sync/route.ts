import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { getValidAccessToken, getOrders, getAccountNumbers, mapOrderToTrade } from "@/lib/schwab";

// Composite key for de-duplicating trades across re-syncs.
function tradeKey(t: { symbol: string; entry_date: string; entry_price: number; qty: number; side: string }) {
  return `${t.symbol}|${t.entry_date}|${t.entry_price}|${t.qty}|${t.side}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return NextResponse.json({ error: "Broker integration is a premium feature." }, { status: 403 });

  // How many days back to sync (default 90)
  const body = await request.json().catch(() => ({}));
  const days: number = body.days ?? 90;

  try {
    const { data: conn } = await supabase
      .from("broker_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("broker", "schwab")
      .single();

    if (!conn) {
      return NextResponse.json({ error: "Schwab account not connected" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(user.id);

    // Fetch every account's hash — a Schwab login can hold multiple brokerage accounts.
    const accountNumbers = await getAccountNumbers(accessToken);
    if (!Array.isArray(accountNumbers) || accountNumbers.length === 0) {
      return NextResponse.json(
        { error: "No Schwab accounts found on this login. Make sure the account is active and the app has account access." },
        { status: 400 },
      );
    }

    const toDate   = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace("Z", "+0000");

    // Pull filled orders from all accounts and map them to trades.
    const mapped: NonNullable<ReturnType<typeof mapOrderToTrade>>[] = [];
    for (const acct of accountNumbers) {
      const orders = await getOrders(accessToken, acct.hashValue, fmt(fromDate), fmt(toDate));
      if (!Array.isArray(orders)) continue;
      for (const o of orders) {
        const trade = mapOrderToTrade(o, user.id);
        if (trade) mapped.push(trade);
      }
    }

    if (mapped.length === 0) {
      return NextResponse.json({ synced: 0, message: "No filled orders found in range." });
    }

    // De-dupe against trades already saved (both against the DB and within this batch).
    const { data: existing } = await supabase
      .from("trades")
      .select("symbol, entry_date, entry_price, qty, side")
      .eq("user_id", user.id)
      .eq("source", "schwab");

    const seen = new Set((existing ?? []).map(tradeKey));

    const toInsert = mapped.filter(t => {
      const key = tradeKey(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (toInsert.length === 0) {
      return NextResponse.json({ synced: 0, message: "All trades already imported." });
    }

    const { data: inserted, error } = await supabase
      .from("trades")
      .insert(toInsert)
      .select();

    if (error) throw new Error(error.message);

    await supabase
      .from("broker_connections")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("broker", "schwab");

    return NextResponse.json({ synced: inserted?.length ?? 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[schwab/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
