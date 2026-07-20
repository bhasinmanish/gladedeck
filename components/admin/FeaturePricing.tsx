"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FeatureRow {
  key:         string;
  name:        string;
  description: string;
  route:       string | null;
  is_paid:     boolean;
  price:       number;
}

function Row({ feature, onChange }: { feature: FeatureRow; onChange: (f: FeatureRow) => void }) {
  const [priceInput, setPriceInput] = useState(feature.price.toFixed(2));
  const [saving, setSaving]         = useState<null | "toggle" | "price">(null);
  const [savedAt, setSavedAt]       = useState(0);

  async function patch(payload: Record<string, unknown>, which: "toggle" | "price") {
    setSaving(which);
    try {
      const res = await fetch("/api/admin/features", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: feature.key, ...payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        onChange({ ...feature, is_paid: updated.is_paid, price: Number(updated.price) });
        setPriceInput(Number(updated.price).toFixed(2));
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(0), 2000);
      }
    } finally {
      setSaving(null);
    }
  }

  function toggle() {
    patch({ is_paid: !feature.is_paid }, "toggle");
  }

  function savePrice() {
    const price = parseFloat(priceInput);
    if (isNaN(price) || price < 0) { setPriceInput(feature.price.toFixed(2)); return; }
    if (price === feature.price) return;
    patch({ price }, "price");
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{feature.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{feature.description}</p>
      </div>

      {/* Price */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">$</span>
        <Input
          value={priceInput}
          onChange={e => setPriceInput(e.target.value)}
          onBlur={savePrice}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          disabled={!feature.is_paid}
          className="h-8 w-20 text-sm font-mono text-right"
          inputMode="decimal"
        />
        {saving === "price" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Paid toggle */}
      <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-md shrink-0 w-[104px]">
        {(["Free", "Paid"] as const).map(label => {
          const active = label === "Paid" ? feature.is_paid : !feature.is_paid;
          return (
            <button
              key={label}
              onClick={() => { if (active) return; toggle(); }}
              disabled={saving === "toggle"}
              className={cn(
                "flex-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                active
                  ? label === "Paid"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Saved indicator */}
      <div className="w-4 shrink-0">
        {savedAt > 0 && <Check className="h-4 w-4 text-emerald-400" />}
      </div>
    </div>
  );
}

export function FeaturePricing() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/admin/features")
      .then(r => r.json())
      .then((data: FeatureRow[]) => setFeatures(data.map(f => ({ ...f, price: Number(f.price) }))))
      .finally(() => setLoading(false));
  }, []);

  function updateRow(updated: FeatureRow) {
    setFeatures(prev => prev.map(f => f.key === updated.key ? updated : f));
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paidCount = features.filter(f => f.is_paid).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Feature Pricing</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Toggle each feature between Free and Paid, and set its price. Changes take effect
          immediately for all non-admin users. Your admin account always has full access.
          {" "}<span className="text-foreground font-medium">{paidCount} of {features.length}</span> features are currently paid.
        </p>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border">
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Feature</span>
            <span className="w-[92px] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-right">Price</span>
            <span className="w-[104px] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center">Access</span>
            <span className="w-4" />
          </div>
          {features.map(f => (
            <Row key={f.key} feature={f} onChange={updateRow} />
          ))}
        </div>
      </div>
    </div>
  );
}
