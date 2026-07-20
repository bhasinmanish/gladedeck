import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

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

  const { data: mapping } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mapping?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer:    mapping.stripe_customer_id,
      return_url:  `${appOrigin(request)}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[billing/portal]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
