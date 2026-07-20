import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// current_period_end lives at different places across Stripe API versions.
function periodEndISO(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// Upsert a subscription row keyed by (user_id, feature_key).
async function upsertSubscription(sub: Stripe.Subscription, statusOverride?: string) {
  const userId     = sub.metadata?.user_id;
  const featureKey = sub.metadata?.feature_key;
  if (!userId || !featureKey) {
    console.warn("[stripe webhook] subscription missing metadata", sub.id);
    return;
  }

  const db = createAdminClient();
  await db.from("feature_subscriptions").upsert(
    {
      user_id:                userId,
      feature_key:            featureKey,
      stripe_subscription_id: sub.id,
      stripe_customer_id:     typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      status:                 statusOverride ?? sub.status,
      current_period_end:     periodEndISO(sub),
      updated_at:             new Date().toISOString(),
    },
    { onConflict: "user_id,feature_key" },
  );
}

export async function POST(request: NextRequest) {
  const body      = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret    = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe webhook] signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Ensure metadata is present (carry from the session if needed).
          if (!sub.metadata?.user_id && session.metadata) {
            sub.metadata = { ...sub.metadata, ...session.metadata };
          }
          await upsertSubscription(sub);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object as Stripe.Subscription, "canceled");
        break;
      }

      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[stripe webhook] handler error for ${event.type}:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
