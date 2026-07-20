import Stripe from "stripe";

// Lazily constructed so importing this module during the build (when
// STRIPE_SECRET_KEY may be absent) doesn't throw. Server-only — never
// import in a client component.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}
