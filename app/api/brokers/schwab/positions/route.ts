import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { getValidAccessToken, getAccounts, mapPositions } from "@/lib/schwab";

export const runtime = "nodejs";

// Finds the snapshot on or before a cutoff date and returns the % change from
// it to the current value. Null when there's no snapshot old enough yet.
function returnSince(
  snapshots: { date: string; total_value: number }[],
  cutoff: Date,
  current: number,
): number | null {
  // snapshots are ascending by date
  let base: number | null = null;
  for (const s of snapshots) {
    if (new Date(s.date) <= cutoff) base = s.total_value;
    else break;
  }
  if (base == null || base === 0) return null;
  return (current - base) / base * 100;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return NextResponse.json({ error: "Broker integration is a premium feature." }, { status: 403 });

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("broker", "schwab")
    .maybeSingle();

  if (!conn) return NextResponse.json({ connected: false });

  try {
    const accessToken = await getValidAccessToken(user.id);
    const accounts    = await getAccounts(accessToken);
    const { positions, totalValue } = mapPositions(accounts);

    const dayChange = positions.reduce((s, p) => s + p.dayChange, 0);
    const prevValue = totalValue - dayChange;
    const dayChangePct = prevValue > 0 ? (dayChange / prevValue) * 100 : null;

    // Longer windows from stored daily snapshots (fill in as history accrues).
    const { data: snaps } = await supabase
      .from("portfolio_snapshots")
      .select("date, total_value")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    const snapshots = (snaps ?? []).map(s => ({ date: s.date as string, total_value: Number(s.total_value) }));
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);

    const returns = {
      "1D":  dayChangePct,
      "1W":  returnSince(snapshots, new Date(now.getTime() - 7  * 864e5), totalValue),
      "1M":  returnSince(snapshots, new Date(now.getTime() - 30 * 864e5), totalValue),
      "YTD": returnSince(snapshots, jan1, totalValue),
      "ALL": snapshots.length > 0 && snapshots[0].total_value > 0
        ? (totalValue - snapshots[0].total_value) / snapshots[0].total_value * 100
        : null,
    };

    return NextResponse.json({ connected: true, totalValue, dayChange, positions, returns });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[schwab/positions]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
