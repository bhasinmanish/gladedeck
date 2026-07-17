import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("broker_connections")
    .select("account_hash, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("broker", "schwab")
    .single();

  return NextResponse.json({ connected: !!data, connection: data ?? null });
}
