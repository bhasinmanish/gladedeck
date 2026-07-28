import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("trade_ideas")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) { console.error("[trade-ideas GET]", error.message); return NextResponse.json({ error: "Failed to load trade ideas" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("trade_ideas")
    .insert({
      user_id:      user.id,
      symbol:       body.symbol,
      direction:    body.direction,
      thesis:       body.thesis ?? null,
      target_price: body.target_price ?? null,
      stop_price:   body.stop_price ?? null,
      entry_price:  body.entry_price ?? null,
      risk_reward:  body.risk_reward ?? null,
      tags:         body.tags ?? null,
      status:       body.status ?? null,
      timeframe:    body.timeframe ?? null,
      notes:        body.notes ?? null,
      confidence:   body.confidence ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[trade-ideas POST]", error.message); return NextResponse.json({ error: "Failed to create trade idea" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
