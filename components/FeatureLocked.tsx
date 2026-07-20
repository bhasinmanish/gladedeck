"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2, Sparkles } from "lucide-react";

interface Props {
  name:       string;
  price:      number;
  featureKey: string;
}

// Shown in place of a gated feature's content when the current user
// isn't subscribed. Offers either a single-feature subscription or the
// all-access bundle, both via Stripe Checkout.
export function FeatureLocked({ name, price, featureKey }: Props) {
  const [loading, setLoading]         = useState<null | "feature" | "bundle">(null);
  const [error, setError]             = useState<string | null>(null);
  const [finalizing, setFinalizing]   = useState(false);
  const [bundlePrice, setBundlePrice] = useState<number | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sub") === "success") {
      // Strip the flag first so a delayed webhook can't cause a reload loop.
      url.searchParams.delete("sub");
      window.history.replaceState({}, "", url.toString());
      setFinalizing(true);
      const t = setTimeout(() => window.location.reload(), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    fetch("/api/features")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const b = data?.features?.all_access;
        if (b?.is_paid) setBundlePrice(b.price);
      })
      .catch(() => {});
  }, []);

  async function subscribe(key: string, which: "feature" | "bundle") {
    setLoading(which);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feature_key: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(null);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5 border border-border rounded-xl p-8 bg-card shadow-sm">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>

        <div>
          <h2 className="text-lg font-bold">{name} is a premium feature</h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Subscribe to unlock {name}, or get the all-access bundle to unlock
            every premium feature.
          </p>
        </div>

        <div className="text-4xl font-bold font-mono">
          ${price.toFixed(2)}
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </div>

        {finalizing ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2.5">
            <Loader2 className="h-4 w-4 animate-spin" /> Finalizing your subscription…
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => subscribe(featureKey, "feature")}
              disabled={loading !== null}
              className="w-full rounded-md bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading === "feature"
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                : `Subscribe to ${name} · $${price.toFixed(2)}/mo`}
            </button>

            {bundlePrice !== null && (
              <button
                onClick={() => subscribe("all_access", "bundle")}
                disabled={loading !== null}
                className="w-full rounded-md border border-primary/40 text-foreground text-sm font-medium py-2.5 hover:bg-primary/5 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading === "bundle"
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                  : <><Sparkles className="h-4 w-4 text-primary" /> Unlock everything · ${bundlePrice.toFixed(2)}/mo</>}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
