"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, Bell, BellOff, Receipt,
  CalendarCheck, Lightbulb, Eye, ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Alert, ScanResult, Trade, TradeIdea, DailySummary, Watchlist } from "@/lib/types";
import {
  type WidgetKey, type DashboardPrefs,
  DEFAULT_PREFS, loadPrefs, PREFS_EVENT,
} from "@/lib/dashboard-widgets";

// ─── Alert metadata ───────────────────────────────────────────────────────────

const ALERT_META: Record<string, { label: string; dot: string }> = {
  news_earnings:   { label: "Earnings",    dot: "bg-purple-400"  },
  news_fda:        { label: "FDA",          dot: "bg-pink-400"    },
  news_ma:         { label: "M&A",          dot: "bg-green-400"   },
  news_analyst:    { label: "Analyst",      dot: "bg-cyan-400"    },
  news_regulatory: { label: "Regulatory",   dot: "bg-red-400"     },
  news_corporate:  { label: "Corporate",    dot: "bg-indigo-400"  },
  news_general:    { label: "News",         dot: "bg-gray-400"    },
  scanner_entry:   { label: "Scanner",      dot: "bg-blue-400"    },
  high_rvol:       { label: "High RVOL",    dot: "bg-orange-400"  },
  big_gap:         { label: "Big Gap",      dot: "bg-yellow-400"  },
  price_alert:     { label: "Price Alert",  dot: "bg-primary"     },
};
function getAlertMeta(type: string) {
  return ALERT_META[type] ?? { label: type, dot: "bg-gray-400" };
}

// ─── Widget card wrapper ──────────────────────────────────────────────────────

