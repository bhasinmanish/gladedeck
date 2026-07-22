import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return <FeatureLocked name="Portfolio" price={gate.price} featureKey="broker_sync" />;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-auto">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Your Schwab holdings and value over time
        </p>
      </div>
      <PortfolioPanel />
    </div>
  );
}
