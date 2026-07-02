"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade, Strategy } from "@/lib/types";

// ── Types & constants ─────────────────────────────────────────────────────────

type DateRange = "week" | "month" | "quarter" | "year" | "all";
type TradeType = "all" | "scalp" | "day_trade" | "swing" | "investment";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "week",    label: "This Week"    },
  { value: "month",   label: "This Month"   },
  { value: "quarter", label: "This Quarter" },
  { value: "year",    label: "This Year"    },
  { value: "all",     label: "All Time"     },
];

const TRADE_TYPES: { value: TradeType; label: string }[] = [
  { value: "all",        label: "All"        },
  { value: "scalp",      label: "Scalp"      },
  { value: "day_trade",  label: "Day Trade"  },
  { value: "swing",      label: "Swing"      },
  { value: "investment", label: "Investment" },
];

function rangeBounds(range: DateRange): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") {
    start.setDate(now.getDate() - now.getDay());
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "quarter") {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(0);
  }
  return { start, end };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5 font-mono leading-tight", color ?? "text-foreground")}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── P&L Calendar ─────────────────────────────────────────────────────────────

function PnlCalendar({ trades }: { trades: Trade[] }) {
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const pnlByDay = useMemo(() => {
    const map: Record<string, number> = {};
    trades.forEach(t => {
      if (t.pnl === null) return;
      map[t.entry_date] = (map[t.entry_date] ?? 0) + t.pnl;
    });
    return map;
  }, [trades]);

  function navigate(delta: number) {
    setView(v => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const { year, month } = view;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const todayStr     = new Date().toISOString().split("T")[0];
  const monthLabel   = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm">{monthLabel}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-[10px] text-muted-foreground text-center py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const pnl     = pnlByDay[dateStr];
          const isToday = dateStr === todayStr;
          const hasData = pnl !== undefined;

          return (
            <div
              key={dateStr}
              className={cn(
                "rounded p-1 min-h-[42px] flex flex-col items-center pt-1",
                isToday && "ring-1 ring-primary/60",
                hasData
                  ? pnl >= 0 ? "bg-profit/10" : "bg-loss/10"
                  : "hover:bg-muted/20"
              )}
            >
              <span className="text-[10px] text-muted-foreground leading-none">{day}</span>
              {hasData && (
                <span className={cn(
                  "text-[9px] font-mono font-semibold mt-1 leading-none",
                  pnl >= 0 ? "text-profit" : "text-loss"
                )}>
                  {pnl >= 0 ? "+" : "-"}
                  ${Math.abs(pnl) >= 1000
                    ? `${(Math.abs(pnl) / 1000).toFixed(1)}k`
                    : Math.abs(pnl).toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main reports page ─────────────────────────────────────────────────────────

interface Props {
  trades: Trade[];
  strategies: Strategy[];
}

export function ReportsPage({ trades: allTrades, strategies }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [tradeType, setTradeType] = useState<TradeType>("all");

  // Filtered closed trades
  const trades = useMemo(() => {
    let t = allTrades.filter(x => x.pnl !== null);
    if (tradeType !== "all") t = t.filter(x => x.trade_type === tradeType);
    if (dateRange !== "all") {
      const { start, end } = rangeBounds(dateRange);
      t = t.filter(x => {
        const d = new Date(x.entry_date);
        return d >= start && d <= end;
      });
    }
    return t;
  }, [allTrades, dateRange, tradeType]);

  // Aggregate stats
  const stats = useMemo(() => {
    const wins   = trades.filter(t => (t.pnl ?? 0) > 0);
    const losses = trades.filter(t => (t.pnl ?? 0) < 0);
    const gross  = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const lost   = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const best   = trades.reduce<Trade | null>((b, t) =>
      (t.pnl ?? -Infinity) > (b?.pnl ?? -Infinity) ? t : b, null);
    const worst  = trades.reduce<Trade | null>((w, t) =>
      (t.pnl ?? Infinity) < (w?.pnl ?? Infinity) ? t : w, null);
    return {
      total:        trades.reduce((s, t) => s + (t.pnl ?? 0), 0),
      count:        trades.length,
      winRate:      trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      winsCount:    wins.length,
      lossCount:    losses.length,
      avgWin:       wins.length    > 0 ? gross / wins.length : 0,
      avgLoss:      losses.length  > 0 ? lost  / losses.length : 0,
      profitFactor: lost > 0 ? gross / lost : null,
      best,
      worst,
    };
  }, [trades]);

  // Strategy breakdown
  const breakdown = useMemo(() => {
    const byStrat: Record<string, Trade[]> = {};
    trades.forEach(t => {
      const key = t.strategy_id ?? "__none__";
      if (!byStrat[key]) byStrat[key] = [];
      byStrat[key].push(t);
    });
    return Object.entries(byStrat)
      .map(([key, ts]) => {
        const strat = strategies.find(s => s.id === key);
        const pnl   = ts.reduce((s, t) => s + (t.pnl ?? 0), 0);
        const wins  = ts.filter(t => (t.pnl ?? 0) > 0).length;
        return {
          name:    strat?.name ?? "No Strategy",
          count:   ts.length,
          wins,
          winRate: Math.round((wins / ts.length) * 100),
          pnl,
          avgPnl:  pnl / ts.length,
        };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades, strategies]);

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Performance breakdown across your trade history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          {DATE_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setDateRange(r.value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                dateRange === r.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          {TRADE_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setTradeType(t.value)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                tradeType === t.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
          <p className="text-sm font-medium">No closed trades in this period</p>
          <p className="text-xs">Log trades with entry and exit prices in the Trade Log to see reports here</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Total P&L"
              value={`${stats.total >= 0 ? "+" : ""}$${Math.abs(stats.total).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              color={stats.total >= 0 ? "text-profit" : "text-loss"}
            />
            <StatCard
              label="Win Rate"
              value={`${stats.winRate.toFixed(0)}%`}
              sub={`${stats.winsCount}W / ${stats.lossCount}L`}
            />
            <StatCard
              label="Total Trades"
              value={String(stats.count)}
            />
            <StatCard
              label="Avg Win"
              value={`$${stats.avgWin.toFixed(0)}`}
              color="text-profit"
            />
            <StatCard
              label="Avg Loss"
              value={`$${stats.avgLoss.toFixed(0)}`}
              color="text-loss"
            />
            <StatCard
              label="Profit Factor"
              value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—"}
              color={
                stats.profitFactor === null ? undefined :
                stats.profitFactor >= 1 ? "text-profit" : "text-loss"
              }
            />
          </div>

          {/* Calendar + Strategy breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PnlCalendar trades={allTrades.filter(t => t.pnl !== null)} />

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">By Strategy</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[340px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Strategy</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Trades</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Win%</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total P&amp;L</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">{row.name}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{row.count}</td>
                        <td className="px-3 py-2.5 text-right">{row.winRate}%</td>
                        <td className={cn(
                          "px-4 py-2.5 text-right font-mono font-medium",
                          row.pnl >= 0 ? "text-profit" : "text-loss"
                        )}>
                          {row.pnl >= 0 ? "+" : ""}${Math.abs(row.pnl).toFixed(0)}
                        </td>
                        <td className={cn(
                          "px-4 py-2.5 text-right font-mono",
                          row.avgPnl >= 0 ? "text-profit" : "text-loss"
                        )}>
                          {row.avgPnl >= 0 ? "+" : ""}${Math.abs(row.avgPnl).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Best / Worst trade */}
          {(stats.best || stats.worst) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.best && (
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2">Best Trade</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{stats.best.symbol}</span>
                    <span className="text-profit font-mono font-bold text-lg">
                      +${stats.best.pnl?.toFixed(0)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                    {stats.best.side} · {stats.best.trade_type.replace("_", " ")} · {stats.best.entry_date}
                  </p>
                </div>
              )}
              {stats.worst && (
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2">Worst Trade</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{stats.worst.symbol}</span>
                    <span className="text-loss font-mono font-bold text-lg">
                      -${Math.abs(stats.worst.pnl ?? 0).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                    {stats.worst.side} · {stats.worst.trade_type.replace("_", " ")} · {stats.worst.entry_date}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
