"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Users, TrendingUp, Bell, BellRing, Eye, Lightbulb,
  CalendarCheck, BarChart2, ChevronRight, Loader2, ShieldCheck, Tag,
  Bot, Sparkles, CreditCard, Plug,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FeaturePricing } from "@/components/admin/FeaturePricing";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserSummary {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
}

interface UserDetail extends UserSummary {
  stats: {
    trades:          number;
    alerts:          number;
    price_alerts:    number;
    watchlists:      number;
    strategies:      number;
    trade_ideas:     number;
    daily_summaries: number;
    agents:          number;
    agent_alerts:    number;
  };
  subscriptions: { feature_key: string; status: string; current_period_end: string | null }[];
  brokers:       { broker: string; last_synced: string | null }[];
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color,
}: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
      <div className={cn("p-2 rounded-md bg-muted/50", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-mono">{value}</p>
      </div>
    </div>
  );
}

// ── User list item ────────────────────────────────────────────────────────────

function UserRow({
  user, selected, onClick,
}: { user: UserSummary; selected: boolean; onClick: () => void }) {
  const joined   = new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const lastSeen = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Never";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border flex items-center gap-3 transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/50"
      )}
    >
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-xs font-bold uppercase">
          {user.email?.charAt(0) ?? "?"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{user.email}</p>
        <p className="text-[10px] text-muted-foreground">
          Joined {joined} · Last active {lastSeen}
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ userId }: { userId: string }) {
  const [detail, setDetail]   = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    fetch(`/api/admin/users/${userId}`)
      .then(r => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Failed to load user details.
      </div>
    );
  }

  const joined   = new Date(detail.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const lastSeen = detail.last_sign_in_at
    ? new Date(detail.last_sign_in_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "Never";

  const STATS = [
    { label: "Trades",         value: detail.stats.trades,          icon: TrendingUp,   color: "text-emerald-400" },
    { label: "Strategies",     value: detail.stats.strategies,      icon: BarChart2,    color: "text-blue-400"    },
    { label: "AI Agents",      value: detail.stats.agents,          icon: Bot,          color: "text-primary"     },
    { label: "Agent Alerts",   value: detail.stats.agent_alerts,    icon: Sparkles,     color: "text-fuchsia-400" },
    { label: "Price Alerts",   value: detail.stats.price_alerts,    icon: BellRing,     color: "text-amber-400"   },
    { label: "Alert History",  value: detail.stats.alerts,          icon: Bell,         color: "text-orange-400"  },
    { label: "Watchlists",     value: detail.stats.watchlists,      icon: Eye,          color: "text-cyan-400"    },
    { label: "Trade Ideas",    value: detail.stats.trade_ideas,     icon: Lightbulb,    color: "text-yellow-400"  },
    { label: "Daily Reviews",  value: detail.stats.daily_summaries, icon: CalendarCheck, color: "text-violet-400" },
  ];

  const totalActivity = Object.values(detail.stats).reduce((a, b) => a + b, 0);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
          <span className="text-lg font-bold uppercase">{detail.email?.charAt(0) ?? "?"}</span>
        </div>
        <div>
          <h2 className="text-base font-bold">{detail.email}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">
              {detail.provider}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{detail.id.slice(0, 8)}…</span>
          </div>
        </div>
      </div>

      {/* Account info */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Account Info
        </h3>
        <div className="rounded-lg border border-border divide-y divide-border">
          {[
            { label: "Joined",      value: joined   },
            { label: "Last Active", value: lastSeen  },
            { label: "Auth Method", value: detail.provider.replace("_", " ") },
            { label: "User ID",     value: detail.id },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center px-3 py-2 gap-4">
              <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
              <span className="text-xs font-mono truncate">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Subscriptions & connections */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Subscriptions &amp; Connections
        </h3>
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-start px-3 py-2.5 gap-4">
            <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Paid
            </span>
            <div className="min-w-0 flex-1">
              {detail.subscriptions.length === 0 ? (
                <span className="text-xs text-muted-foreground">Free — no active subscriptions</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.subscriptions.map(s => (
                    <span
                      key={s.feature_key}
                      className="text-[10px] font-medium px-2 py-0.5 rounded border border-profit/30 bg-profit/5 text-profit"
                    >
                      {s.feature_key}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start px-3 py-2.5 gap-4">
            <span className="text-xs text-muted-foreground w-24 shrink-0 flex items-center gap-1.5">
              <Plug className="h-3.5 w-3.5" /> Brokers
            </span>
            <div className="min-w-0 flex-1">
              {detail.brokers.length === 0 ? (
                <span className="text-xs text-muted-foreground">None connected</span>
              ) : (
                detail.brokers.map(b => (
                  <div key={b.broker} className="text-xs capitalize">
                    {b.broker}
                    {b.last_synced && (
                      <span className="text-muted-foreground">
                        {" "}· last synced {new Date(b.last_synced).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Activity overview */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Activity
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {totalActivity} total record{totalActivity !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminPortal() {
  const [users, setUsers]         = useState<UserSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then((data: UserSummary[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setUsers(sorted);
        if (sorted.length > 0) setSelectedId(sorted[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="accounts" className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-border shrink-0 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Admin Portal</h1>
        {!loading && (
          <span className="text-xs text-muted-foreground ml-1">
            {users.length} account{users.length !== 1 ? "s" : ""}
          </span>
        )}
        <TabsList className="h-8 ml-auto shrink-0">
          <TabsTrigger value="accounts" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Feature Pricing
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="accounts" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=active]:flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No accounts found.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: user list */}
          <div className="w-full md:w-72 lg:w-80 border-r border-border overflow-y-auto shrink-0 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-muted/30 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                All Accounts
              </p>
            </div>
            {users.map(u => (
              <UserRow
                key={u.id}
                user={u}
                selected={selectedId === u.id}
                onClick={() => setSelectedId(u.id)}
              />
            ))}
          </div>

          {/* Right: detail */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {selectedId ? (
              <DetailPanel key={selectedId} userId={selectedId} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select an account to view details.
              </div>
            )}
          </div>

        </div>
      )}
      </TabsContent>

      <TabsContent value="pricing" className="flex-1 min-h-0 overflow-hidden mt-0 data-[state=active]:flex flex-col">
        <FeaturePricing />
      </TabsContent>

      </Tabs>
    </div>
  );
}
