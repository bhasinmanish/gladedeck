import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  if (body.symbol       !== undefined) patch.symbol       = body.symbol;
  if (body.direction    !== undefined) patch.direction    = body.direction;
  if (body.thesis       !== undefined) patch.thesis       = body.thesis;
  if (body.target_price !== undefined) patch.target_price = body.target_price;
  if (body.stop_price   !== undefined) patch.stop_price   = body.stop_price;
  if (body.entry_price  !== undefined) patch.entry_price  = body.entry_price;
  if (body.risk_reward  !== undefined) patch.risk_reward  = body.risk_reward;
  if (body.tags         !== undefined) patch.tags         = body.tags;
  if (body.status       !== undefined) patch.status       = body.status;
  if (body.timeframe    !== undefined) patch.timeframe    = body.timeframe;
  if (body.notes        !== undefined) patch.notes        = body.notes;
  if (body.confidence   !== undefined) patch.confidence   = body.confidence;

  const { data, error } = await supabase
    .from("trade_ideas")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) { console.error("[trade-ideas PUT]", error.message); return NextResponse.json({ error: "Failed to update trade idea" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("trade_ideas")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) { console.error("[trade-ideas DELETE]", error.message); return NextResponse.json({ error: "Failed to delete trade idea" }, { status: 500 }); }
  return new NextResponse(null, { status: 204 });
}
