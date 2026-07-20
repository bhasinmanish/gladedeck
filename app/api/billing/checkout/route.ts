import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { featureByKey, ADMIN_EMAIL } from "@/lib/features";

export const runtime = "nodejs";

function appOrigin(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "gladedeck.com";
  return `https://${host}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: "Admin already has full access." }, { status: 400 });
  }

  const { feature_key } = await request.json();
  const feature = featureByKey(feature_key);
  if (!feature) return NextResponse.json({ error: "Unknown feature" }, { status: 400 });

  // Look up current price / paid state.
  const { data: setting } = await supabase
    .from("feature_settings")
    .select("is_paid, price")
    .eq("key", feature_key)
    .maybeSingle();

  if (!setting || !setting.is_paid) {
    return NextResponse.json({ error: "This feature is free." }, { status: 400 });
  }

  const price = Number(setting.price);
  const unitAmount = Math.round(price * 100);
  if (unitAmount < 50) {
    return NextResponse.json(
      { error: "Price must be at least $0.50 to accept card payments." },
      { status: 400 },
    );
  }

  // Already subscribed?
  const { data: existing } = await supabase
    .from("feature_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .eq("feature_key", feature_key)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "You already have this subscription." }, { status: 400 });
  }

  try {
    const stripe = getStripe();

    // Get or create the Stripe customer for this user.
    const { data: mapping } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = mapping?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("billing_customers").upsert(
        { user_id: user.id, stripe_customer_id: customerId },
        { onConflict: "user_id" },
      );
    }

    const origin      = appOrigin(request);
    const returnRoute = feature.route ?? "/dashboard";

    const session = await stripe.checkout.sessions.create({
      mode:     "subscription",
      customer: customerId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency:   "usd",
          unit_amount: unitAmount,
          recurring:  { interval: "month" },
          product_data: { name: `Glade Deck — ${feature.name}` },
        },
      }],
      metadata:          { user_id: user.id, feature_key },
      subscription_data: { metadata: { user_id: user.id, feature_key } },
      success_url: `${origin}${returnRoute}?sub=success`,
      cancel_url:  `${origin}${returnRoute}?sub=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[billing/checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
