import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // "open" | "closed"
  const date   = searchParams.get("date");   // "YYYY-MM-DD"

  let query = supabase
    .from("trades")
    .select("*, strategies(name)")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: true });

  if (status === "open")   query = query.is("exit_date", null);
  if (status === "closed") query = query.not("exit_date", "is", null);
  if (date)                query = query.eq("entry_date", date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { data, error } = await supabase
    .from("trades")
    .insert({ ...body, user_id: user.id, source: "manual" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// Bulk-delete the user's trades. Provide { ids: [...] } in the body to delete
// specific trades, or ?scope=all (default) / ?scope=synced for a bulk clear.
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids  = Array.isArray(body?.ids) ? body.ids : null;
  const scope = new URL(request.url).searchParams.get("scope") ?? "all";

  let query = supabase.from("trades").delete().eq("user_id", user.id);
  if (ids && ids.length > 0)     query = query.in("id", ids);
  else if (scope === "synced")   query = query.eq("source", "schwab");
  // else: scope "all" — delete every trade for this user

  const { error, count } = await query.select("id", { count: "exact" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: count ?? 0 });
}
