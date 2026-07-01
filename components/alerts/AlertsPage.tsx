"use client";

import { useState, useEffect } from "react";
import {
  Bell, BellOff, BellRing, Trash2, Plus,
  TrendingUp, BookOpen, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Alert, PriceAlert, Watchlist } from "@/lib/types";
import { CreateAlertDialog, ALERT_FIELD_LABELS } from "@/components/alerts/CreateAlertDialog";

// ─── Alert metadata ───────────────────────────────────────────────────────────

type AlertSection = "news" | "scanner" | "price";

const ALERT_META: Record<string, { label: string; dot: string; section: AlertSection }> = {
  news_earnings:   { label: "Earnings",   dot: "bg-purple-400", section: "news"    },
  news_fda:        { label: "FDA",         dot: "bg-pink-400",   section: "news"    },
  news_ma:         { label: "M&A",         dot: "bg-green-400",  section: "news"    },
  news_analyst:    { label: "Analyst",     dot: "bg-cyan-400",   section: "news"    },
  news_regulatory: { label: "Regulatory",  dot: "bg-red-400",    section: "news"    },
  news_corporate:  { label: "Corporate",   dot: "bg-indigo-400", section: "news"    },
  news_general:    { label: "News",        dot: "bg-gray-400",   section: "news"    },
  scanner_entry:   { label: "Scanner",     dot: "bg-blue-400",   section: "scanner" },
  high_rvol:       { label: "High RVOL",   dot: "bg-orange-400", section: "scanner" },
  big_gap:         { label: "Big Gap",     dot: "bg-yellow-400", section: "scanner" },
  price_alert:     { label: "Price Alert", dot: "bg-primary",    section: "price"   },
};

function getMeta(type: string) {
  return ALERT_META[type] ?? { label: type, dot: "bg-gray-400", section: "news" as AlertSection };
}

