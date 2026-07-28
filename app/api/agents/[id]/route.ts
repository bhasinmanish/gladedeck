import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name        !== undefined) patch.name        = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (body.spec        !== undefined) patch.spec        = body.spec;
  if (body.schedule    !== undefined) patch.schedule    = body.schedule;
  if (body.status      !== undefined) patch.status      = body.status;

  const { data, error } = await supabase
    .from("agents")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) { console.error("[agents/id]", error.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
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
    .from("agents")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) { console.error("[agents/id]", error.message); return NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
  return new NextResponse(null, { status: 204 });
}
