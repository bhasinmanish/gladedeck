import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("watchlists")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) { console.error("[watchlists GET]", error.message); return NextResponse.json({ error: "Failed to load watchlists" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      user_id:     user.id,
      name:        body.name,
      symbols:     body.symbols ?? [],
      description: body.description ?? null,
      color:       body.color ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[watchlists POST]", error.message); return NextResponse.json({ error: "Failed to create watchlist" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...body } = await request.json();
  const patch: Record<string, unknown> = {};
  if (body.name        !== undefined) patch.name        = body.name;
  if (body.symbols     !== undefined) patch.symbols     = body.symbols;
  if (body.description !== undefined) patch.description = body.description;
  if (body.color       !== undefined) patch.color       = body.color;

  const { data, error } = await supabase
    .from("watchlists")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) { console.error("[watchlists PATCH]", error.message); return NextResponse.json({ error: "Failed to update watchlist" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) { console.error("[watchlists DELETE]", error.message); return NextResponse.json({ error: "Failed to delete watchlist" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