const COND_LABELS: Record<string, string> = {
  above:         "Is Above",
  below:         "Is Below",
  crosses_above: "Crosses Above",
  crosses_below: "Crosses Below",
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-0.5 font-mono", color ?? "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ─── Alert rule card ──────────────────────────────────────────────────────────

function AlertRuleCard({
  alert, watchlists, onToggle, onDelete,
}: {
  alert: PriceAlert;
  watchlists: Watchlist[];
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isWatchlist = !alert.symbol;
  const target = alert.symbol
    ?? watchlists.find(w => w.id === alert.watchlist_id)?.name
    ?? "Unknown";
  const fieldLabel = ALERT_FIELD_LABELS[alert.field] ?? alert.field;
  const condLabel  = COND_LABELS[alert.condition] ?? alert.condition;

  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 transition-opacity",
      !alert.is_active && "opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-2 w-2 rounded-full mt-1.5 shrink-0",
          alert.is_active ? "bg-profit" : "bg-muted-foreground"
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {isWatchlist
                ? <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                : <TrendingUp className="h-3.5 w-3.5 text-primary" />
              }
              <span className="font-semibold text-sm">{target}</span>
            </div>
            {isWatchlist && (
              <Badge variant="outline" className="text-[10px] py-0">watchlist</Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] py-0 ml-auto",
                alert.is_active ? "text-profit border-profit/30" : "text-muted-foreground"
              )}
            >
              {alert.is_active ? "Active" : "Paused"}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <p className="text-sm">
              <span className="text-muted-foreground">{fieldLabel}</span>
              {" "}
              <span className="font-medium">{condLabel}</span>
              {" "}
              <span className="font-mono text-primary">{alert.value}</span>
            </p>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">
              {alert.trigger_mode === "once" ? "Once only" : "Every time"}
            </span>
          </div>

          {alert.last_triggered_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Last triggered{" "}
              {formatDistanceToNow(new Date(alert.last_triggered_at), { addSuffix: true })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle(alert.id, alert.is_active)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={alert.is_active ? "Pause alert" : "Resume alert"}
          >
            {alert.is_active
              ? <BellOff className="h-4 w-4" />
              : <Bell className="h-4 w-4" />
            }
          </button>
          <button
            onClick={() => onDelete(alert.id)}
            className="p-1 rounded text-muted-foreground hover:text-loss hover:bg-muted/50 transition-colors"
            title="Delete alert"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity row ─────────────────────────────────────────────────────────────

function ActivityRow({ a }: { a: Alert }) {
  const meta = getMeta(a.type);
  return (
    <div className={cn(
      "flex items-start gap-3 p-3.5 rounded-lg border transition-colors",
      a.is_read
        ? "border-border bg-transparent"
        : "border-primary/25 bg-primary/5"
    )}>
      <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", meta.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
            {meta.label}
          </Badge>
          {a.symbol && (
            <span className="font-semibold text-sm">{a.symbol}</span>
          )}
          {!a.is_read && (
            <span className="ml-auto text-[10px] text-primary font-medium">New</span>
          )}
        </div>
        {a.condition && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {a.condition}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(a.triggered_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "my_alerts" | "activity";
type ActivityFilter = "all" | "news" | "scanner" | "price";

interface Props {
  priceAlerts: PriceAlert[];
  activityAlerts: Alert[];
  userId: string;
  watchlists: Watchlist[];
}

export function AlertsPage({
  priceAlerts: initialPA,
  activityAlerts: initialAA,
  userId,
  watchlists,
}: Props) {
  const [tab,            setTab]            = useState<Tab>("my_alerts");
  const [priceAlerts,    setPriceAlerts]    = useState<PriceAlert[]>(initialPA);
  const [activityAlerts, setActivityAlerts] = useState<Alert[]>(initialAA);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [dialogOpen,     setDialogOpen]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("alerts-page-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `user_id=eq.${userId}` },
        payload => setActivityAlerts(prev => [payload.new as Alert, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const today          = new Date().toDateString();
  const active         = priceAlerts.filter(a => a.is_active).length;
  const paused         = priceAlerts.filter(a => !a.is_active).length;
  const triggeredToday = priceAlerts.filter(a =>
    a.last_triggered_at && new Date(a.last_triggered_at).toDateString() === today
  ).length;
  const unreadCount = activityAlerts.filter(a => !a.is_read).length;

  const newsCt    = activityAlerts.filter(a => getMeta(a.type).section === "news").length;
  const scannerCt = activityAlerts.filter(a => getMeta(a.type).section === "scanner").length;
  const priceCt   = activityAlerts.filter(a => getMeta(a.type).section === "price").length;

  const filteredActivity = activityAlerts.filter(a => {
    if (activityFilter === "all")     return true;
    const s = getMeta(a.type).section;
    if (activityFilter === "news")    return s === "news";
    if (activityFilter === "scanner") return s === "scanner";
    if (activityFilter === "price")   return s === "price";
    return true;
  });

  const sortedRules = [...priceAlerts].sort(
    (a, b) => Number(b.is_active) - Number(a.is_active)
  );

  async function toggleAlert(id: string, isActive: boolean) {
    const res = await fetch("/api/price-alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    if (res.ok) setPriceAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !isActive } : a));
  }

  async function deleteAlert(id: string) {
    const res = await fetch(`/api/price-alerts?id=${id}`, { method: "DELETE" });
    if (res.ok) setPriceAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setActivityAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-5 overflow-hidden">
      {/* Page header */}
      <div className="shrink-0">
        <h1 className="text-xl md:text-2xl font-bold">Alerts</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your price alerts and view notification history.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-border shrink-0">
        {([
          {
            key:        "my_alerts" as Tab,
            icon:       BellRing,
            label:      "My Alerts",
            badge:      active > 0 ? String(active) : null,
            badgeClass: "bg-primary/20 text-primary",
          },
          {
            key:        "activity" as Tab,
            icon:       Bell,
            label:      "Activity",
            badge:      unreadCount > 0 ? String(unreadCount) : null,
            badgeClass: "bg-destructive/80 text-destructive-foreground",
          },
        ]).map(({ key, icon: Icon, label, badge, badgeClass }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge && (
              <span className={cn("text-[10px] px-1.5 rounded-full font-medium", badgeClass)}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Alerts ───────────────────────────────────────────────────────── */}
      {tab === "my_alerts" && (
        <div className="flex-1 min-h-0 overflow-auto space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Active"          value={active}         color="text-profit" />
            <StatCard label="Paused"           value={paused} />
            <StatCard label="Triggered Today" value={triggeredToday} color={triggeredToday > 0 ? "text-primary" : undefined} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {priceAlerts.length === 0
                ? "No alerts configured yet."
                : `${priceAlerts.length} alert${priceAlerts.length !== 1 ? "s" : ""} configured`
              }
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Alert
            </Button>
          </div>

          {priceAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-border rounded-lg text-muted-foreground">
              <BellOff className="h-8 w-8" />
              <p className="text-sm font-medium">No price alerts yet</p>
              <p className="text-xs text-center max-w-xs">
                Create alerts for individual stocks or entire watchlists.
                You&apos;ll be notified when price, RVOL, RSI, or other conditions are met.
              </p>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="mt-2 gap-2">
                <Plus className="h-4 w-4" /> Create Your First Alert
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedRules.map(alert => (
                <AlertRuleCard
                  key={alert.id}
                  alert={alert}
                  watchlists={watchlists}
                  onToggle={toggleAlert}
                  onDelete={deleteAlert}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity ─────────────────────────────────────────────────────────── */}
      {tab === "activity" && (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                ["all",     "All",           activityAlerts.length],
                ["news",    "Breaking News", newsCt],
                ["scanner", "Scanner",       scannerCt],
                ["price",   "Your Alerts",  priceCt],
              ] as [ActivityFilter, string, number][]).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setActivityFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    activityFilter === key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  )}
                >
                  {label}
                  <span className={cn(
                    "text-[10px] rounded-full px-1.5",
                    activityFilter === key ? "bg-primary/20" : "bg-muted"
                  )}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read ({unreadCount})
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto space-y-2">
            {filteredActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 border border-dashed border-border rounded-lg text-muted-foreground">
                <Bell className="h-8 w-8" />
                <p className="text-sm">No alerts in this category</p>
              </div>
            ) : (
              filteredActivity.map(a => <ActivityRow key={a.id} a={a} />)
            )}
          </div>
        </div>
      )}

      <CreateAlertDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={alert => setPriceAlerts(prev => [alert, ...prev])}
        watchlists={watchlists}
      />
    </div>
  );
}
