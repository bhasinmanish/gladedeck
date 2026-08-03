import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ai_morning_picks")
    .select("*")
    .order("date", { ascending: false })
    .limit(14);

  if (error) {
    console.error("[ai-morning-picks]", error.message);
    return NextResponse.json({ error: "Failed to load picks" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
