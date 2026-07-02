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
import type { Strategy, TradeIdea } from "@/lib/types";

const HORIZONS = [
  { value: "scalp",      label: "Scalp"      },
  { value: "day_trade",  label: "Day Trade"  },
  { value: "swing",      label: "Swing"      },
  { value: "investment", label: "Investment" },
];

const STATUSES = [
  { value: "watching", label: "Watching" },
  { value: "active",   label: "Active"   },
  { value: "closed",   label: "Closed"   },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (idea: TradeIdea) => void;
  strategies: Strategy[];
  initial?: TradeIdea | null;
}

const EMPTY = {
  symbol:       "",
  thesis:       "",
  time_horizon: "day_trade" as TradeIdea["time_horizon"],
  catalyst:     "",
  status:       "watching" as TradeIdea["status"],
  strategy_id:  "",
};

export function IdeaDialog({ open, onClose, onSaved, strategies, initial }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            symbol:       initial.symbol,
            thesis:       initial.thesis,
            time_horizon: initial.time_horizon,
            catalyst:     initial.catalyst ?? "",
            status:       initial.status,
            strategy_id:  initial.strategy_id ?? "",
          }
        : EMPTY
    );
  }, [open, initial]);

  async function save() {
    if (!form.symbol.trim() || !form.thesis.trim()) return;
    setSaving(true);
    const payload = {
      symbol:       form.symbol.trim().toUpperCase(),
      thesis:       form.thesis.trim(),
      time_horizon: form.time_horizon,
      catalyst:     form.catalyst.trim() || null,
      status:       form.status,
      strategy_id:  form.strategy_id || null,
    };
    try {
      const url    = initial ? `/api/trade-ideas/${initial.id}` : "/api/trade-ideas";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Idea" : "New Trade Idea"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Symbol *</Label>
              <Input
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={v => setForm(f => ({ ...f, status: v as TradeIdea["status"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Thesis *</Label>
            <Textarea
              value={form.thesis}
              onChange={e => setForm(f => ({ ...f, thesis: e.target.value }))}
              rows={3}
              placeholder="Why are you watching this setup?"
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Time Horizon</Label>
              <Select
                value={form.time_horizon}
                onValueChange={v => setForm(f => ({ ...f, time_horizon: v as TradeIdea["time_horizon"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Catalyst</Label>
              <Input
                value={form.catalyst}
                onChange={e => setForm(f => ({ ...f, catalyst: e.target.value }))}
                placeholder="e.g. Earnings"
              />
            </div>
          </div>

          {strategies.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to Strategy</Label>
              <Select
                value={form.strategy_id || "none"}
                onValueChange={v => setForm(f => ({ ...f, strategy_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {strategies.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={save}
            disabled={saving || !form.symbol.trim() || !form.thesis.trim()}
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Idea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
