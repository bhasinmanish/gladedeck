"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, AlertCircle,
} from "lucide-react";

interface NewsItem {
  title:    string;
  category: string;
}

interface MarketDatum {
  price?:            number;
  gap_pct?:          number;
  vol_ratio?:        number;
  sma20_dist?:       number;
  sma50_dist?:       number | null;
  sma200_dist?:      number | null;
  sector?:           string;
  premarket_price?:  number;
  premarket_gap_pct?: number;
  premarket_volume?: number;
  news?:             NewsItem[];
  error?:            string;
}

interface Pick {
  id:                  string;
  date:                string;
  bullish_tickers:     string[];
  bearish_tickers:     string[];
  market_data:         Record<string, MarketDatum>;
  pattern_analysis?:   string;
  analysis_updated_at?: string;
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function TickerCard({ ticker, data, side }: { ticker: string; data: MarketDatum; side: "bullish" | "bearish" }) {
  const isBull = side === "bullish";
  return (
    <div className={cn(
      "rounded-lg border p-2.5 space-y-1.5",
      isBull ? "border-profit/20 bg-profit/5" : "border-loss/20 bg-loss/5"
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-bold font-mono text-sm", isBull ? "text-profit" : "text-loss")}>
          {ticker}
        </span>
        {data.sector && (
          <span className="text-[10px] text-muted-foreground truncate">{data.sector}</span>
        )}
      </div>
      {data.error ? (
        <p className="text-[10px] text-muted-foreground">No data</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            {data.premarket_gap_pct != null && (
              <>
                <span className="text-muted-foreground">PM gap</span>
                <span className={cn("font-mono font-medium", data.premarket_gap_pct >= 0 ? "text-profit" : "text-loss")}>
                  {pct(data.premarket_gap_pct)}
                </span>
              </>
            )}
            <span className="text-muted-foreground">{data.premarket_gap_pct != null ? "Open gap" : "Gap"}</span>
            <span className={cn("font-mono font-medium", (data.gap_pct ?? 0) >= 0 ? "text-profit" : "text-loss")}>
              {pct(data.gap_pct)}
            </span>
            <span className="text-muted-foreground">Vol ratio</span>
            <span className="font-mono">{data.vol_ratio != null ? `${data.vol_ratio.toFixed(1)}x` : "—"}</span>
            <span className="text-muted-foreground">vs SMA20</span>
            <span className="font-mono">{pct(data.sma20_dist)}</span>
            <span className="text-muted-foreground">vs SMA50</span>
            <span className="font-mono">{pct(data.sma50_dist)}</span>
            <span className="text-muted-foreground">vs SMA200</span>
            <span className="font-mono">{pct(data.sma200_dist)}</span>
          </div>
          {data.news && data.news.length > 0 && (
            <div className="pt-1.5 border-t border-border/40 space-y-0.5">
              {data.news.slice(0, 2).map((n, i) => (
                <p key={i} className="text-[10px] text-muted-foreground leading-tight">{n.title}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PickRow({ pick }: { pick: Pick }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">
            {new Date(pick.date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
          </span>
          <div className="flex items-center gap-1.5">
            <Badge className="bg-profit/10 text-profit border-profit/20 gap-1 text-[10px]">
              <TrendingUp className="h-2.5 w-2.5" /> {pick.bullish_tickers.length} bull
            </Badge>
            <Badge className="bg-loss/10 text-loss border-loss/20 gap-1 text-[10px]">
              <TrendingDown className="h-2.5 w-2.5" /> {pick.bearish_tickers.length} bear
            </Badge>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {pick.bullish_tickers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-profit mb-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Bullish
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {pick.bullish_tickers.map(t => (
                  <TickerCard key={t} ticker={t} data={pick.market_data?.[t] ?? {}} side="bullish" />
                ))}
              </div>
            </div>
          )}
          {pick.bearish_tickers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-loss mb-2 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Bearish
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {pick.bearish_tickers.map(t => (
                  <TickerCard key={t} ticker={t} data={pick.market_data?.[t] ?? {}} side="bearish" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseTickers(raw: string): string[] {
  return raw.split(/[\s,\n]+/).map(t => t.toUpperCase().trim()).filter(t => /^[A-Z]{1,5}$/.test(t));
}

export function MorningPicksPage() {
  const [picks,     setPicks]     = useState<Pick[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [analysis,  setAnalysis]  = useState<string | null>(null);
  const [bullishRaw, setBullishRaw] = useState("");
  const [bearishRaw, setBearishRaw] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const todayPick = picks.find(p => p.date === today);
  const hasToday  = !!todayPick;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/morning-picks");
      const data = await res.json();
      if (res.ok) {
        setPicks(Array.isArray(data) ? data : []);
        const latest = (data as Pick[]).find(p => p.pattern_analysis);
        if (latest?.pattern_analysis) setAnalysis(latest.pattern_analysis);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const bullish = parseTickers(bullishRaw);
    const bearish = parseTickers(bearishRaw);
    if (bullish.length === 0 && bearish.length === 0) {
      setError("Add at least one ticker to either list.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/morning-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullish, bearish, date: today }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setPicks(prev => {
        const filtered = prev.filter(p => p.date !== today);
        return [data, ...filtered];
      });
      setBullishRaw("");
      setBearishRaw("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res  = await fetch("/api/morning-picks/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Analysis failed"); return; }
      setAnalysis(data.analysis);
    } catch {
      setError("Analysis failed — try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const canAnalyze = picks.length >= 3;
  const bullishPreview = parseTickers(bullishRaw);
  const bearishPreview = parseTickers(bearishRaw);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-xl font-bold">Morning Picks</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Log your daily watchlist. After a few days, AI analyzes what your picks have in common.
        </p>
      </div>

      {/* Input card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {new Date(today + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })}
          </p>
          {hasToday && (
            <Badge variant="outline" className="text-profit border-profit/30 text-[10px]">
              Saved today
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-profit flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Bullish
            </label>
            <Textarea
              value={bullishRaw}
              onChange={e => setBullishRaw(e.target.value)}
              placeholder={"NVDA\nTSLA\nAAPL"}
              rows={6}
              className="font-mono text-xs resize-none"
            />
            {bullishPreview.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {bullishPreview.join(", ")} · {bullishPreview.length} ticker{bullishPreview.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-loss flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Bearish
            </label>
            <Textarea
              value={bearishRaw}
              onChange={e => setBearishRaw(e.target.value)}
              placeholder={"META\nGOOGL\nAMZN"}
              rows={6}
              className="font-mono text-xs resize-none"
            />
            {bearishPreview.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {bearishPreview.join(", ")} · {bearishPreview.length} ticker{bearishPreview.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={save}
            disabled={saving || (bullishPreview.length === 0 && bearishPreview.length === 0)}
            className="gap-1.5"
            size="sm"
          >
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving &amp; fetching data…</> : "Save Picks"}
          </Button>
          {saving && (
            <p className="text-xs text-muted-foreground">Pulling market data for each ticker…</p>
          )}
        </div>
      </div>

      {/* Pattern analysis */}
      {canAnalyze && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Pattern Analysis
            </p>
            <Button
              size="sm" variant="outline"
              onClick={analyze} disabled={analyzing}
              className="gap-1.5 text-xs h-7"
            >
              {analyzing
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
                : <><RefreshCw className="h-3 w-3" /> {analysis ? "Re-run" : `Analyze ${picks.length} days`}</>
              }
            </Button>
          </div>

          {analysis ? (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border pt-3">
              {analysis}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You have {picks.length} day{picks.length !== 1 ? "s" : ""} of picks.
              Click Analyze to find what your bullish and bearish selections have in common.
            </p>
          )}
        </div>
      )}

      {!canAnalyze && picks.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {3 - picks.length} more day{3 - picks.length !== 1 ? "s" : ""} of picks needed to unlock pattern analysis.
        </p>
      )}

      {/* History */}
      {picks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">History</p>
          {picks.map(p => <PickRow key={p.id} pick={p} />)}
        </div>
      )}

      {picks.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto opacity-20 mb-3" />
          <p className="text-sm font-medium text-foreground">No picks yet</p>
          <p className="text-xs mt-1">Paste your morning watchlist above and save it each day.</p>
        </div>
      )}
    </div>
  );
}
