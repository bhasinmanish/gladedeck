"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, TrendingUp, Lightbulb, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strategy, TradeIdea, Trade } from "@/lib/types";
import { StrategyDialog } from "./StrategyDialog";
import { IdeaDialog } from "./IdeaDialog";

const HORIZON_LABELS: Record<string, string> = {
  scalp:      "Scalp",
  day_trade:  "Day Trade",
  swing:      "Swing",
  investment: "Investment",
};

interface Props {
  strategies: Strategy[];
  ideas: TradeIdea[];
  trades: Trade[];
}

export function StrategiesPage({ strategies: init, ideas: initIdeas, trades }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>(init);
  const [ideas, setIdeas]           = useState<TradeIdea[]>(initIdeas);
  const [stratDlg, setStratDlg]     = useState<{ open: boolean; editing: Strategy | null }>({ open: false, editing: null });
  const [ideaDlg, setIdeaDlg]       = useState<{ open: boolean; editing: TradeIdea | null }>({ open: false, editing: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Per-strategy stats from trade log ──────────────────────────────────────

  function stratStats(id: string) {
    const ts = trades.filter(t => t.strategy_id === id && t.pnl !== null);
    const pnl = ts.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = ts.filter(t => (t.pnl ?? 0) > 0).length;
    return {
      count:   ts.length,
      pnl,
      winRate: ts.length > 0 ? Math.round((wins / ts.length) * 100) : null,
    };
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  function upsertStrategy(s: Strategy) {
    setStrategies(prev => {
      const i = prev.findIndex(x => x.id === s.id);
      if (i >= 0) { const n = [...prev]; n[i] = s; return n; }
      return [...prev, s];
    });
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
    setStrategies(s => s.filter(x => x.id !== id));
    setDeletingId(null);
  }

  async function deleteIdea(id: string) {
    setDeletingId(id);
    await fetch(`/api/trade-ideas/${id}`, { method: "DELETE" });
    setIdeas(i => i.filter(x => x.id !== id));
    setDeletingId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-hidden">
      <Tabs defaultValue="strategies" className="flex flex-col flex-1 min-h-0">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Strategies</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your trading playbook and active ideas</p>
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
        <TabsContent value="strategies" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setStratDlg({ open: true, editing: null })}>
              <Plus className="h-4 w-4 mr-1.5" /> New Strategy
            </Button>
          </div>

          {strategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">No strategies yet</p>
                <p className="text-xs mt-1">Define your trading playbook to track performance per setup</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStratDlg({ open: true, editing: null })}>
                Add your first strategy
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map(s => {
                const stats = stratStats(s.id);
                return (
                  <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{s.name}</span>
                          <Badge variant="secondary" className="text-[10px] py-0">
                            {HORIZON_LABELS[s.time_horizon] ?? s.time_horizon}
                          </Badge>
                          {s.catalyst_type && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {s.catalyst_type}
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setStratDlg({ open: true, editing: s })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteStrategy(s.id)}
                          disabled={deletingId === s.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Rules preview */}
                    {(s.setup_pattern || s.entry_rules || s.exit_rules) && (
                      <div className="space-y-1 border-t border-border pt-3">
                        {s.setup_pattern && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0 w-10">Setup</span>
                            <span className="line-clamp-1">{s.setup_pattern}</span>
                          </div>
                        )}
                        {s.entry_rules && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0 w-10">Entry</span>
                            <span className="line-clamp-1">{s.entry_rules}</span>
                          </div>
                        )}
                        {s.exit_rules && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0 w-10">Exit</span>
                            <span className="line-clamp-1">{s.exit_rules}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 border-t border-border pt-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Trades </span>
                        <span className="font-medium">{stats.count}</span>
                      </div>
                      {stats.winRate !== null && (
                        <div>
                          <span className="text-muted-foreground">Win Rate </span>
                          <span className="font-medium">{stats.winRate}%</span>
                        </div>
                      )}
                      {stats.count > 0 && (
                        <div>
                          <span className="text-muted-foreground">P&amp;L </span>
                          <span className={cn("font-mono font-medium", stats.pnl >= 0 ? "text-profit" : "text-loss")}>
                            {stats.pnl >= 0 ? "+" : ""}${Math.abs(stats.pnl).toFixed(0)}
                          </span>
                        </div>
                      )}
                      {s.risk_params?.max_risk_per_trade && (
                        <div className="ml-auto">
                          <span className="text-muted-foreground">Max Risk </span>
                          <span className="font-medium">${s.risk_params.max_risk_per_trade}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Trade Ideas tab ────────────────────────────────────────────── */}
        <TabsContent value="ideas" className="flex-1 min-h-0 overflow-auto mt-0 data-[state=inactive]:hidden">
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
                            idea.status === "active"  ? "text-profit" :
                            idea.status === "closed"  ? "text-muted-foreground line-through" :
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
