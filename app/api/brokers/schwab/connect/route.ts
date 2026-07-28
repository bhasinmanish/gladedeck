import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { buildAuthUrl } from "@/lib/schwab";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/dashboard?schwab=locked`);
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set("schwab_oauth_state", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV !== "development",
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });
  return response;
}