function WidgetCard({
  href, icon, title, badge, children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col min-h-0 h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="font-semibold text-sm truncate">{title}</span>
          {badge}
        </div>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function Chip({ n }: { n: number | string }) {
  return (
    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
      {n}
    </span>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-4">
      <div className="opacity-40">{icon}</div>
      <p className="text-xs">{label}</p>
    </div>
  );
}

// ─── Top Setups widget ────────────────────────────────────────────────────────

function TopSetupsWidget({ results }: { results: ScanResult[] }) {
  return (
    <WidgetCard
      href="/scanner"
      icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
      title="Today's Top Setups"
      badge={results.length > 0 ? <Chip n={`${results.length} today`} /> : undefined}
    >
      {results.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-5 w-5" />} label="No setups yet today" />
      ) : (
        <div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 pb-1.5 mb-1 border-b border-border text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            <span>Symbol</span>
            <span className="text-right">Gap%</span>
            <span className="text-right">RVOL</span>
            <span className="text-right">Chg%</span>
          </div>
          <div className="space-y-px">
            {results.slice(0, 6).map(r => (
              <Link
                key={r.id}
                href={`/charts?symbol=${r.symbol}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-xs items-center hover:bg-muted/40 -mx-1 px-1 py-1.5 rounded transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-semibold">{r.symbol}</span>
                  {r.catalyst_tag && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{r.catalyst_tag}</span>
                  )}
                </div>
                <span className={cn("text-right font-mono", r.gap_pct >= 0 ? "text-profit" : "text-loss")}>
                  {r.gap_pct >= 0 ? "+" : ""}{r.gap_pct.toFixed(1)}%
                </span>
                <span className="text-right text-muted-foreground">{r.rvol.toFixed(1)}x</span>
                <span className={cn("text-right font-mono", r.change_pct >= 0 ? "text-profit" : "text-loss")}>
                  {r.change_pct >= 0 ? "+" : ""}{r.change_pct.toFixed(1)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Alerts widget ────────────────────────────────────────────────────────────

function AlertsWidget({ alerts, userId }: { alerts: Alert[]; userId: string }) {
  const [live, setLive] = useState(alerts);
  const unread = live.filter(a => !a.is_read).length;

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("dash-alerts")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "alerts",
        filter: `user_id=eq.${userId}`,
      }, p => setLive(prev => [p.new as Alert, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return (
    <WidgetCard
      href="/alerts"
      icon={<Bell className="h-4 w-4 text-amber-400" />}
      title="Alerts"
      badge={unread > 0
        ? <span className="text-[10px] bg-destructive/80 text-destructive-foreground px-1.5 py-0.5 rounded-full font-medium shrink-0">{unread} new</span>
        : undefined
      }
    >
      {live.length === 0 ? (
        <EmptyState icon={<BellOff className="h-5 w-5" />} label="No new alerts" />
      ) : (
        <div className="space-y-2.5">
          {live.slice(0, 5).map(a => {
            const meta = getAlertMeta(a.type);
            return (
              <div key={a.id} className="flex items-start gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-1.5", meta.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[9px] py-0 px-1 leading-4">{meta.label}</Badge>
                    {a.symbol && <span className="text-xs font-semibold">{a.symbol}</span>}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {formatDistanceToNow(new Date(a.triggered_at), { addSuffix: true })}
                    </span>
                  </div>
                  {a.condition && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{a.condition}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Trade log widget ─────────────────────────────────────────────────────────

function TradeLogWidget({ trades }: { trades: Trade[] }) {
  const withPnl  = trades.filter(t => t.pnl != null);
  const totalPnl = withPnl.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins     = withPnl.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate  = withPnl.length > 0 ? Math.round((wins / withPnl.length) * 100) : null;

  return (
    <WidgetCard
      href="/trade-log"
      icon={<Receipt className="h-4 w-4 text-emerald-400" />}
      title="Trade Log"
      badge={trades.length > 0 ? <Chip n={`${trades.length} trades`} /> : undefined}
    >
      {trades.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} label="No trades logged yet" />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-4 pb-2 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">All-time P&L</p>
              <p className={cn("text-lg font-bold font-mono leading-tight", totalPnl >= 0 ? "text-profit" : "text-loss")}>
                {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(0)}
              </p>
            </div>
            {winRate !== null && (
              <div>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
                <p className="text-lg font-bold font-mono leading-tight">{winRate}%</p>
              </div>
            )}
          </div>
          {trades.slice(0, 4).map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="font-semibold w-14 shrink-0">{t.symbol}</span>
              <Badge
                variant="outline"
                className={cn("text-[9px] py-0 px-1 shrink-0",
                  t.side === "long" ? "text-profit border-profit/30" : "text-loss border-loss/30")}
              >
                {t.side}
              </Badge>
              <span className={cn("font-mono font-medium", (t.pnl ?? 0) >= 0 ? "text-profit" : "text-loss")}>
                {t.pnl != null
                  ? `${(t.pnl ?? 0) >= 0 ? "+" : ""}$${Math.abs(t.pnl).toFixed(0)}`
                  : "open"}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0">
                {new Date(t.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Daily review widget ──────────────────────────────────────────────────────

function DailyReviewWidget({
  summary, todayTrades,
}: {
  summary: DailySummary | null;
  todayTrades: Trade[];
}) {
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const reflectionsDone = todayTrades.filter(t =>
    t.setup_notes || t.what_went_well || t.what_went_wrong
  ).length;

  return (
    <WidgetCard
      href="/daily-review"
      icon={<CalendarCheck className="h-4 w-4 text-violet-400" />}
      title="Daily Review"
      badge={<Chip n={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} />}
    >
      {todayTrades.length === 0 && !summary ? (
        <EmptyState icon={<CalendarCheck className="h-5 w-5" />} label="No trades today" />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-4 pb-2 border-b border-border">
            <div>
              <p className="text-[10px] text-muted-foreground">Today P&L</p>
              <p className={cn("text-lg font-bold font-mono leading-tight", todayPnl >= 0 ? "text-profit" : "text-loss")}>
                {todayPnl >= 0 ? "+" : ""}${Math.abs(todayPnl).toFixed(0)}
              </p>
            </div>
            {todayTrades.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Trades</p>
                <p className="text-lg font-bold font-mono leading-tight">{todayTrades.length}</p>
              </div>
            )}
            {todayTrades.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Reflections</p>
                <p className="text-lg font-bold font-mono leading-tight">
                  {reflectionsDone}/{todayTrades.length}
                </p>
              </div>
            )}
          </div>
          {summary?.summary_text ? (
            <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
              {summary.summary_text}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No summary written yet</p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Trade ideas widget ───────────────────────────────────────────────────────

function IdeasWidget({ ideas }: { ideas: TradeIdea[] }) {
  const watching = ideas.filter(i => i.status === "watching").length;
  const active   = ideas.filter(i => i.status === "active").length;

  return (
    <WidgetCard
      href="/strategies"
      icon={<Lightbulb className="h-4 w-4 text-yellow-400" />}
      title="Trade Ideas"
      badge={ideas.length > 0
        ? <Chip n={`${watching} watching · ${active} active`} />
        : undefined
      }
    >
      {ideas.length === 0 ? (
        <EmptyState icon={<Lightbulb className="h-5 w-5" />} label="No active trade ideas" />
      ) : (
        <div className="space-y-2">
          {ideas.slice(0, 5).map(idea => (
            <div key={idea.id} className="flex items-start gap-2">
              <Badge
                variant="outline"
                className={cn("text-[9px] py-0 px-1 shrink-0 mt-0.5",
                  idea.status === "active" ? "text-profit border-profit/30" : "text-muted-foreground")}
              >
                {idea.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold">{idea.symbol}</span>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{idea.thesis}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Watchlists widget ────────────────────────────────────────────────────────

function WatchlistsWidget({ watchlists }: { watchlists: Watchlist[] }) {
  return (
    <WidgetCard
      href="/charts"
      icon={<Eye className="h-4 w-4 text-cyan-400" />}
      title="Watchlists"
      badge={watchlists.length > 0
        ? <Chip n={`${watchlists.length} list${watchlists.length !== 1 ? "s" : ""}`} />
        : undefined
      }
    >
      {watchlists.length === 0 ? (
        <EmptyState icon={<Eye className="h-5 w-5" />} label="No watchlists yet" />
      ) : (
        <div className="space-y-3">
          {watchlists.slice(0, 3).map(wl => (
            <div key={wl.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{wl.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {wl.symbols.length} symbol{wl.symbols.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {wl.symbols.slice(0, 10).map(sym => (
                  <Link
                    key={sym}
                    href={`/charts?symbol=${sym}`}
                    className="text-[10px] bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded font-mono transition-colors"
                  >
                    {sym}
                  </Link>
                ))}
                {wl.symbols.length > 10 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{wl.symbols.length - 10} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

interface Props {
  scanResults: ScanResult[];
  alerts: Alert[];
  trades: Trade[];
  dailySummary: DailySummary | null;
  tradeIdeas: TradeIdea[];
  watchlists: Watchlist[];
  userId: string;
}

export function DashboardHub({
  scanResults, alerts, trades, dailySummary, tradeIdeas, watchlists, userId,
}: Props) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs());
    const update = () => setPrefs(loadPrefs());
    window.addEventListener(PREFS_EVENT, update);
    return () => window.removeEventListener(PREFS_EVENT, update);
  }, []);

  const todayStr    = new Date().toISOString().split("T")[0];
  const todayTrades = trades.filter(t => t.entry_date === todayStr);

  const widgetMap: Record<WidgetKey, React.ReactNode> = {
    "top-setups":   <TopSetupsWidget results={scanResults} />,
    "alerts":       <AlertsWidget alerts={alerts} userId={userId} />,
    "trade-log":    <TradeLogWidget trades={trades} />,
    "daily-review": <DailyReviewWidget summary={dailySummary} todayTrades={todayTrades} />,
    "ideas":        <IdeasWidget ideas={tradeIdeas} />,
    "watchlists":   <WatchlistsWidget watchlists={watchlists} />,
  };

  return (
    <div className={cn(
      "h-full p-4 md:p-6 overflow-auto",
      prefs.cols === 3 ? "md:flex md:flex-col md:overflow-hidden" : ""
    )}>
      {/* Header */}
      <div className="shrink-0 mb-4 md:mb-5">
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {/* Widget grid */}
      <div
        className={cn(
          "grid gap-3 md:gap-4",
          prefs.cols === 3
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:flex-1 md:min-h-0"
            : "grid-cols-1 sm:grid-cols-2"
        )}
        style={prefs.cols === 3 ? { gridAutoRows: "1fr" } : undefined}
      >
        {prefs.widgetOrder.map(key => (
          <div key={key} className="min-h-0">
            {widgetMap[key]}
          </div>
        ))}
      </div>
    </div>
  );
}
