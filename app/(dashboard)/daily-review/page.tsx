import { createClient } from "@/lib/supabase/server";
import { DailyReviewWorkspace } from "@/components/daily-review/DailyReviewWorkspace";
import type { Trade, DailySummary } from "@/lib/types";

export default async function DailyReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: trades }, { data: summary }] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .eq("entry_date", today)
      .order("created_at", { ascending: true }),
    supabase
      .from("daily_summaries")
      .select("*")
      .eq("user_id", user!.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Daily Review</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{dateLabel}</p>
      </div>
      <DailyReviewWorkspace
        initialTrades={(trades as Trade[]) ?? []}
        initialSummary={summary as DailySummary | null}
        userId={user!.id}
        date={today}
      />
    </div>
  );
}
