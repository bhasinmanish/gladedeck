import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserFeatureState } from "@/lib/feature-access";

// Returns the current user's feature lock state (admin bypass applied).
// Used by the navbar to badge locked items.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = await getUserFeatureState(user);
  return NextResponse.json(state);
}
