import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { StrategiesPage } from "@/components/strategies/StrategiesPage";
import type { Strategy, TradeIdea, Trade } from "@/lib/types";

export default async function StrategiesRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("strategies", user);
  if (gate.locked) return <FeatureLocked name="Strategies" price={gate.price} featureKey="strategies" />;

  const [
    { data: strategies },
    { data: ideas },
    { data: trades },
  ] = await Promise.all([
    supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("trade_ideas")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("entry_date", { ascending: false }),
  ]);

  return (
    <StrategiesPage
      strategies={(strategies as Strategy[]) ?? []}
      ideas={(ideas as TradeIdea[]) ?? []}
      trades={(trades as Trade[]) ?? []}
    />
  );
}
