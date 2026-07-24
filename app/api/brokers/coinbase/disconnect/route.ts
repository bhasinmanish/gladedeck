import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await supabase
      .from("broker_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("broker", "coinbase");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coinbase/disconnect]", e);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
