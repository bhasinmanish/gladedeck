"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Trade, Strategy } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (trade: Trade) => void;
  defaultDate?: string;
  strategies?: Pick<Strategy, "id" | "name">[];
  initialTrade?: Trade | null;
}

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM = (defaultDate?: string) => ({
  symbol:      "",
  side:        "long" as "long" | "short",
  trade_type:  "day_trade" as Trade["trade_type"],
  entry_date:  defaultDate ?? today(),
  entry_price: "",
  exit_price:  "",
  qty:         "",
  setup_notes: "",
  strategy_id: "",
});

export function AddTradeDialog({ open, onClose, onSaved, defaultDate, strategies = [], initialTrade }: Props) {
  const [form, setForm]       = useState(EMPTY_FORM(defaultDate));
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const isEditing = !!initialTrade;

  // Populate form when opening in edit mode, reset when opening in add mode
  useEffect(() => {
    if (!open) return;
    if (initialTrade) {
      setForm({
        symbol:      initialTrade.symbol,
        side:        initialTrade.side,
        trade_type:  initialTrade.trade_type,
        entry_date:  initialTrade.entry_date.slice(0, 10),
        entry_price: String(initialTrade.entry_price),
        exit_price:  initialTrade.exit_price != null ? String(initialTrade.exit_price) : "",
        qty:         String(initialTrade.qty),
        setup_notes: initialTrade.setup_notes ?? "",
        strategy_id: initialTrade.strategy_id ?? "",
      });
    } else {
      setForm(EMPTY_FORM(defaultDate));
    }
    setError("");
  }, [open, initialTrade]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  const ep  = parseFloat(form.entry_price);
  const xp  = parseFloat(form.exit_price);
  const qty = parseFloat(form.qty);
  const pnlPreview =
    !isNaN(ep) && !isNaN(xp) && !isNaN(qty)
      ? (form.side === "long" ? xp - ep : ep - xp) * qty
      : null;

  async function submit() {
    if (!form.symbol.trim() || !form.entry_price || !form.qty) {
      setError("Symbol, entry price, and shares are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        symbol:      form.symbol.toUpperCase().trim(),
        side:        form.side,
        trade_type:  form.trade_type,
        entry_date:  form.entry_date,
        entry_price: parseFloat(form.entry_price),
        exit_price:  form.exit_price ? parseFloat(form.exit_price) : null,
        exit_date:   form.exit_price ? form.entry_date : null,
        qty:         parseFloat(form.qty),
        pnl:         pnlPreview,
        setup_notes: form.setup_notes || null,
        strategy_id: form.strategy_id || null,
        account:     "main",
      };

      const url    = isEditing ? `/api/trades/${initialTrade!.id}` : "/api/trades";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onSaved(await res.json() as Trade);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Trade" : "Log a Trade"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {/* Symbol + Side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="AAPL"
                value={form.symbol}
                onChange={e => set("symbol", e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Side</Label>
              <div className="flex rounded-md border border-border overflow-hidden h-9">
                {(["long", "short"] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("side", s)}
                    className={cn(
                      "flex-1 text-sm capitalize transition-colors",
                      form.side === s
                        ? s === "long"
                          ? "bg-profit/20 text-profit font-medium"
                          : "bg-loss/20 text-loss font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Trade Type</Label>
              <Select value={form.trade_type} onValueChange={v => set("trade_type", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scalp">Scalp</SelectItem>
                  <SelectItem value="day_trade">Day Trade</SelectItem>
                  <SelectItem value="swing">Swing</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry_date">Date</Label>
              <Input
                id="entry_date"
                type="date"
                value={form.entry_date}
                onChange={e => set("entry_date", e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Entry / Exit / Qty */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry_price">Entry $</Label>
              <Input
                id="entry_price"
                type="number" step="0.01" min="0" placeholder="0.00"
                value={form.entry_price}
                onChange={e => set("entry_price", e.target.value)}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exit_price">Exit $</Label>
              <Input
                id="exit_price"
                type="number" step="0.01" min="0" placeholder="0.00"
                value={form.exit_price}
                onChange={e => set("exit_price", e.target.value)}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Shares</Label>
              <Input
                id="qty"
                type="number" min="1" placeholder="100"
                value={form.qty}
                onChange={e => set("qty", e.target.value)}
                className="h-9 font-mono"
              />
            </div>
          </div>

          {/* P&L preview */}
          {pnlPreview !== null && (
            <div className={cn(
              "text-sm font-semibold text-center py-1.5 rounded-md",
              pnlPreview >= 0 ? "text-profit bg-profit/10" : "text-loss bg-loss/10"
            )}>
              {isEditing ? "Updated" : "Estimated"} P&L: {pnlPreview >= 0 ? "+" : ""}${pnlPreview.toFixed(2)}
            </div>
          )}

          {/* Strategy */}
          <div className="space-y-1.5">
            <Label>Strategy <span className="text-muted-foreground font-normal">(optional)</span></Label>
            {strategies.length > 0 ? (
              <Select value={form.strategy_id || "none"} onValueChange={v => set("strategy_id", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {strategies.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground py-1.5">
                Apply strategies on the Strategies page to tag them here.
              </p>
            )}
          </div>

          {/* Setup notes */}
          <div className="space-y-1.5">
            <Label htmlFor="setup_notes">
              Setup Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="setup_notes"
              placeholder="What was your thesis for this trade?"
              value={form.setup_notes}
              onChange={e => set("setup_notes", e.target.value)}
              className="h-20 resize-none text-sm"
            />
          </div>

          {error && <p className="text-xs text-loss">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Saving…" : isEditing ? "Save Changes" : "Log Trade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
