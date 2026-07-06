"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Strategy } from "@/lib/types";
import { CATEGORIES } from "@/lib/strategy-catalog";

const HORIZONS = [
  { value: "scalp",      label: "Scalp"      },
  { value: "day_trade",  label: "Day Trade"  },
  { value: "swing",      label: "Swing"      },
  { value: "investment", label: "Investment" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (strategy: Strategy) => void;
  initial?: Strategy | null;
}

const EMPTY = {
  name:         "",
  category:     "",
  time_horizon: "day_trade" as Strategy["time_horizon"],
  short_desc:   "",
  definition:   "",
  summary:      "",
  tags:         "",
};

export function CustomStrategyDialog({ open, onClose, onSaved, initial }: Props) {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const isEditing = !!initial;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const rp = initial.risk_params ?? {};
      setForm({
        name:         initial.name,
        category:     (rp.category as string) ?? "",
        time_horizon: initial.time_horizon,
        short_desc:   (rp.short_desc as string) ?? "",
        definition:   initial.description ?? "",
        summary:      (rp.summary as string) ?? "",
        tags:         ((rp.tags as string[]) ?? []).join(", "),
      });
    } else {
      setForm(EMPTY);
    }
    setError("");
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!form.name.trim()) { setError("Strategy name is required."); return; }
    setSaving(true);
    setError("");

    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);

    const payload = {
      name:          form.name.trim(),
      description:   form.definition.trim() || null,
      time_horizon:  form.time_horizon,
      catalyst_type: tags[0] ?? null,
      setup_pattern: null,
      entry_rules:   null,
      exit_rules:    null,
      risk_params: {
        category:   form.category || null,
        summary:    form.summary.trim()   || null,
        short_desc: form.short_desc.trim() || null,
        tags,
      },
    };

    try {
      const url    = isEditing ? `/api/strategies/${initial!.id}` : "/api/strategies";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onSaved(await res.json());
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Strategy" : "Create Your Strategy"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Name */}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={field("name")}
              placeholder="e.g. My EMA Reversal"
            />
          </div>

          {/* Category + Horizon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select
                value={form.category || "none"}
                onValueChange={v => setForm(f => ({ ...f, category: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Time Horizon</Label>
              <Select
                value={form.time_horizon}
                onValueChange={v => setForm(f => ({ ...f, time_horizon: v as Strategy["time_horizon"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Short description */}
          <div className="space-y-1.5">
            <Label>Short Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={form.short_desc}
              onChange={field("short_desc")}
              placeholder="One-liner shown in the strategy list"
            />
          </div>

          {/* Definition */}
          <div className="space-y-1.5">
            <Label>Definition <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={form.definition}
              onChange={field("definition")}
              rows={4}
              placeholder="Full explanation of how and why this strategy works…"
              className="resize-none text-sm"
            />
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label>Summary <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={form.summary}
              onChange={field("summary")}
              rows={2}
              placeholder="2–3 sentence TL;DR of the strategy rules…"
              className="resize-none text-sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags <span className="text-muted-foreground font-normal">(optional — comma separated)</span></Label>
            <Input
              value={form.tags}
              onChange={field("tags")}
              placeholder="e.g. EMA, Trend, Crossover"
            />
          </div>

          {error && <p className="text-xs text-loss">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Strategy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
