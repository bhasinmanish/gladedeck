// Server-side feature-gating helpers. Reads the `feature_settings` and
// `feature_subscriptions` tables and applies the admin bypass.

import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL, BUNDLE_KEY } from "@/lib/features";

export interface GateResult {
  locked: boolean;
  price:  number;
}

type MaybeUser = { id?: string; email?: string | null } | null | undefined;

// Statuses that count as an active, access-granting subscription.
const ACTIVE_STATUSES = ["active", "trialing"];

// Returns whether a given feature is locked for this user, and its price.
export async function checkFeature(key: string, user: MaybeUser): Promise<GateResult> {
  // Admin bypasses all locks.
  if (user?.email === ADMIN_EMAIL) return { locked: false, price: 0 };

  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("feature_settings")
    .select("is_paid, price")
    .eq("key", key)
    .maybeSingle();

  // No row configured, or free → unlocked.
  if (!setting || !setting.is_paid) return { locked: false, price: 0 };

  const price = Number(setting.price);

  // Paid → unlocked if the user holds an active subscription for this
  // feature specifically, OR the all-access bundle.
  if (user?.id) {
    const { data: subs } = await supabase
      .from("feature_subscriptions")
      .select("feature_key")
      .eq("user_id", user.id)
      .in("feature_key", [key, BUNDLE_KEY])
      .in("status", ACTIVE_STATUSES);
    if (subs && subs.length > 0) return { locked: false, price };
  }

  return { locked: true, price };
}

// Full settings map + admin flag + which features the user is subscribed to.
// Used by the client navbar (via /api/features) to badge locked items.
export async function getUserFeatureState(user: MaybeUser) {
  const isAdmin = user?.email === ADMIN_EMAIL;
  const supabase = await createClient();

  const [{ data: settings }, subsRes] = await Promise.all([
    supabase.from("feature_settings").select("key, is_paid, price"),
    user?.id
      ? supabase
          .from("feature_subscriptions")
          .select("feature_key")
          .eq("user_id", user.id)
          .in("status", ACTIVE_STATUSES)
      : Promise.resolve({ data: [] as { feature_key: string }[] }),
  ]);

  const subscribed = new Set((subsRes.data ?? []).map(s => s.feature_key));
  const hasBundle  = subscribed.has(BUNDLE_KEY);

  const features: Record<string, { is_paid: boolean; price: number; locked: boolean; subscribed: boolean }> = {};
  (settings ?? []).forEach(r => {
    const isSub = subscribed.has(r.key) || (r.key !== BUNDLE_KEY && hasBundle);
    features[r.key] = {
      is_paid:    r.is_paid,
      price:      Number(r.price),
      subscribed: isSub,
      locked:     !isAdmin && r.is_paid && !isSub,
    };
  });

  return { isAdmin, features };
}
