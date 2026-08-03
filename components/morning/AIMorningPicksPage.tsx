"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Sparkles, Star, Zap, Flame,
} from "lucide-react";

interface NewsItem {
  title: string;
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

interface AIPickDay {
  id:                  string;
  date:                string;
  bullish_tickers:     string[];
  bearish_tickers:     string[];
  favorites_tickers:   string[];
  scalp_tickers:       string[];
  explosive_tickers:   string[];
  notes?:              string;
  market_data:         Record<string, MarketDatum>;
  created_at:          string;
}

const SIDE_CONFIG = {
  bullish:    { label: "Bullish",    Icon: TrendingUp,   border: "border-profit/20",     bg: "bg-profit/5",     text: "text-profit"     },
  bearish:    { label: "Bearish",    Icon: TrendingDown, border: "border-loss/20",       bg: "bg-loss/5",       text: "text-loss"       },
  favorites:  { label: "Favorites",  Icon: Star,         border: "border-amber-400/30",  bg: "bg-amber-400/5",  text: "text-amber-400"  },
  scalps:     { label: "Scalps",     Icon: Zap,          border: "border-blue-400/30",   bg: "bg-blue-400/5",   text: "text-blue-400"   },
  explosives: { label: "Explosives", Icon: Flame,        border: "border-orange-400/30", bg: "bg-orange-400/5", text: "text-orange-400" },
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

function PickAccordion({ pick, defaultOpen }: { pick: AIPickDay; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
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
            <span className="text-[10px] text-muted-foreground">{total} picks</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {pick.notes && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
              {pick.notes}
            </p>
          )}
          <SectionGrid tickers={pick.favorites_tickers ?? []}  data={pick.market_data} side="favorites"  />
          <SectionGrid tickers={pick.bullish_tickers}          data={pick.market_data} side="bullish"    />
          <SectionGrid tickers={pick.bearish_tickers}          data={pick.market_data} side="bearish"    />
          <SectionGrid tickers={pick.scalp_tickers ?? []}      data={pick.market_data} side="scalps"     />
          <SectionGrid tickers={pick.explosive_tickers ?? []}  data={pick.market_data} side="explosives" />
        </div>
      )}
    </div>
  );
}

export function AIMorningPicksPage() {
  const [picks, setPicks]   = useState<AIPickDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/ai-morning-picks");
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load"); return; }
      setPicks(Array.isArray(data) ? data : []);
    } catch {
      setError("Network error — try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayPick  = picks.find(p => p.date === today);
  const pastPicks  = picks.filter(p => p.date !== today);

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
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Morning Picks
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generated automatically at 9:00 AM ET each trading day using your pattern analysis.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Today */}
      {todayPick ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Today</p>
          <PickAccordion pick={todayPick} defaultOpen />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-sm font-medium text-foreground">No picks yet for today</p>
          <p className="text-xs text-muted-foreground">
            The AI agent runs automatically at 9:00 AM ET on trading days.<br />
            Make sure you have at least 3 days of manual picks analyzed on the Watchlist page.
          </p>
        </div>
      )}

      {/* History */}
      {pastPicks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">History</p>
          {pastPicks.map(p => <PickAccordion key={p.id} pick={p} />)}
        </div>
      )}

      {picks.length === 0 && !error && (
        <div className="text-center py-10 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto opacity-20 mb-3" />
          <p className="text-sm font-medium text-foreground">No AI picks yet</p>
          <p className="text-xs mt-1">
            Log picks on the Watchlist page for 3+ days, run Pattern Analysis, then wait for 9:00 AM ET tomorrow.
          </p>
        </div>
      )}
    </div>
  );
}
