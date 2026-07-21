import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { OrdersWorkspace } from "@/components/orders/OrdersWorkspace";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("broker_sync", user);
  if (gate.locked) return <FeatureLocked name="Orders" price={gate.price} featureKey="broker_sync" />;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          All Schwab orders from the last 60 days — filled, working, canceled and more
        </p>
      </div>
      <OrdersWorkspace />
    </div>
  );
}
