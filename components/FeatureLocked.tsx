"use client";

import { useState, useEffect } from "react";
import { Lock, Loader2 } from "lucide-react";

interface Props {
  name:       string;
  price:      number;
  featureKey: string;
}

// Shown in place of a gated feature's content when the current user
// isn't subscribed. Starts a Stripe Checkout subscription session.
export function FeatureLocked({ name, price, featureKey }: Props) {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Just came back from a successful checkout — the webhook may still be
  // processing, so wait a moment and reload to pick up the new access.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sub") === "success") {
      setFinalizing(true);
      const t = setTimeout(() => window.location.reload(), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feature_key: featureKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
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
            Subscribe to unlock {name} and keep access as long as your
            subscription is active.
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
          <button
            onClick={subscribe}
            disabled={loading}
            className="w-full rounded-md bg-primary text-primary-foreground text-sm font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
              : `Subscribe for $${price.toFixed(2)}/mo`}
          </button>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
