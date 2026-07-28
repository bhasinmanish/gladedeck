import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) { console.error("[strategies GET]", error.message); return NextResponse.json({ error: "Failed to load strategies" }, { status: 500 }); }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("strategies")
    .insert({
      user_id:     user.id,
      name:        body.name,
      description: body.description ?? null,
      rules:       body.rules ?? null,
      tags:        body.tags ?? null,
      color:       body.color ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[strategies POST]", error.message); return NextResponse.json({ error: "Failed to create strategy" }, { status: 500 }); }
  return NextResponse.json(data, { status: 201 });
}
