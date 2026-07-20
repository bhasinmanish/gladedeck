// Server-side feature-gating helpers. Reads the `feature_settings` table
// and applies the admin bypass (the admin account can access everything).

import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/features";

export interface GateResult {
  locked: boolean;
  price:  number;
}

type MaybeUser = { email?: string | null } | null | undefined;

// Returns whether a given feature is locked for this user, and its price.
export async function checkFeature(key: string, user: MaybeUser): Promise<GateResult> {
  // Admin bypasses all locks.
  if (user?.email === ADMIN_EMAIL) return { locked: false, price: 0 };

  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_settings")
    .select("is_paid, price")
    .eq("key", key)
    .maybeSingle();

  // No row configured → treat as free (never accidentally lock something).
  if (!data || !data.is_paid) return { locked: false, price: 0 };

  return { locked: true, price: Number(data.price) };
}

// Returns the full settings map plus admin flag — used by the client navbar
// (via /api/features) to badge locked nav items.
export async function getUserFeatureState(user: MaybeUser) {
  const isAdmin = user?.email === ADMIN_EMAIL;
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_settings")
    .select("key, is_paid, price");

  const features: Record<string, { is_paid: boolean; price: number; locked: boolean }> = {};
  (data ?? []).forEach(r => {
    features[r.key] = {
      is_paid: r.is_paid,
      price:   Number(r.price),
      locked:  !isAdmin && r.is_paid,
    };
  });

  return { isAdmin, features };
}
