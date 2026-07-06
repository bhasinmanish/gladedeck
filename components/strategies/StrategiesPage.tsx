"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Lightbulb, BarChart2,
  ChevronLeft, Code2, Copy, Check, Loader2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STRATEGY_CATALOG, CATEGORIES, type CatalogStrategy } from "@/lib/strategy-catalog";
import type { TradeIdea, Strategy } from "@/lib/types";
import { IdeaDialog } from "./IdeaDialog";

// ── Pine Script generator ─────────────────────────────────────────────────────

function PineScriptPanel({ strategy }: { strategy: CatalogStrategy }) {
  const [pine, setPine]           = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied]       = useState(false);

  async function generate() {
    setGenerating(true);
    const prompt = [
      `Strategy: ${strategy.name}`,
      `Definition: ${strategy.definition}`,
      `Summary: ${strategy.summary}`,
    ].join("\n\n");
    try {
      const res  = await fetch("/api/pine-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setPine(data.code ?? "");
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
        {pine && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copy}>
            {copied
              ? <><Check className="h-3.5 w-3.5" /> Copied</>
              : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </Button>
        )}
      </div>

      {pine ? (
        <pre className="text-[11px] font-mono bg-muted/40 border border-border rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre">
          {pine}
        </pre>
      ) : (
        <div className="bg-muted/30 border border-border rounded-lg p-4 flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            Generate a Pine Script v5 implementation of this strategy.
          </p>
          <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-2">
            {generating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Code2 className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate Pine Script"}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ strategy }: { strategy: CatalogStrategy }) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">{strategy.name}</h2>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{strategy.category}</Badge>
          <span className="text-[10px] text-muted-foreground">{strategy.timeHorizon}</span>
          <div className="flex gap-1 flex-wrap">
            {strategy.tags.map(t => (
              <span key={t} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Definition */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Definition
        </h3>
        <p className="text-sm leading-relaxed">{strategy.definition}</p>
      </section>

      {/* Pine Script */}
      <PineScriptPanel key={strategy.id} strategy={strategy} />

      {/* Summary */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Summary
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{strategy.summary}</p>
      </section>
    </div>
  );
}

// ── Strategy list item ────────────────────────────────────────────────────────

function CatalogItem({
  strategy,
  selected,
  onSelect,
}: {
  strategy: CatalogStrategy;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-4 py-2.5 border-b border-border cursor-pointer transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{strategy.name}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{strategy.shortDesc}</p>
      </div>
      <button
        className={cn(
          "shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-colors",
          selected
            ? "bg-background/40 text-foreground"
            : "text-muted-foreground group-hover:text-foreground"
        )}
        onClick={e => { e.stopPropagation(); onSelect(); }}
        title="View details"
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
  trades: never[];
}

export function StrategiesPage({ ideas: initIdeas, strategies }: Props) {
  const [ideas, setIdeas]       = useState<TradeIdea[]>(initIdeas);
  const [selected, setSelected] = useState<CatalogStrategy>(STRATEGY_CATALOG[0]);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [ideaDlg, setIdeaDlg]   = useState<{ open: boolean; editing: TradeIdea | null }>({ open: false, editing: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function select(s: CatalogStrategy) {
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

  async function deleteIdea(id: string) {
    setDeletingId(id);
    await fetch(`/api/trade-ideas/${id}`, { method: "DELETE" });
    setIdeas(i => i.filter(x => x.id !== id));
    setDeletingId(null);
  }

  const HORIZON_LABELS: Record<string, string> = {
    scalp: "Scalp", day_trade: "Day Trade", swing: "Swing", investment: "Investment",
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="strategies" className="flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {mobileView === "detail" && (
              <Button
                variant="ghost" size="icon" className="h-8 w-8 md:hidden"
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
          <div className="flex h-full">

            {/* Left: catalog list */}
            <div className={cn(
              "flex flex-col border-r border-border shrink-0 w-full md:w-64 lg:w-72 overflow-y-auto",
              mobileView === "detail" ? "hidden md:flex" : "flex"
            )}>
              {CATEGORIES.map(cat => (
                <div key={cat}>
                  <div className="px-4 py-2 bg-muted/30 border-b border-border sticky top-0 z-10">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {cat}
                    </p>
                  </div>
                  {STRATEGY_CATALOG.filter(s => s.category === cat).map(s => (
                    <CatalogItem
                      key={s.id}
                      strategy={s}
                      selected={selected.id === s.id}
                      onSelect={() => select(s)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Right: detail panel */}
            <div className={cn(
              "flex-1 min-w-0",
              mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
            )}>
              <DetailPanel key={selected.id} strategy={selected} />
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
                      <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
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
                          idea.status === "active"  ? "text-profit" :
                          idea.status === "closed"  ? "text-muted-foreground line-through" :
                          "text-muted-foreground"
                        )}>
                          {idea.status}
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
