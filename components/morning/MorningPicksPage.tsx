"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, AlertCircle, Star, Zap, Flame, FileText, Pencil,
} from "lucide-react";

interface NewsItem {
  title:    string;
  category: string;
}

interface MarketDatum {
  price?:             number;
  gap_pct?:           number;
  vol_ratio?:         number;
  sma20_dist?:        number;
  sma50_dist?:        number | null;
  sma200_dist?:       number | null;
  sector?:            string;
  premarket_price?:   number;
  premarket_gap_pct?: number;
  premarket_volume?:  number;
  news?:              NewsItem[];
  error?:             string;
}

interface Pick {
  id:                   string;
  date:                 string;
  bullish_tickers:      string[];
  bearish_tickers:      string[];
  favorites_tickers:    string[];
  scalp_tickers:        string[];
  explosive_tickers:    string[];
  notes?:               string;
  market_data:          Record<string, MarketDatum>;
  pattern_analysis?:    string;
  analysis_updated_at?: string;
}

const SIDE_CONFIG = {
  bullish:    { label: "Bullish",     Icon: TrendingUp,   border: "border-profit/20",      bg: "bg-profit/5",      text: "text-profit"      },
  bearish:    { label: "Bearish",     Icon: TrendingDown, border: "border-loss/20",        bg: "bg-loss/5",        text: "text-loss"        },
  favorites:  { label: "Favorites",   Icon: Star,         border: "border-amber-400/30",   bg: "bg-amber-400/5",   text: "text-amber-400"   },
  scalps:     { label: "Scalps",      Icon: Zap,          border: "border-blue-400/30",    bg: "bg-blue-400/5",    text: "text-blue-400"    },
  explosives: { label: "Explosives",  Icon: Flame,        border: "border-orange-400/30",  bg: "bg-orange-400/5",  text: "text-orange-400"  },
} as const;

