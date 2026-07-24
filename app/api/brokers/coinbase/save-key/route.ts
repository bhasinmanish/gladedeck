import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testCoinbaseCredentials } from "@/lib/coinbase";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { keyName, privateKey } = await request.json();
    if (!keyName?.trim() || !privateKey?.trim()) {
      return NextResponse.json({ error: "Both Key Name and Private Key are required." }, { status: 400 });
    }

    const check = await testCoinbaseCredentials(keyName.trim(), privateKey.trim());
    if (!check.ok) {
      console.error("[coinbase/save-key] auth test failed:", check.error);
      return NextResponse.json(
        { error: "Couldn't authenticate with Coinbase. Make sure you copied the full Key Name (organizations/…/apiKeys/…) and the complete Private Key including the header/footer lines." },
        { status: 400 },
      );
    }

    await supabase.from("broker_connections").upsert({
      user_id:       user.id,
      broker:        "coinbase",
      access_token:  keyName.trim(),
      refresh_token: privateKey.trim(),
      expires_at:    new Date("2099-01-01").toISOString(),
      account_hash:  null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "user_id,broker" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coinbase/save-key]", e);
    return NextResponse.json({ error: "Server error — please try again." }, { status: 500 });
  }
}
