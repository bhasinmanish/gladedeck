import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getAccounts } from "@/lib/schwab";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  const redirectBase = process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : `https://${request.headers.get("x-forwarded-host") ?? "gladedeck.com"}`;

  if (error || !code) {
    return NextResponse.redirect(`${redirectBase}/dashboard?schwab=error`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${redirectBase}/login`);

    const tokens   = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get the first account hash so we can use it for syncing
    const accounts   = await getAccounts(tokens.access_token);
    const accountHash = accounts?.[0]?.hashValue ?? null;

    await supabase.from("broker_connections").upsert({
      user_id:       user.id,
      broker:        "schwab",
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at:    expiresAt,
      account_hash:  accountHash,
      updated_at:    new Date().toISOString(),
    }, { onConflict: "user_id,broker" });

    return NextResponse.redirect(`${redirectBase}/dashboard?schwab=connected`);
  } catch (e) {
    console.error("[schwab/callback]", e);
    return NextResponse.redirect(`${redirectBase}/dashboard?schwab=error`);
  }
}
