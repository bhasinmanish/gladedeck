import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ADMIN_EMAIL } from "@/lib/supabase/admin";
import { FEATURES, DEFAULT_FEATURE_PRICE } from "@/lib/features";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

// GET — returns every catalog feature merged with its DB pricing settings.
// Seeds any missing feature rows with defaults so the catalog stays in sync.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();

  // Ensure a row exists for every catalog feature.
  const seed = FEATURES.map(f => ({
    key:     f.key,
    is_paid: true,
    price:   DEFAULT_FEATURE_PRICE,
  }));
  await db.from("feature_settings").upsert(seed, { onConflict: "key", ignoreDuplicates: true });

  const { data, error } = await db.from("feature_settings").select("key, is_paid, price");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byKey = new Map((data ?? []).map(r => [r.key, r]));

  const merged = FEATURES.map(f => {
    const row = byKey.get(f.key);
    return {
      key:         f.key,
      name:        f.name,
      description: f.description,
      route:       f.route ?? null,
      is_paid:     row?.is_paid ?? true,
      price:       Number(row?.price ?? DEFAULT_FEATURE_PRICE),
    };
  });

  return NextResponse.json(merged);
}

// PATCH — update a single feature's is_paid and/or price.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { key } = body;
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.is_paid === "boolean") patch.is_paid = body.is_paid;
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (isNaN(price) || price < 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    patch.price = price;
  }

  const db = createAdminClient();

  // Ensure the row exists (defaults), then apply only the provided fields.
  await db
    .from("feature_settings")
    .upsert({ key, is_paid: true, price: DEFAULT_FEATURE_PRICE }, { onConflict: "key", ignoreDuplicates: true });

  const { data, error } = await db
    .from("feature_settings")
    .update(patch)
    .eq("key", key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
