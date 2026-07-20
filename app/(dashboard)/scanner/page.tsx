import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { ScannerWorkspace } from "@/components/scanner/ScannerWorkspace";

export default async function ScannerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("scanner", user);
  if (gate.locked) return <FeatureLocked name="Market Scanner" price={gate.price} featureKey="scanner" />;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Build custom filter presets — double-click a tab name to rename it
        </p>
      </div>
      <ScannerWorkspace />
    </div>
  );
}
