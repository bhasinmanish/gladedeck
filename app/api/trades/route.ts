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
  if (error) { console.error("[trades GET]", error.message); return NextResponse.json({ error: "Failed to load trades" }, { status: 500 }); }
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
    .insert({
      user_id:     user.id,
      source:      "manual",
      symbol:      body.symbol,
      side:        body.side,
      entry_date:  body.entry_date,
      exit_date:   body.exit_date ?? null,
      entry_price: body.entry_price,
      exit_price:  body.exit_price ?? null,
      shares:      body.shares,
      quantity:    body.quantity ?? null,
      strategy_id: body.strategy_id ?? null,
      notes:       body.notes ?? null,
      pnl:         body.pnl ?? null,
      fees:        body.fees ?? null,
      commission:  body.commission ?? null,
      setup_grade: body.setup_grade ?? null,
      setup_type:  body.setup_type ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[trades POST]", error.message); return NextResponse.json({ error: "Failed to create trade" }, { status: 500 }); }
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
  if (error) { console.error("[trades DELETE]", error.message); return NextResponse.json({ error: "Failed to delete trades" }, { status: 500 }); }

  return NextResponse.json({ deleted: count ?? 0 });
}
