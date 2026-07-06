import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";

async function countTable(admin: ReturnType<typeof createAdminClient>, table: string, userId: string) {
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const [
    { data: { user: targetUser }, error: userErr },
    trades,
    alerts,
    priceAlerts,
    watchlists,
    strategies,
    tradeIdeas,
    dailySummaries,
  ] = await Promise.all([
    admin.auth.admin.getUserById(id),
    countTable(admin, "trades",          id),
    countTable(admin, "alerts",          id),
    countTable(admin, "price_alerts",    id),
    countTable(admin, "watchlists",      id),
    countTable(admin, "strategies",      id),
    countTable(admin, "trade_ideas",     id),
    countTable(admin, "daily_summaries", id),
  ]);

  if (userErr || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id:              targetUser.id,
    email:           targetUser.email,
    created_at:      targetUser.created_at,
    last_sign_in_at: targetUser.last_sign_in_at,
    provider:        targetUser.app_metadata?.provider ?? "email",
    stats: {
      trades,
      alerts,
      price_alerts:    priceAlerts,
      watchlists,
      strategies,
      trade_ideas:     tradeIdeas,
      daily_summaries: dailySummaries,
    },
  });
}
