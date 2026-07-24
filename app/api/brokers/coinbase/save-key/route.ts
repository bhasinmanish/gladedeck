import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCoinbaseAccounts } from "@/lib/coinbase";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { keyName, privateKey } = await request.json();
    if (!keyName?.trim() || !privateKey?.trim()) {
      return NextResponse.json({ error: "Both Key Name and Private Key are required." }, { status: 400 });
    }

    // Validate the credentials before saving by making a real API call
    try {
      await getCoinbaseAccounts(keyName.trim(), privateKey.trim());
    } catch {
      return NextResponse.json(
        { error: "Couldn't authenticate with Coinbase — check that your Key Name and Private Key are correct." },
        { status: 400 },
      );
    }

    // Store in broker_connections — reuse access_token for key_name, refresh_token for private_key
    await supabase.from("broker_connections").upsert({
      user_id:       user.id,
      broker:        "coinbase",
      access_token:  keyName.trim(),
      refresh_token: privateKey.trim(),
      expires_at:    new Date("2099-01-01").toISOString(), // API keys don't expire
      account_hash:  null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "user_id,broker" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coinbase/save-key]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
