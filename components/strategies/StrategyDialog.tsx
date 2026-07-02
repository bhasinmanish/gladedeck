"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Strategy } from "@/lib/types";

const HORIZONS = [
  { value: "scalp",      label: "Scalp"       },
  { value: "day_trade",  label: "Day Trade"   },
  { value: "swing",      label: "Swing"       },
  { value: "investment", label: "Investment"  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (s: Strategy) => void;
  initial?: Strategy | null;
}

const EMPTY = {
  name:               "",
  description:        "",
  time_horizon:       "day_trade" as Strategy["time_horizon"],
  catalyst_type:      "",
  setup_pattern:      "",
  entry_rules:        "",
  exit_rules:         "",
  max_risk_per_trade: "",
  max_position_size:  "",
};

export function StrategyDialog({ open, onClose, onSaved, initial }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            name:               initial.name,
            description:        initial.description ?? "",
            time_horizon:       initial.time_horizon,
            catalyst_type:      initial.catalyst_type ?? "",
            setup_pattern:      initial.setup_pattern ?? "",
            entry_rules:        initial.entry_rules ?? "",
            exit_rules:         initial.exit_rules ?? "",
            max_risk_per_trade: String(initial.risk_params?.max_risk_per_trade ?? ""),
            max_position_size:  String(initial.risk_params?.max_position_size ?? ""),
          }
        : EMPTY
    );
  }, [open, initial]);

  function field(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim(),
      time_horizon:  form.time_horizon,
      catalyst_type: form.catalyst_type.trim() || null,
      setup_pattern: form.setup_pattern.trim() || null,
      entry_rules:   form.entry_rules.trim()   || null,
      exit_rules:    form.exit_rules.trim()    || null,
      risk_params: {
        ...(form.max_risk_per_trade ? { max_risk_per_trade: Number(form.max_risk_per_trade) } : {}),
        ...(form.max_position_size  ? { max_position_size:  Number(form.max_position_size)  } : {}),
      },
    };
    try {
      const url    = initial ? `/api/strategies/${initial.id}` : "/api/strategies";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved(await res.json());
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Strategy" : "New Strategy"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + Horizon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={field("name")} placeholder="e.g. Earnings Gap &amp; Go" />
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
            <div className="space-y-1.5">
              <Label>Catalyst Type</Label>
              <Input value={form.catalyst_type} onChange={field("catalyst_type")} placeholder="e.g. Earnings Surprise" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={field("description")}
              rows={2}
              placeholder="Brief overview of this strategy"
              className="resize-none"
            />
          </div>

          {/* Setup pattern */}
          <div className="space-y-1.5">
            <Label>Setup Pattern</Label>
            <Textarea
              value={form.setup_pattern}
              onChange={field("setup_pattern")}
              rows={2}
              placeholder="e.g. Bull flag on 5-min, above VWAP, high of day within 5%"
              className="resize-none"
            />
          </div>

          {/* Entry / Exit rules */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Entry Rules</Label>
              <Textarea
                value={form.entry_rules}
                onChange={field("entry_rules")}
                rows={3}
                placeholder="When to get in..."
                className="resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Exit Rules</Label>
              <Textarea
                value={form.exit_rules}
                onChange={field("exit_rules")}
                rows={3}
                placeholder="When to get out..."
                className="resize-none"
              />
            </div>
          </div>

          {/* Risk params */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max Risk / Trade ($)</Label>
              <Input
                type="number"
                value={form.max_risk_per_trade}
                onChange={field("max_risk_per_trade")}
                placeholder="500"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Position Size ($)</Label>
              <Input
                type="number"
                value={form.max_position_size}
                onChange={field("max_position_size")}
                placeholder="10000"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Strategy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
