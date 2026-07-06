"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, TrendingUp, Lightbulb, BarChart2,
  ChevronLeft, Code2, Copy, Check, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strategy, TradeIdea, Trade } from "@/lib/types";
import { StrategyDialog } from "./StrategyDialog";
import { IdeaDialog } from "./IdeaDialog";

// ── Constants ─────────────────────────────────────────────────────────────────

const HORIZON_LABELS: Record<string, string> = {
  scalp:      "Scalp",
  day_trade:  "Day Trade",
  swing:      "Swing",
  investment: "Investment",
};

// ── Stats helpers ─────────────────────────────────────────────────────────────

function computeStats(trades: Trade[]) {
  const closed     = trades.filter(t => t.pnl !== null);
  const pnl        = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins       = closed.filter(t => (t.pnl ?? 0) > 0);
  const losses     = closed.filter(t => (t.pnl ?? 0) < 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss  = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  return {
    count:        closed.length,
    pnl,
    winRate:      closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null,
    avgWin:       wins.length    > 0 ? grossProfit / wins.length   : null,
    avgLoss:      losses.length  > 0 ? grossLoss   / losses.length : null,
    profitFactor: grossLoss      > 0 ? grossProfit / grossLoss     : null,
  };
}

// ── Strategy list item (compact sidebar row) ──────────────────────────────────

function StratItem({
  s, trades, selected, onClick,
}: { s: Strategy; trades: Trade[]; selected: boolean; onClick: () => void }) {
  const stats = useMemo(
    () => computeStats(trades.filter(t => t.strategy_id === s.id)),
    [trades, s.id]
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{s.name}</span>
        {stats.count > 0 && (
          <span className={cn(
            "text-xs font-mono shrink-0",
            stats.pnl >= 0 ? "text-profit" : "text-loss"
          )}>
            {stats.pnl >= 0 ? "+" : ""}${Math.abs(stats.pnl).toFixed(0)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-[10px] text-muted-foreground">
          {HORIZON_LABELS[s.time_horizon] ?? s.time_horizon}
        </span>
        {s.catalyst_type && (
          <span className="text-[10px] text-muted-foreground">· {s.catalyst_type}</span>
        )}
        {stats.count > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {stats.count} trade{stats.count !== 1 ? "s" : ""}
            {stats.winRate !== null ? ` · ${stats.winRate}%W` : ""}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Strategy detail panel ─────────────────────────────────────────────────────

function StratDetail({
  s, trades, onEdit, onDelete,
}: { s: Strategy; trades: Trade[]; onEdit: () => void; onDelete: () => void }) {
  const stratTrades = useMemo(
    () => trades.filter(t => t.strategy_id === s.id),
    [trades, s.id]
  );
  const stats = useMemo(() => computeStats(stratTrades), [stratTrades]);

  const [pine,       setPine]       = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);

  async function generatePine() {
    setGenerating(true);
    const parts = [
      `Strategy name: ${s.name}`,
      s.description   && `Description: ${s.description}`,
      s.setup_pattern && `Setup pattern: ${s.setup_pattern}`,
      s.entry_rules   && `Entry rules: ${s.entry_rules}`,
      s.exit_rules    && `Exit rules: ${s.exit_rules}`,
      s.risk_params?.max_risk_per_trade && `Max risk per trade: $${s.risk_params.max_risk_per_trade}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("/api/pine-script", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: parts }),
      });
      const data = await res.json();
      setPine(data.code ?? "");
    } finally {
      setGenerating(false);
    }
  }

  async function copyPine() {
    if (!pine) return;
    await navigator.clipboard.writeText(pine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{s.name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {HORIZON_LABELS[s.time_horizon] ?? s.time_horizon}
            </Badge>
            {s.catalyst_type && (
              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded">
                {s.catalyst_type}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Definition */}
      {s.description && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Definition
          </h3>
          <p className="text-sm leading-relaxed">{s.description}</p>
        </section>
      )}

      {/* Setup & Rules */}
      {(s.setup_pattern || s.entry_rules || s.exit_rules) && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Setup &amp; Rules
          </h3>
          {s.setup_pattern && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Setup Pattern
              </p>
              <p className="text-sm bg-muted/40 rounded-lg p-3 leading-relaxed border border-border">
                {s.setup_pattern}
              </p>
            </div>
          )}
          {s.entry_rules && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Entry Rules
              </p>
              <p className="text-sm bg-profit/5 border border-profit/15 rounded-lg p-3 leading-relaxed">
                {s.entry_rules}
              </p>
            </div>
          )}
          {s.exit_rules && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Exit Rules
              </p>
              <p className="text-sm bg-loss/5 border border-loss/15 rounded-lg p-3 leading-relaxed">
                {s.exit_rules}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Risk parameters */}
      {(s.risk_params?.max_risk_per_trade || s.risk_params?.max_position_size) && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Risk Parameters
          </h3>
          <div className="flex gap-3 flex-wrap">
            {s.risk_params.max_risk_per_trade && (
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Max Risk / Trade</p>
                <p className="text-sm font-bold font-mono text-loss mt-0.5">
                  ${s.risk_params.max_risk_per_trade}
                </p>
              </div>
            )}
            {s.risk_params.max_position_size && (
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Max Position Size</p>
                <p className="text-sm font-bold font-mono mt-0.5">
                  ${s.risk_params.max_position_size}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Performance */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Performance
        </h3>
        {stats.count === 0 ? (
          <p className="text-xs text-muted-foreground">
            No closed trades logged with this strategy yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Total P&amp;L</p>
              <p className={cn("text-sm font-bold font-mono mt-0.5", stats.pnl >= 0 ? "text-profit" : "text-loss")}>
                {stats.pnl >= 0 ? "+" : ""}${Math.abs(stats.pnl).toFixed(0)}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Win Rate</p>
              <p className="text-sm font-bold mt-0.5">{stats.winRate ?? 0}%</p>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted-foreground">Trades</p>
              <p className="text-sm font-bold mt-0.5">{stats.count}</p>
            </div>
            {stats.avgWin !== null && (
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Avg Win</p>
                <p className="text-sm font-bold font-mono text-profit mt-0.5">
                  +${stats.avgWin.toFixed(0)}
                </p>
              </div>
            )}
            {stats.avgLoss !== null && (
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Avg Loss</p>
                <p className="text-sm font-bold font-mono text-loss mt-0.5">
                  -${stats.avgLoss.toFixed(0)}
                </p>
              </div>
            )}
            {stats.profitFactor !== null && (
              <div className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Profit Factor</p>
                <p className={cn(
                  "text-sm font-bold mt-0.5",
                  stats.profitFactor >= 1 ? "text-profit" : "text-loss"
                )}>
                  {stats.profitFactor.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent trades */}
      {stratTrades.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Recent Trades
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            {stratTrades.slice(0, 6).map((t, i) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-xs",
                  i < stratTrades.slice(0, 6).length - 1 && "border-b border-border"
                )}
              >
                <span className="font-bold font-mono w-14 shrink-0">{t.symbol}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] py-0 px-1 shrink-0",
                    t.side === "long" ? "text-profit border-profit/30" : "text-loss border-loss/30"
                  )}
                >
                  {t.side}
                </Badge>
                <span className="text-muted-foreground text-[10px] shrink-0">
                  {t.trade_type.replace("_", " ")}
                </span>
                <span className={cn(
                  "font-mono font-medium ml-auto",
                  (t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"
                )}>
                  {t.pnl != null
                    ? `${(t.pnl ?? 0) >= 0 ? "+" : ""}$${Math.abs(t.pnl).toFixed(0)}`
                    : <span className="text-muted-foreground">open</span>
                  }
                </span>
                <span className="text-muted-foreground text-[10px] shrink-0">{t.entry_date}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pine Script */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Pine Script
          </h3>
          {pine && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyPine}>
              {copied
                ? <><Check className="h-3.5 w-3.5" /> Copied</>
                : <><Copy className="h-3.5 w-3.5" /> Copy</>
              }
            </Button>
          )}
        </div>

        {!pine ? (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Generate a Pine Script v5 strategy based on your rules above.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={generatePine}
              disabled={generating}
              className="gap-2"
            >
              {generating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Code2 className="h-3.5 w-3.5" />
              }
              {generating ? "Generating…" : "Generate Pine Script"}
            </Button>
          </div>
        ) : (
          <pre className="text-[11px] font-mono bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre">
            {pine}
          </pre>
        )}
      </section>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface Props {
  strategies: Strategy[];
  ideas: TradeIdea[];
  trades: Trade[];
}

export function StrategiesPage({ strategies: init, ideas: initIdeas, trades }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>(init);
  const [ideas, setIdeas]           = useState<TradeIdea[]>(initIdeas);
  const [selected, setSelected]     = useState<Strategy | null>(init[0] ?? null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [stratDlg, setStratDlg]     = useState<{ open: boolean; editing: Strategy | null }>({ open: false, editing: null });
  const [ideaDlg, setIdeaDlg]       = useState<{ open: boolean; editing: TradeIdea | null }>({ open: false, editing: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function selectStrategy(s: Strategy) {
    setSelected(s);
    setMobileView("detail");
  }

  function upsertStrategy(s: Strategy) {
    setStrategies(prev => {
      const i = prev.findIndex(x => x.id === s.id);
      if (i >= 0) { const n = [...prev]; n[i] = s; return n; }
      return [...prev, s];
    });
    setSelected(s);
    setMobileView("detail");
  }

  function upsertIdea(idea: TradeIdea) {
    setIdeas(prev => {
      const i = prev.findIndex(x => x.id === idea.id);
      if (i >= 0) { const n = [...prev]; n[i] = idea; return n; }
      return [...prev, idea];
    });
  }

  async function deleteStrategy(id: string) {
    setDeletingId(id);
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    setStrategies(prev => {
      const next = prev.filter(x => x.id !== id);
      if (selected?.id === id) setSelected(next[0] ?? null);
      return next;
    });
    setDeletingId(null);
    setMobileView("list");
  }

  async function deleteIdea(id: string) {
    setDeletingId(id);
    await fetch(`/api/trade-ideas/${id}`, { method: "DELETE" });
    setIdeas(i => i.filter(x => x.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="strategies" className="flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {mobileView === "detail" && (
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 md:hidden"
                onClick={() => setMobileView("list")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-bold">Strategies</h1>
          </div>
          <TabsList className="h-8 shrink-0">
            <TabsTrigger value="strategies" className="text-xs gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> Strategies
            </TabsTrigger>
            <TabsTrigger value="ideas" className="text-xs gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Trade Ideas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Strategies tab ─────────────────────────────────────────────── */}
        <TabsContent value="strategies" className="flex-1 min-h-0 overflow-hidden mt-0">
          {strategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <TrendingUp className="h-10 w-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No strategies yet</p>
                <p className="text-xs mt-1">Define your trading playbook to track per-setup performance</p>
              </div>
              <Button onClick={() => setStratDlg({ open: true, editing: null })}>
                <Plus className="h-4 w-4 mr-1.5" /> Add your first strategy
              </Button>
            </div>
          ) : (
            <div className="flex h-full">
              {/* Left: strategy list */}
              <div className={cn(
                "flex flex-col border-r border-border shrink-0 w-full md:w-64 lg:w-72",
                mobileView === "detail" ? "hidden md:flex" : "flex"
              )}>
                <div className="px-3 py-2 border-b border-border shrink-0">
                  <Button
                    size="sm" className="w-full gap-1.5"
                    onClick={() => setStratDlg({ open: true, editing: null })}
                  >
                    <Plus className="h-3.5 w-3.5" /> New Strategy
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {strategies.map(s => (
                    <StratItem
                      key={s.id}
                      s={s}
                      trades={trades}
                      selected={selected?.id === s.id}
                      onClick={() => selectStrategy(s)}
                    />
                  ))}
                </div>
              </div>

              {/* Right: strategy detail */}
              <div className={cn(
                "flex-1 min-w-0",
                mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
              )}>
                {selected ? (
                  <StratDetail
                    key={selected.id}
                    s={selected}
                    trades={trades}
                    onEdit={() => setStratDlg({ open: true, editing: selected })}
                    onDelete={() => deleteStrategy(selected.id)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Select a strategy to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Trade Ideas tab ────────────────────────────────────────────── */}
        <TabsContent value="ideas" className="flex-1 min-h-0 overflow-auto mt-0 px-4 md:px-6 pt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setIdeaDlg({ open: true, editing: null })}>
              <Plus className="h-4 w-4 mr-1.5" /> New Idea
            </Button>
          </div>

          {ideas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Lightbulb className="h-8 w-8 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">No trade ideas</p>
                <p className="text-xs mt-1">Track setups you&apos;re watching before committing capital</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIdeaDlg({ open: true, editing: null })}>
                Add your first idea
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Symbol", "Status", "Strategy", "Thesis", "Catalyst", "Horizon", "Added", ""].map(h => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ideas.map(idea => {
                    const strat = strategies.find(s => s.id === idea.strategy_id);
                    return (
                      <tr key={idea.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-bold font-mono">{idea.symbol}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "text-xs font-medium capitalize",
                            idea.status === "active" ? "text-profit" :
                            idea.status === "closed" ? "text-muted-foreground line-through" :
                            "text-muted-foreground"
                          )}>
                            {idea.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {strat?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs max-w-[200px]">
                          <span className="line-clamp-1">{idea.thesis}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {idea.catalyst ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {HORIZON_LABELS[idea.time_horizon] ?? idea.time_horizon}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(idea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => setIdeaDlg({ open: true, editing: idea })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteIdea(idea.id)}
                              disabled={deletingId === idea.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <StrategyDialog
        key={stratDlg.editing?.id ?? "new-strat"}
        open={stratDlg.open}
        onClose={() => setStratDlg({ open: false, editing: null })}
        onSaved={upsertStrategy}
        initial={stratDlg.editing}
      />
      <IdeaDialog
        key={ideaDlg.editing?.id ?? "new-idea"}
        open={ideaDlg.open}
        onClose={() => setIdeaDlg({ open: false, editing: null })}
        onSaved={upsertIdea}
        strategies={strategies}
        initial={ideaDlg.editing}
      />
    </div>
  );
}
