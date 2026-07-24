import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCoinbaseAccounts } from "@/lib/coinbase";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: conn } = await supabase
      .from("broker_connections")
      .select("access_token, refresh_token")
      .eq("user_id", user.id)
      .eq("broker", "coinbase")
      .single();

    if (!conn) {
      return NextResponse.json({ connected: false, accounts: [], totalUsd: 0 });
    }

    const accounts = await getCoinbaseAccounts(conn.access_token, conn.refresh_token);
    const totalUsd = accounts.reduce((s, a) => s + a.nativeBalance, 0);

    return NextResponse.json({ connected: true, accounts, totalUsd });
  } catch (e) {
    console.error("[coinbase/balances]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
