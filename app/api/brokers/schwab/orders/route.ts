import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { getValidAccessToken, getAccountNumbers, getOrders, mapOrderToView, type SchwabOrder } from "@/lib/schwab";

export const runtime = "nodejs";

// Returns every Schwab order (all statuses) from the last 60 days, live.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return NextResponse.json({ error: "Broker integration is a premium feature." }, { status: 403 });

  // Connected?
  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("broker", "schwab")
    .maybeSingle();

  if (!conn) return NextResponse.json({ connected: false, orders: [] });

  try {
    const accessToken    = await getValidAccessToken(user.id);
    const accountNumbers = await getAccountNumbers(accessToken);
    if (!Array.isArray(accountNumbers) || accountNumbers.length === 0) {
      return NextResponse.json({ connected: true, orders: [] });
    }

    const toDate   = new Date();
    const fromDate = new Date(toDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString();

    const orders = [];
    for (let i = 0; i < accountNumbers.length; i++) {
      const acct  = accountNumbers[i];
      const label = `Account ${i + 1} ·••${acct.accountNumber.slice(-4)}`;
      const raw   = await getOrders(accessToken, acct.hashValue, fmt(fromDate), fmt(toDate)); // no status → all
      if (!Array.isArray(raw)) continue;
      for (const o of raw as SchwabOrder[]) {
        const view = mapOrderToView(o, label);
        if (view) orders.push(view);
      }
    }

    // Newest first.
    orders.sort((a, b) => new Date(b.enteredTime).getTime() - new Date(a.enteredTime).getTime());

    return NextResponse.json({ connected: true, orders });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[schwab/orders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
