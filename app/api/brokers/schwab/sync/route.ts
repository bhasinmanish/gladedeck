import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { getValidAccessToken, getOrders, getAccountNumbers, mapOrderToTrade } from "@/lib/schwab";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return NextResponse.json({ error: "Broker integration is a premium feature." }, { status: 403 });

  // How many days back to sync. Schwab only allows dates within 60 days
  // of today, so cap the lookback there.
  const body = await request.json().catch(() => ({}));
  const days = Math.min(Number(body.days) || 60, 60);

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
    // Schwab expects ISO-8601 like yyyy-MM-dd'T'HH:mm:ss.SSSZ — exactly what
    // toISOString() produces. (Do NOT rewrite the trailing "Z".)
    const fmt = (d: Date) => d.toISOString();

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

    // De-dupe within this batch by Schwab order id.
    const byOrderId = new Map<string, (typeof mapped)[number]>();
    for (const t of mapped) {
      if (t.broker_order_id) byOrderId.set(t.broker_order_id, t);
    }
    const toInsert = Array.from(byOrderId.values());

    // Upsert on (user_id, broker_order_id): re-syncing the same orders is a
    // no-op, so trades are never duplicated. Requires the unique constraint.
    const { data: inserted, error } = await supabase
      .from("trades")
      .upsert(toInsert, { onConflict: "user_id,broker_order_id", ignoreDuplicates: true })
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
