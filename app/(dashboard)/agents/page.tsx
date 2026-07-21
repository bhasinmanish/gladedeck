import { createClient } from "@/lib/supabase/server";
import { checkFeature } from "@/lib/feature-access";
import { FeatureLocked } from "@/components/FeatureLocked";
import { AgentsPage } from "@/components/agents/AgentsPage";
import type { Agent, AgentAlert } from "@/lib/types";

export default async function AgentsRoute() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const gate = await checkFeature("agents", user);
  if (gate.locked) return <FeatureLocked name="AI Agents" price={gate.price} featureKey="agents" />;

  const [{ data: agents }, { data: alerts }] = await Promise.all([
    supabase
      .from("agents")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agent_alerts")
      .select("*, agents(name)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <AgentsPage
      initialAgents={(agents as Agent[]) ?? []}
      initialAlerts={(alerts as (AgentAlert & { agents?: { name: string } | null })[]) ?? []}
    />
  );
}
