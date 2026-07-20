import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { WatchlistSidebar } from "@/components/charts/WatchlistSidebar";
import { TradingViewChart } from "@/components/charts/TradingViewChart";
import { PineScriptPanel } from "@/components/charts/PineScriptPanel";
import type { PriceAlert } from "@/lib/types";

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: { symbol?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("charts", user);
  if (gate.locked) return <FeatureLocked name="Charts" price={gate.price} />;

  const pineGate = await checkFeature("pine_script", user);

  const [{ data: watchlists }, { data: priceAlerts }] = await Promise.all([
    supabase
      .from("watchlists")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("price_alerts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="h-[calc(100vh-57px)] flex overflow-hidden">
      <WatchlistSidebar
        watchlists={watchlists ?? []}
        userId={user!.id}
        initialPriceAlerts={(priceAlerts as PriceAlert[]) ?? []}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TradingViewChart symbol={searchParams.symbol} />
      </div>
      <PineScriptPanel locked={pineGate.locked} price={pineGate.price} />
    </div>
  );
}
