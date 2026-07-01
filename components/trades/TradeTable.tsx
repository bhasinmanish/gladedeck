"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/lib/types";

interface Props {
  trades: Trade[];
}

const TYPE_LABELS: Record<string, string> = {
  scalp:      "Scalp",
  day_trade:  "Day",
  swing:      "Swing",
  investment: "Invest",
};

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5 font-mono", color)}>{value}</p>
    </div>
  );
}

export function TradeTable({ trades: initial }: Props) {
  const [trades, setTrades] = useState<Trade[]>(initial);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const closed = trades.filter(t => t.pnl !== null);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins  = closed.filter(t => (t.pnl ?? 0) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin  = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const losses  = closed.filter(t => (t.pnl ?? 0) < 0);
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleAdded(trade: Trade) {
    setTrades(prev => [trade, ...prev]);
  }

  async function deleteTrade(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (res.ok) setTrades(prev => prev.filter(t => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <StatCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
          color={totalPnl >= 0 ? "text-profit" : "text-loss"}
        />
        <StatCard label="Trades" value={String(trades.length)} />
        <StatCard
          label="Win Rate"
          value={closed.length > 0 ? `${winRate.toFixed(0)}%` : "—"}
          color={winRate >= 50 ? "text-profit" : winRate > 0 ? "text-loss" : undefined}
        />
        <StatCard
          label="Avg Win / Avg Loss"
          value={
            avgWin > 0 && avgLoss < 0
              ? `$${avgWin.toFixed(0)} / $${Math.abs(avgLoss).toFixed(0)}`
              : "—"
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm text-muted-foreground">{trades.length} trade{trades.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Log Trade
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border flex-1 min-h-0 overflow-auto">
        <div className="overflow-x-auto min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                  No trades yet. Click &ldquo;Log Trade&rdquo; to add your first one.
                </TableCell>
              </TableRow>
            ) : (
              trades.map(t => (
                <TableRow key={t.id} className="hover:bg-muted/20">
                  <TableCell>
                    <Link href={`/stocks/${t.symbol}`} className="font-bold text-primary hover:underline">
                      {t.symbol}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        t.side === "long" ? "text-profit border-profit/30" : "text-loss border-loss/30"
                      )}
                    >
                      {t.side}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[t.trade_type] ?? t.trade_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.entry_date}</TableCell>
                  <TableCell className="text-right font-mono text-sm">${t.entry_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : <span className="text-muted-foreground">Open</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{t.qty.toLocaleString()}</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono text-sm font-medium",
                    t.pnl == null ? "text-muted-foreground" : t.pnl >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {t.pnl == null
                      ? "—"
                      : `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`
                    }
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => deleteTrade(t.id)}
                      disabled={deletingId === t.id}
                      className="text-muted-foreground hover:text-loss transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <AddTradeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  );
}
