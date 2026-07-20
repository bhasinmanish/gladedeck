import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { AlertsPage } from "@/components/alerts/AlertsPage";
import type { Alert, PriceAlert, Watchlist } from "@/lib/types";

export default async function AlertsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("alerts", user);
  if (gate.locked) return <FeatureLocked name="Alerts" price={gate.price} featureKey="alerts" />;

  const [{ data: priceAlerts }, { data: activityAlerts }, { data: watchlists }] =
    await Promise.all([
      supabase
        .from("price_alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("triggered_at", { ascending: false })
        .limit(100),
      supabase
        .from("watchlists")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true }),
    ]);

  return (
    <AlertsPage
      priceAlerts={(priceAlerts as PriceAlert[]) ?? []}
      activityAlerts={(activityAlerts as Alert[]) ?? []}
      userId={user!.id}
      watchlists={(watchlists as Watchlist[]) ?? []}
    />
  );
}
