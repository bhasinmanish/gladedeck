import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, getOrders, getAccounts, mapOrderToTrade } from "@/lib/schwab";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // How many days back to sync (default 90)
  const body = await request.json().catch(() => ({}));
  const days: number = body.days ?? 90;

  try {
    const { data: conn } = await supabase
      .from("broker_connections")
      .select("account_hash")
      .eq("user_id", user.id)
      .eq("broker", "schwab")
      .single();

    if (!conn) {
      return NextResponse.json({ error: "Schwab account not connected" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(user.id);

    // If account_hash is missing (e.g. wasn't captured during OAuth), fetch and save it now
    let accountHash = conn.account_hash;
    if (!accountHash) {
      const accounts = await getAccounts(accessToken);
      accountHash = accounts?.[0]?.hashValue ?? null;
      if (accountHash) {
        await supabase
          .from("broker_connections")
          .update({ account_hash: accountHash })
          .eq("user_id", user.id)
          .eq("broker", "schwab");
      }
    }

    if (!accountHash) {
      return NextResponse.json({ error: "Could not retrieve Schwab account. Make sure your account is active." }, { status: 400 });
    }

    const toDate   = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const fmt = (d: Date) => d.toISOString().replace("Z", "+0000");

    const orders = await getOrders(
      accessToken,
      accountHash,
      fmt(fromDate),
      fmt(toDate),
    );

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ synced: 0, message: "No filled orders found in range" });
    }

    const trades = orders
      .map((o: Parameters<typeof mapOrderToTrade>[0]) => mapOrderToTrade(o, user.id))
      .filter(Boolean);

    if (trades.length === 0) {
      return NextResponse.json({ synced: 0, message: "No mappable trades found" });
    }

    // Upsert by schwab orderId stored in setup_notes to avoid duplicates
    // We identify duplicates by symbol+entry_date+entry_price+qty+source
    const { data: inserted, error } = await supabase
      .from("trades")
      .upsert(trades, {
        onConflict:        "user_id,symbol,entry_date,entry_price,source",
        ignoreDuplicates:  true,
      })
      .select();

    if (error) throw new Error(error.message);

    // Update last synced timestamp
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