type TickerSide = keyof typeof SIDE_CONFIG;

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function TickerCard({ ticker, data, side }: { ticker: string; data: MarketDatum; side: TickerSide }) {
  const { border, bg, text } = SIDE_CONFIG[side];
  return (
    <div className={cn("rounded-lg border p-2.5 space-y-1.5", border, bg)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-bold font-mono text-sm", text)}>{ticker}</span>
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

function SectionGrid({ tickers, data, side }: { tickers: string[]; data: Record<string, MarketDatum>; side: TickerSide }) {
  if (tickers.length === 0) return null;
  const { label, Icon, text } = SIDE_CONFIG[side];
  return (
    <div>
      <p className={cn("text-xs font-semibold mb-2 flex items-center gap-1", text)}>
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {tickers.map(t => (
          <TickerCard key={t} ticker={t} data={data?.[t] ?? {}} side={side} />
        ))}
      </div>
    </div>
  );
}

function PickRow({ pick }: { pick: Pick }) {
  const [open, setOpen] = useState(false);
  const total =
    pick.bullish_tickers.length + pick.bearish_tickers.length +
    (pick.favorites_tickers?.length ?? 0) + (pick.scalp_tickers?.length ?? 0) +
    (pick.explosive_tickers?.length ?? 0);

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
          <div className="flex items-center gap-1 flex-wrap">
            {pick.bullish_tickers.length > 0 && (
              <Badge className="bg-profit/10 text-profit border-profit/20 gap-1 text-[10px]">
                <TrendingUp className="h-2.5 w-2.5" /> {pick.bullish_tickers.length}
              </Badge>
            )}
            {pick.bearish_tickers.length > 0 && (
              <Badge className="bg-loss/10 text-loss border-loss/20 gap-1 text-[10px]">
                <TrendingDown className="h-2.5 w-2.5" /> {pick.bearish_tickers.length}
              </Badge>
            )}
            {(pick.favorites_tickers?.length ?? 0) > 0 && (
              <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/20 gap-1 text-[10px]">
                <Star className="h-2.5 w-2.5" /> {pick.favorites_tickers.length}
              </Badge>
            )}
            {(pick.scalp_tickers?.length ?? 0) > 0 && (
              <Badge className="bg-blue-400/10 text-blue-400 border-blue-400/20 gap-1 text-[10px]">
                <Zap className="h-2.5 w-2.5" /> {pick.scalp_tickers.length}
              </Badge>
            )}
            {(pick.explosive_tickers?.length ?? 0) > 0 && (
              <Badge className="bg-orange-400/10 text-orange-400 border-orange-400/20 gap-1 text-[10px]">
                <Flame className="h-2.5 w-2.5" /> {pick.explosive_tickers.length}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{total} total</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          <SectionGrid tickers={pick.bullish_tickers}          data={pick.market_data} side="bullish"    />
          <SectionGrid tickers={pick.bearish_tickers}          data={pick.market_data} side="bearish"    />
          <SectionGrid tickers={pick.favorites_tickers ?? []}  data={pick.market_data} side="favorites"  />
          <SectionGrid tickers={pick.scalp_tickers ?? []}      data={pick.market_data} side="scalps"     />
          <SectionGrid tickers={pick.explosive_tickers ?? []}  data={pick.market_data} side="explosives" />
          {pick.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes
              </p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg px-3 py-2">
                {pick.notes}
              </p>
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

function PickInput({
  label, side, value, onChange, placeholder,
}: {
  label: string; side: TickerSide; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  const { Icon, text } = SIDE_CONFIG[side];
  const preview = parseTickers(value);
  return (
    <div className="space-y-1.5">
      <label className={cn("text-xs font-semibold flex items-center gap-1", text)}>
        <Icon className="h-3 w-3" /> {label}
      </label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="font-mono text-xs resize-none"
      />
      {preview.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {preview.join(", ")} · {preview.length} ticker{preview.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export function WatchlistPage() {
  const [picks,     setPicks]     = useState<Pick[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [analysis,   setAnalysis]   = useState<string | null>(null);

  const [bullishRaw,    setBullishRaw]    = useState("");
  const [bearishRaw,    setBearishRaw]    = useState("");
  const [favoritesRaw,  setFavoritesRaw]  = useState("");
  const [scalpsRaw,     setScalpsRaw]     = useState("");
  const [explosivesRaw, setExplosivesRaw] = useState("");
  const [notesRaw,      setNotesRaw]      = useState("");

  const today = new Date().toISOString().split("T")[0];
  const todayPick = picks.find(p => p.date === today);
  const hasToday  = !!todayPick;

  function loadForEditing(pick: Pick) {
    setBullishRaw(pick.bullish_tickers.join("\n"));
    setBearishRaw(pick.bearish_tickers.join("\n"));
    setFavoritesRaw((pick.favorites_tickers ?? []).join("\n"));
    setScalpsRaw((pick.scalp_tickers ?? []).join("\n"));
    setExplosivesRaw((pick.explosive_tickers ?? []).join("\n"));
    setNotesRaw(pick.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
    const bullish    = parseTickers(bullishRaw);
    const bearish    = parseTickers(bearishRaw);
    const favorites  = parseTickers(favoritesRaw);
    const scalps     = parseTickers(scalpsRaw);
    const explosives = parseTickers(explosivesRaw);

    if ([bullish, bearish, favorites, scalps, explosives].every(a => a.length === 0)) {
      setError("Add at least one ticker to any list.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/morning-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullish, bearish, favorites, scalps, explosives, notes: notesRaw.trim(), date: today }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setPicks(prev => [data, ...prev.filter(p => p.date !== today)]);
      setBullishRaw(""); setBearishRaw(""); setFavoritesRaw(""); setScalpsRaw(""); setExplosivesRaw(""); setNotesRaw("");
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
  const anyInput   = [bullishRaw, bearishRaw, favoritesRaw, scalpsRaw, explosivesRaw].some(r => parseTickers(r).length > 0) || notesRaw.trim().length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
      <div>
        <h1 className="text-xl font-bold">Watchlist</h1>
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
            <div className="flex items-center gap-2">
              {isAiToday
                ? <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">AI generated</Badge>
                : <Badge variant="outline" className="text-profit border-profit/30 text-[10px]">Saved today</Badge>
              }
              <Button
                size="sm" variant="ghost"
                onClick={() => loadForEditing(todayPick!)}
                className="gap-1 text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            </div>
          )}
        </div>

        {/* Bullish / Bearish */}
        <div className="grid grid-cols-2 gap-3">
          <PickInput label="Bullish"  side="bullish"  value={bullishRaw}  onChange={setBullishRaw}  placeholder={"NVDA\nTSLA\nAAPL"} />
          <PickInput label="Bearish"  side="bearish"  value={bearishRaw}  onChange={setBearishRaw}  placeholder={"META\nGOOGL\nAMZN"} />
        </div>

        {/* Favorites / Scalps / Explosives */}
        <div className="grid grid-cols-3 gap-3">
          <PickInput label="Favorites"  side="favorites"  value={favoritesRaw}  onChange={setFavoritesRaw}  placeholder={"NVDA\nTSLA"} />
          <PickInput label="Scalps"     side="scalps"     value={scalpsRaw}     onChange={setScalpsRaw}     placeholder={"SPY\nQQQ"}   />
          <PickInput label="Explosives" side="explosives" value={explosivesRaw} onChange={setExplosivesRaw} placeholder={"SMCI\nMSTR"}  />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> Notes
          </label>
          <Textarea
            value={notesRaw}
            onChange={e => setNotesRaw(e.target.value)}
            placeholder={"NVDA - watching $900 breakout, earnings catalyst still in play\nTSLA - avoid below $200, needs volume confirmation\nAMZN - gap and go setup, key resistance at $195"}
            rows={4}
            className="text-xs resize-none"
          />
          <p className="text-[10px] text-muted-foreground">Free-form notes on specific stocks — what to watch for, levels, catalysts.</p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={save}
            disabled={saving || !anyInput}
            className="gap-1.5"
            size="sm"
          >
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving &amp; fetching data…</>
              : "Save Picks"}
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
              Click Analyze to find what your selections have in common across all categories.
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
          <p className="text-xs mt-1">Paste your watchlist above and save it each day.</p>
        </div>
      )}
    </div>
  );
}
