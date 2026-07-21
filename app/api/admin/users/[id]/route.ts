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
    agents,
    agentAlerts,
    subsRes,
    brokersRes,
  ] = await Promise.all([
    admin.auth.admin.getUserById(id),
    countTable(admin, "trades",          id),
    countTable(admin, "alerts",          id),
    countTable(admin, "price_alerts",    id),
    countTable(admin, "watchlists",      id),
    countTable(admin, "strategies",      id),
    countTable(admin, "trade_ideas",     id),
    countTable(admin, "daily_summaries", id),
    countTable(admin, "agents",          id),
    countTable(admin, "agent_alerts",    id),
    admin
      .from("feature_subscriptions")
      .select("feature_key, status, current_period_end")
      .eq("user_id", id)
      .in("status", ["active", "trialing"]),
    admin
      .from("broker_connections")
      .select("broker, updated_at")
      .eq("user_id", id),
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
      agents,
      agent_alerts:    agentAlerts,
    },
    subscriptions: (subsRes.data ?? []).map(s => ({
      feature_key:        s.feature_key,
      status:             s.status,
      current_period_end: s.current_period_end,
    })),
    brokers: (brokersRes.data ?? []).map(b => ({
      broker:      b.broker,
      last_synced: b.updated_at,
    })),
  });
}
