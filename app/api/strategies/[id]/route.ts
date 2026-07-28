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
  const { data, error } = await supabase
    .from("strategies")
    .update({
      name:        body.name,
      description: body.description ?? null,
      rules:       body.rules ?? null,
      tags:        body.tags ?? null,
      color:       body.color ?? null,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) { console.error("[strategies PUT]", error.message); return NextResponse.json({ error: "Failed to update strategy" }, { status: 500 }); }
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
    .from("strategies")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) { console.error("[strategies DELETE]", error.message); return NextResponse.json({ error: "Failed to delete strategy" }, { status: 500 }); }
  return new NextResponse(null, { status: 204 });
}
