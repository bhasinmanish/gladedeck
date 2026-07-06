"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Lightbulb, BarChart2,
  ChevronLeft, Code2, Copy, Check, Loader2, Info,
  CheckCircle2, User2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STRATEGY_CATALOG, CATEGORIES, type CatalogStrategy } from "@/lib/strategy-catalog";
import type { TradeIdea, Strategy, Trade } from "@/lib/types";
import { IdeaDialog } from "./IdeaDialog";
import { CustomStrategyDialog } from "./CustomStrategyDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type Selection =
  | { kind: "catalog"; s: CatalogStrategy }
  | { kind: "user";    s: Strategy };

// ── Helpers ───────────────────────────────────────────────────────────────────

const HORIZON_LABELS: Record<string, string> = {
  scalp: "Scalp", day_trade: "Day Trade", swing: "Swing", investment: "Investment",
};

function computeStats(trades: Trade[]) {
  const closed      = trades.filter(t => t.pnl !== null);
  const pnl         = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins        = closed.filter(t => (t.pnl ?? 0) > 0);
  const losses      = closed.filter(t => (t.pnl ?? 0) < 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  return {
    count:        closed.length,
    pnl,
    winRate:      closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
  };
}

// ── Pine Script panel (shared) ────────────────────────────────────────────────

function PineScriptPanel({ name, definition, summary }: { name: string; definition: string; summary: string }) {
  const [pine, setPine]             = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [genError, setGenError]     = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    const prompt = [`Strategy: ${name}`, definition && `Definition: ${definition}`, summary && `Summary: ${summary}`]
      .filter(Boolean).join("\n\n");
    try {
      const res = await fetch("/api/pine-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setGenError(body.error ?? `Server error ${res.status}`);
        return;
      }
      const data = await res.json();
      setPine(data.code ?? "");
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    if (!pine) return;
    await navigator.clipboard.writeText(pine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Calculations / Pine Script
        </h3>
        {pine !== null && pine.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </Button>
        )}
      </div>
      {pine !== null ? (
        pine.length > 0
          ? <pre className="text-[11px] font-mono bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre">{pine}</pre>
          : <p className="text-xs text-muted-foreground italic">No code was returned. Try again.</p>
      ) : (
        <div className="bg-muted/30 border border-border rounded-lg p-4 flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">Generate a Pine Script v5 implementation of this strategy.</p>
          <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Code2 className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate Pine Script"}
          </Button>
          {genError && <p className="text-xs text-destructive">{genError}</p>}
        </div>
      )}
    </section>
  );
}

// ── Catalog detail panel ──────────────────────────────────────────────────────

function CatalogDetail({
  strategy, applied, applying, onApply,
}: {
  strategy: CatalogStrategy;
  applied: boolean; applying: boolean; onApply: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{strategy.name}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{strategy.category}</Badge>
            <span className="text-[10px] text-muted-foreground">{strategy.timeHorizon}</span>
            {strategy.tags.map(t => (
              <span key={t} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
        {applied ? (
          <Badge className="shrink-0 gap-1.5 bg-profit/10 text-profit border border-profit/20 hover:bg-profit/10">
            <CheckCircle2 className="h-3 w-3" /> Applied
          </Badge>
        ) : (
          <Button size="sm" onClick={onApply} disabled={applying} className="shrink-0 gap-1.5">
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {applying ? "Applying…" : "Apply Strategy"}
          </Button>
        )}
      </div>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Definition</h3>
        <p className="text-sm leading-relaxed">{strategy.definition}</p>
      </section>

      <PineScriptPanel key={strategy.id} name={strategy.name} definition={strategy.definition} summary={strategy.summary} />

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Summary</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{strategy.summary}</p>
      </section>
    </div>
  );
}

// ── User strategy detail panel ────────────────────────────────────────────────

function UserStratDetail({
  strategy, trades, onEdit, onDelete,
}: {
  strategy: Strategy;
  trades: Trade[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rp         = strategy.risk_params ?? {};
  const category   = rp.category   as string | undefined;
  const summary    = rp.summary    as string | undefined;
  const tags       = (rp.tags      as string[] | undefined) ?? [];
  const definition = strategy.description;

  const stratTrades = trades.filter(t => t.strategy_id === strategy.id);
  const stats       = computeStats(stratTrades);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{strategy.name}</h2>
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Custom</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {category && <Badge variant="secondary" className="text-[10px]">{category}</Badge>}
            <span className="text-[10px] text-muted-foreground">
              {HORIZON_LABELS[strategy.time_horizon] ?? strategy.time_horizon}
            </span>
            {tags.map(t => (
              <span key={t} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
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

      {/* Performance */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Your Performance
        </h3>
        {stats.count === 0 ? (
          <p className="text-xs text-muted-foreground">
            No trades tagged to this strategy yet. Select it in the Trade Log to start tracking.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Trades",        value: String(stats.count),                                            color: "" },
              { label: "P&L",           value: `${stats.pnl >= 0 ? "+" : ""}$${Math.abs(stats.pnl).toFixed(0)}`, color: stats.pnl >= 0 ? "text-profit" : "text-loss" },
              { label: "Win Rate",      value: stats.winRate !== null ? `${stats.winRate}%` : "—",             color: "" },
              { label: "Profit Factor", value: stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—", color: stats.profitFactor !== null ? (stats.profitFactor >= 1 ? "text-profit" : "text-loss") : "" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-card border border-border rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className={cn("text-sm font-bold font-mono mt-0.5", color)}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Definition */}
      {definition ? (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Definition</h3>
          <p className="text-sm leading-relaxed">{definition}</p>
        </section>
      ) : (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Definition</h3>
          <p className="text-xs text-muted-foreground italic">No definition added yet.</p>
        </section>
      )}

      <PineScriptPanel key={strategy.id} name={strategy.name} definition={definition ?? ""} summary={summary ?? ""} />

      {/* Summary */}
      {summary ? (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Summary</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </section>
      ) : null}
    </div>
  );
}

// ── Sidebar list items ────────────────────────────────────────────────────────

function UserStratRow({
  strategy, selected, onSelect,
}: { strategy: Strategy; selected: boolean; onSelect: () => void }) {
  const rp       = strategy.risk_params ?? {};
  const category = rp.category as string | undefined;
  const shortDesc = rp.short_desc as string | undefined;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 px-4 py-2.5 border-b border-border cursor-pointer transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{strategy.name}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
          {shortDesc || category || HORIZON_LABELS[strategy.time_horizon] || "Custom strategy"}
        </p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onSelect(); }}
        className={cn(
          "shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors",
          selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CatalogRow({
  strategy, selected, applied, onSelect,
}: { strategy: CatalogStrategy; selected: boolean; applied: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 px-4 py-2.5 border-b border-border cursor-pointer transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{strategy.name}</p>
          {applied && <CheckCircle2 className="h-3 w-3 text-profit shrink-0" />}
        </div>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{strategy.shortDesc}</p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onSelect(); }}
        className={cn(
          "shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
          selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface Props {
  strategies: Strategy[];
  ideas: TradeIdea[];
  trades: Trade[];
}

export function StrategiesPage({ strategies: initStrategies, ideas: initIdeas, trades }: Props) {
  const [userStrategies, setUserStrategies] = useState<Strategy[]>(initStrategies);
  const [ideas, setIdeas]                   = useState<TradeIdea[]>(initIdeas);

  const defaultSelection: Selection = initStrategies.length > 0
    ? { kind: "user",    s: initStrategies[0] }
    : { kind: "catalog", s: STRATEGY_CATALOG[0] };

  const [selected, setSelected]   = useState<Selection>(defaultSelection);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [applying, setApplying]   = useState<string | null>(null);

  const [customDlg, setCustomDlg] = useState<{ open: boolean; editing: Strategy | null }>({ open: false, editing: null });
  const [ideaDlg, setIdeaDlg]     = useState<{ open: boolean; editing: TradeIdea | null }>({ open: false, editing: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function isApplied(catalog: CatalogStrategy) {
    return userStrategies.some(s => s.name === catalog.name);
  }

  function selectCatalog(s: CatalogStrategy) {
    setSelected({ kind: "catalog", s });
    setMobileView("detail");
  }

  function selectUser(s: Strategy) {
    setSelected({ kind: "user", s });
    setMobileView("detail");
  }

  async function applyStrategy(catalog: CatalogStrategy) {
    if (isApplied(catalog)) return;
    setApplying(catalog.id);
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          catalog.name,
          description:   catalog.definition,
          time_horizon:  "day_trade",
          catalyst_type: catalog.tags[0] ?? null,
          setup_pattern: null, entry_rules: null, exit_rules: null,
          risk_params: {
            category:   catalog.category,
            summary:    catalog.summary,
            short_desc: catalog.shortDesc,
            tags:       catalog.tags,
          },
        }),
      });
      if (res.ok) {
        const saved: Strategy = await res.json();
        setUserStrategies(prev => [...prev, saved]);
        setSelected({ kind: "user", s: saved });
        setMobileView("detail");
      }
    } finally { setApplying(null); }
  }

  function upsertUserStrategy(s: Strategy) {
    setUserStrategies(prev => {
      const i = prev.findIndex(x => x.id === s.id);
      if (i >= 0) { const n = [...prev]; n[i] = s; return n; }
      return [...prev, s];
    });
    setSelected({ kind: "user", s });
    setMobileView("detail");
  }

  async function deleteUserStrategy(id: string) {
    setDeletingId(id);
    await fetch(`/api/strategies/${id}`, { method: "DELETE" });
    setUserStrategies(prev => {
      const next = prev.filter(x => x.id !== id);
      if (selected.kind === "user" && selected.s.id === id) {
        setSelected(next.length > 0
          ? { kind: "user", s: next[0] }
          : { kind: "catalog", s: STRATEGY_CATALOG[0] }
        );
        setMobileView("list");
      }
      return next;
    });
    setDeletingId(null);
  }

  function upsertIdea(idea: TradeIdea) {
    setIdeas(prev => {
      const i = prev.findIndex(x => x.id === idea.id);
      if (i >= 0) { const n = [...prev]; n[i] = idea; return n; }
      return [...prev, idea];
    });
  }

  async function deleteIdea(id: string) {
    setDeletingId(id);
    await fetch(`/api/trade-ideas/${id}`, { method: "DELETE" });
    setIdeas(i => i.filter(x => x.id !== id));
    setDeletingId(null);
  }

  // ── Right panel ─────────────────────────────────────────────────────────────

  function RightPanel() {
    if (selected.kind === "catalog") {
      return (
        <CatalogDetail
          key={selected.s.id}
          strategy={selected.s}
          applied={isApplied(selected.s)}
          applying={applying === selected.s.id}
          onApply={() => applyStrategy(selected.s)}
        />
      );
    }
    return (
      <UserStratDetail
        key={selected.s.id}
        strategy={selected.s}
        trades={trades}
        onEdit={() => setCustomDlg({ open: true, editing: selected.s as Strategy })}
        onDelete={() => deleteUserStrategy(selected.s.id)}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="strategies" className="flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {mobileView === "detail" && (
              <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setMobileView("list")}>
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
          <div className="flex h-full">

            {/* Left sidebar */}
            <div className={cn(
              "flex flex-col border-r border-border shrink-0 w-full md:w-64 lg:w-72 overflow-y-auto",
              mobileView === "detail" ? "hidden md:flex" : "flex"
            )}>

              {/* My Strategies */}
              <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-1.5">
                  <User2 className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">My Strategies</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => setCustomDlg({ open: true, editing: null })}
                >
                  <Plus className="h-3 w-3" /> Create
                </Button>
              </div>

              {userStrategies.length === 0 ? (
                <div className="px-4 py-3 text-[10px] text-muted-foreground italic border-b border-border">
                  No strategies yet. Create one or apply from the library below.
                </div>
              ) : (
                userStrategies.map(s => (
                  <UserStratRow
                    key={s.id}
                    strategy={s}
                    selected={selected.kind === "user" && selected.s.id === s.id}
                    onSelect={() => selectUser(s)}
                  />
                ))
              )}

              {/* Strategy Library */}
              {CATEGORIES.map(cat => (
                <div key={cat}>
                  <div className="px-4 py-2 bg-muted/30 border-b border-border sticky top-[37px] z-10">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{cat}</p>
                  </div>
                  {STRATEGY_CATALOG.filter(s => s.category === cat).map(s => (
                    <CatalogRow
                      key={s.id}
                      strategy={s}
                      selected={selected.kind === "catalog" && selected.s.id === s.id}
                      applied={isApplied(s)}
                      onSelect={() => selectCatalog(s)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Right panel */}
            <div className={cn(
              "flex-1 min-w-0",
              mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
            )}>
              <RightPanel />
            </div>
          </div>
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
                    {["Symbol", "Status", "Thesis", "Catalyst", "Horizon", "Added", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ideas.map(idea => (
                    <tr key={idea.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-bold font-mono">{idea.symbol}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          "text-xs font-medium capitalize",
                          idea.status === "active" ? "text-profit" :
                          idea.status === "closed" ? "text-muted-foreground line-through" : "text-muted-foreground"
                        )}>
                          {idea.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[200px]"><span className="line-clamp-1">{idea.thesis}</span></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{idea.catalyst ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {HORIZON_LABELS[idea.time_horizon] ?? idea.time_horizon}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(idea.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIdeaDlg({ open: true, editing: idea })}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CustomStrategyDialog
        key={customDlg.editing?.id ?? "new-custom"}
        open={customDlg.open}
        onClose={() => setCustomDlg({ open: false, editing: null })}
        onSaved={upsertUserStrategy}
        initial={customDlg.editing}
      />
      <IdeaDialog
        key={ideaDlg.editing?.id ?? "new-idea"}
        open={ideaDlg.open}
        onClose={() => setIdeaDlg({ open: false, editing: null })}
        onSaved={upsertIdea}
        strategies={userStrategies}
        initial={ideaDlg.editing}
      />
    </div>
  );
}
