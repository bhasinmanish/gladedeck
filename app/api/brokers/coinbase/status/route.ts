import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("broker_connections")
      .select("created_at, updated_at")
      .eq("user_id", user.id)
      .eq("broker", "coinbase")
      .single();

    return NextResponse.json({ connected: !!data, connection: data ?? null });
  } catch (e) {
    console.error("[coinbase/status]", e);
    return NextResponse.json({ connected: false, connection: null });
  }
}
