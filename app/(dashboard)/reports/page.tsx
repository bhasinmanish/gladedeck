import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { ReportsPage } from "@/components/reports/ReportsPage";
import type { Trade, Strategy } from "@/lib/types";

export default async function ReportsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("reports", user);
  if (gate.locked) return <FeatureLocked name="Reports & Analytics" price={gate.price} />;

  const [{ data: trades }, { data: strategies }] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("entry_date", { ascending: false }),
    supabase
      .from("strategies")
      .select("*")
      .eq("user_id", user!.id),
  ]);

  return (
    <ReportsPage
      trades={(trades as Trade[]) ?? []}
      strategies={(strategies as Strategy[]) ?? []}
    />
  );
}
