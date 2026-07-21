import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DEFAULTS = {
  email_enabled:       false,
  email_news:          true,
  email_scanner:       false,
  email_price_alerts:  true,
  email_agents:        true,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("notification_prefs")
    .select("email_enabled,email_news,email_scanner,email_price_alerts,email_agents")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json(data ?? DEFAULTS);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { error } = await supabase
    .from("notification_prefs")
    .upsert(
      {
        user_id:             user.id,
        email_enabled:       body.email_enabled       ?? false,
        email_news:          body.email_news          ?? true,
        email_scanner:       body.email_scanner       ?? false,
        email_price_alerts:  body.email_price_alerts  ?? true,
        email_agents:        body.email_agents        ?? true,
        updated_at:          new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
