"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";
import { Plus, Trash2, Pencil, Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade, Strategy } from "@/lib/types";

interface Props {
  trades: Trade[];
  strategies: Pick<Strategy, "id" | "name">[];
}

const TYPE_LABELS: Record<string, string> = {
  scalp:      "Scalp",
  day_trade:  "Day",
  swing:      "Swing",
  investment: "Invest",
};

type SortKey = "symbol" | "side" | "type" | "date" | "entry" | "exit" | "shares" | "pnl";
type SortDir = "asc" | "desc";

// Value used to sort each column. Returns null for empty cells (sorted last).
function sortValue(t: Trade, key: SortKey): string | number | null {
  switch (key) {
    case "symbol": return t.symbol;
    case "side":   return t.side;
    case "type":   return t.trade_type;
    case "date":   return t.entry_date.slice(0, 10);
    case "entry":  return t.entry_price;
    case "exit":   return t.exit_price;
    case "shares": return t.qty;
    case "pnl":    return t.pnl;
  }
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5 font-mono", color)}>{value}</p>
    </div>
  );
}

export function TradeTable({ trades: initial, strategies }: Props) {
  const [trades, setTrades] = useState<Trade[]>(initial);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  // ── Filters & sorting ───────────────────────────────────────────────────────

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [sideFilter, setSideFilter]     = useState<"all" | "long" | "short">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "schwab" | "manual">("all");
  const [query, setQuery]               = useState("");
  const [sort, setSort]                 = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" || key === "pnl" ? "desc" : "asc" }
    );
  }

  const hasFilters = statusFilter !== "all" || sideFilter !== "all" || sourceFilter !== "all" || query.trim() !== "";

  function clearFilters() {
    setStatusFilter("all");
    setSideFilter("all");
    setSourceFilter("all");
    setQuery("");
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = trades.filter(t => {
      if (statusFilter === "open"   && t.exit_price != null) return false;
      if (statusFilter === "closed" && t.exit_price == null) return false;
      if (sideFilter   !== "all" && t.side   !== sideFilter)   return false;
      if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
      if (q && !t.symbol.toLowerCase().includes(q)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;   // nulls always last
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [trades, statusFilter, sideFilter, sourceFilter, query, sort]);

  // ── Stats (across all trades) ───────────────────────────────────────────────

  const closed = trades.filter(t => t.pnl !== null);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins  = closed.filter(t => (t.pnl ?? 0) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin  = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const losses  = closed.filter(t => (t.pnl ?? 0) < 0);
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleSaved(trade: Trade) {
    setTrades(prev => {
      const i = prev.findIndex(t => t.id === trade.id);
      if (i >= 0) { const next = [...prev]; next[i] = trade; return next; }
      return [trade, ...prev];
    });
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

  // ── Sortable header cell ────────────────────────────────────────────────────

  function SortHead({ label, k, align }: { label: string; k: SortKey; align?: "right" }) {
    const active = sort.key === k;
    return (
      <TableHead className={align === "right" ? "text-right" : undefined}>
        <button
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors select-none",
            align === "right" && "flex-row-reverse",
            active ? "text-foreground font-semibold" : "text-muted-foreground"
          )}
        >
          {label}
          {active
            ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </TableHead>
    );
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

      {/* Toolbar: filters + Log Trade */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="h-8 pl-8 w-32 text-xs font-mono"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sideFilter} onValueChange={v => setSideFilter(v as typeof sideFilter)}>
          <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sides</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as typeof sourceFilter)}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="schwab">Schwab</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {hasFilters ? `${visible.length} of ${trades.length}` : `${trades.length} trade${trades.length !== 1 ? "s" : ""}`}
          </p>
          <Button size="sm" onClick={() => { setEditingTrade(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Log Trade
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border flex-1 min-h-0 overflow-auto">
        <div className="overflow-x-auto min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Symbol" k="symbol" />
              <SortHead label="Side"   k="side" />
              <SortHead label="Type"   k="type" />
              <SortHead label="Date"   k="date" />
              <SortHead label="Entry"  k="entry"  align="right" />
              <SortHead label="Exit"   k="exit"   align="right" />
              <SortHead label="Shares" k="shares" align="right" />
              <SortHead label="P&L"    k="pnl"    align="right" />
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
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                  No trades match your filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map(t => (
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
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(t.entry_date.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingTrade(t); setDialogOpen(true); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit trade"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTrade(t.id)}
                        disabled={deletingId === t.id}
                        className="text-muted-foreground hover:text-loss transition-colors disabled:opacity-40"
                        title="Delete trade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
        onClose={() => { setDialogOpen(false); setEditingTrade(null); }}
        onSaved={handleSaved}
        strategies={strategies}
        initialTrade={editingTrade}
      />
    </div>
  );
}
