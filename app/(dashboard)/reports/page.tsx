import { createClient } from "@/lib/supabase/server";
import { ReportsPage } from "@/components/reports/ReportsPage";
import type { Trade, Strategy } from "@/lib/types";

export default async function ReportsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
