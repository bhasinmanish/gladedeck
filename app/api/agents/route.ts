import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await checkFeature("agents", user);
  if (gate.locked) return NextResponse.json({ error: "AI Agents is a premium feature." }, { status: 403 });

  const body = await request.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id:     user.id,
      name:        body.name.trim(),
      description: body.description ?? null,
      spec:        body.spec ?? {},
      schedule:    body.schedule ?? null,
      status:      "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
