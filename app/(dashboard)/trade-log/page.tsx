import { createClient } from "@/lib/supabase/server";
import { TradeTable } from "@/components/trades/TradeTable";
import type { Trade, Strategy } from "@/lib/types";

export default async function TradeLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: trades }, { data: strategies }] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("strategies")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Trade Log</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Your full trade history</p>
      </div>
      <TradeTable
        trades={(trades as Trade[]) ?? []}
        strategies={(strategies as Pick<Strategy, "id" | "name">[]) ?? []}
      />
    </div>
  );
}
