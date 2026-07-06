"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";
import { Plus, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade, DailySummary } from "@/lib/types";

interface Props {
  initialTrades:  Trade[];
  initialSummary: DailySummary | null;
  userId:         string;
  date:           string;
}

interface Reflection {
  setup_notes:    string;
  what_went_well: string;
  what_went_wrong: string;
  what_to_change:  string;
}

// ─── Per-trade reflection card ────────────────────────────────────────────────

function TradeReflectionCard({
  trade,
  reflection,
  onChange,
}: {
  trade:      Trade;
  reflection: Reflection;
  onChange:   (patch: Partial<Reflection>) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const pnl = trade.pnl;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-primary">{trade.symbol}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              trade.side === "long" ? "text-profit border-profit/30" : "text-loss border-loss/30"
            )}
          >
            {trade.side}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {trade.entry_price.toFixed(2)}
            {trade.exit_price != null && ` → ${trade.exit_price.toFixed(2)}`}
            {" · "}{trade.qty.toLocaleString()} sh
          </span>
        </div>
        <div className="flex items-center gap-3">
          {pnl != null && (
            <span className={cn(
              "font-mono font-semibold text-sm",
              pnl >= 0 ? "text-profit" : "text-loss"
            )}>
              {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Reflection fields */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <ReflectionField
            label="What was your thesis / setup?"
            placeholder="Why did you take this trade? What pattern or catalyst were you playing?"
            value={reflection.setup_notes}
            onChange={v => onChange({ setup_notes: v })}
          />
          <ReflectionField
            label="What went well?"
            placeholder="Did you execute your plan? Good entry timing? Proper size?"
            value={reflection.what_went_well}
            onChange={v => onChange({ what_went_well: v })}
          />
          <ReflectionField
            label="What went wrong?"
            placeholder="Did you deviate from your plan? Exit too early or too late?"
            value={reflection.what_went_wrong}
            onChange={v => onChange({ what_went_wrong: v })}
          />
          <ReflectionField
            label="What would you change next time?"
            placeholder="One concrete thing to do differently on the next similar setup."
            value={reflection.what_to_change}
            onChange={v => onChange({ what_to_change: v })}
          />
        </div>
      )}
    </div>
  );
}

function ReflectionField({
  label, placeholder, value, onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="resize-none h-16 text-sm bg-muted/30 border-muted focus:border-primary/50"
      />
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export function DailyReviewWorkspace({ initialTrades, initialSummary, userId, date }: Props) {
  const [trades, setTrades]       = useState<Trade[]>(initialTrades);
  const [reflections, setRef]     = useState<Record<string, Reflection>>(() =>
    Object.fromEntries(
      initialTrades.map(t => [t.id, {
        setup_notes:     t.setup_notes     ?? "",
        what_went_well:  t.what_went_well  ?? "",
        what_went_wrong: t.what_went_wrong ?? "",
        what_to_change:  t.what_to_change  ?? "",
      }])
    )
  );
  const [daySummary, setDaySummary] = useState(initialSummary?.summary_text ?? "");
  const [saving,  setSaving]        = useState(false);
  const [saved,   setSaved]         = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const closedTrades = trades.filter(t => t.pnl !== null);
  const totalPnl     = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins         = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAdded(trade: Trade) {
    setTrades(prev => [...prev, trade]);
    setRef(prev => ({
      ...prev,
      [trade.id]: { setup_notes: trade.setup_notes ?? "", what_went_well: "", what_went_wrong: "", what_to_change: "" },
    }));
  }

  function patchReflection(id: string, patch: Partial<Reflection>) {
    setRef(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function saveReview() {
    setSaving(true);
    setSaved(false);
    try {
      // Save per-trade reflections
      await Promise.all(
        trades.map(t =>
          fetch(`/api/trades/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reflections[t.id] ?? {}),
          })
        )
      );

      // Save daily summary
      await fetch("/api/daily-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          pnl:          totalPnl,
          trades_count: trades.length,
          summary_text: daySummary || null,
        }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Day summary bar */}
      <div className="flex items-center gap-4 shrink-0">
        <div className={cn(
          "flex-1 rounded-lg border px-4 py-2.5 flex items-center gap-4",
          totalPnl >= 0 ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5"
        )}>
          <div>
            <p className="text-xs text-muted-foreground">Day P&L</p>
            <p className={cn("text-xl font-bold font-mono", totalPnl >= 0 ? "text-profit" : "text-loss")}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">Trades</p>
            <p className="text-xl font-bold">{trades.length}</p>
          </div>
          {closedTrades.length > 0 && (
            <>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className={cn("text-xl font-bold", wins / closedTrades.length >= 0.5 ? "text-profit" : "text-loss")}>
                  {((wins / closedTrades.length) * 100).toFixed(0)}%
                </p>
              </div>
            </>
          )}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} variant="outline" className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Trade
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-0.5">
        {/* Trade cards */}
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <p className="text-sm">No trades logged for today.</p>
            <p className="text-xs text-center max-w-sm">
              Click &ldquo;Add Trade&rdquo; above to log a trade, or visit the{" "}
              <Link href="/trade-log" className="text-primary hover:underline">Trade Log</Link>.
            </p>
          </div>
        ) : (
          trades.map(t => (
            <TradeReflectionCard
              key={t.id}
              trade={t}
              reflection={reflections[t.id] ?? { setup_notes: "", what_went_well: "", what_went_wrong: "", what_to_change: "" }}
              onChange={patch => patchReflection(t.id, patch)}
            />
          ))
        )}

        {/* Day-level summary */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Day Summary</p>
          <p className="text-xs text-muted-foreground">Big picture — how did the day go mentally and emotionally?</p>
          <Textarea
            placeholder="Overall notes for today: market conditions, your mindset, recurring mistakes, things to work on…"
            value={daySummary}
            onChange={e => setDaySummary(e.target.value)}
            className="resize-none h-28 text-sm bg-muted/30 border-muted focus:border-primary/50"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pb-4">
          <Button onClick={saveReview} disabled={saving || trades.length === 0} className="gap-2 min-w-32">
            {saved
              ? <><Check className="h-4 w-4" /> Saved</>
              : saving
              ? "Saving…"
              : "Save Review"
            }
          </Button>
        </div>
      </div>

      <AddTradeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleAdded}
        defaultDate={date}
      />
    </div>
  );
}
