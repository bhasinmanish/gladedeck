import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET ?scope=symbol | general | (all). Symbol notes have a ticker; general don't.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = new URL(request.url).searchParams.get("scope");

  let query = supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (scope === "symbol")  query = query.not("symbol", "is", null);
  if (scope === "general") query = query.is("symbol", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST { symbol?, body, source? }. With a symbol → upsert (one note per ticker).
// Without → create a general notepad entry (empty body allowed).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const now  = new Date().toISOString();

  if (body.symbol) {
    if (!body.body?.trim()) {
      return NextResponse.json({ error: "Note text is required" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("notes")
      .upsert(
        {
          user_id: user.id,
          symbol:  String(body.symbol).toUpperCase(),
          body:    body.body.trim(),
          source:  body.source ?? "symbol",
          updated_at: now,
        },
        { onConflict: "user_id,symbol" },
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      symbol:  null,
      body:    (body.body ?? "").toString(),
      source:  body.source ?? "general",
      updated_at: now,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
