"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bot, Plus, Bell, Trash2, Play, Pause, Clock, Loader2, Inbox, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentChatDialog } from "./AgentChatDialog";
import type { Agent, AgentAlert } from "@/lib/types";

type AlertRow = AgentAlert & { agents?: { name: string } | null };

interface Props {
  initialAgents: Agent[];
  initialAlerts: AlertRow[];
}

const CONVICTION_STYLES: Record<string, string> = {
  high:   "text-profit border-profit/30 bg-profit/5",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/5",
  low:    "text-muted-foreground border-border bg-muted/40",
};

export function AgentsPage({ initialAgents, initialAlerts }: Props) {
  const [agents, setAgents]   = useState<Agent[]>(initialAgents);
  const [alerts, setAlerts]   = useState<AlertRow[]>(initialAlerts);
  const [chatOpen, setChatOpen] = useState(false);
  const [busyId, setBusyId]   = useState<string | null>(null);

  const unread = alerts.filter(a => !a.is_read).length;

  // ── Agent actions ───────────────────────────────────────────────────────────

  async function toggleStatus(agent: Agent) {
    const next = agent.status === "active" ? "paused" : "active";
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAgents(prev => prev.map(a => a.id === agent.id ? updated : a));
      }
    } finally { setBusyId(null); }
  }

  async function deleteAgent(id: string) {
    if (!confirm("Delete this agent? Its alerts will be removed too.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== id));
        setAlerts(prev => prev.filter(a => a.agent_id !== id));
      }
    } finally { setBusyId(null); }
  }

  // ── Alert actions ───────────────────────────────────────────────────────────

  async function markAllRead() {
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    await fetch("/api/agent-alerts", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ all: true }),
    });
  }

  async function clearAlerts() {
    if (!confirm("Clear all agent alerts?")) return;
    setAlerts([]);
    await fetch("/api/agent-alerts", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ all: true }),
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="agents" className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Agents</h1>
          </div>
          <TabsList className="h-8 shrink-0">
            <TabsTrigger value="agents" className="text-xs gap-1.5">
              <Bot className="h-3.5 w-3.5" /> My Agents
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Alerts
              {unread > 0 && (
                <span className="ml-0.5 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
                  {unread}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── My Agents ─────────────────────────────────────────────────────── */}
        <TabsContent value="agents" className="flex-1 min-h-0 overflow-auto mt-0 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {agents.length === 0
                ? "Agents watch the market and your portfolio, and speak up only when it matters."
                : `${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
            </p>
            <Button size="sm" onClick={() => setChatOpen(true)} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" /> New Agent
            </Button>
          </div>

          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Bot className="h-10 w-10 opacity-30" />
              <div className="text-center max-w-sm">
                <p className="text-sm font-medium text-foreground">No agents yet</p>
                <p className="text-xs mt-1">
                  Describe what you want watched in plain English — a moving-average break, a thesis
                  crack, upcoming earnings risk — and it&apos;ll be turned into an agent.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                Build your first agent
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {agents.map(agent => {
                const triggers = (agent.spec?.triggers as string[] | undefined) ?? [];
                return (
                  <div key={agent.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{agent.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] shrink-0",
                              agent.status === "active"
                                ? "text-profit border-profit/30"
                                : "text-muted-foreground"
                            )}
                          >
                            {agent.status}
                          </Badge>
                        </div>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title={agent.status === "active" ? "Pause" : "Resume"}
                          onClick={() => toggleStatus(agent)}
                          disabled={busyId === agent.id}
                        >
                          {busyId === agent.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : agent.status === "active"
                              ? <Pause className="h-3.5 w-3.5" />
                              : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          onClick={() => deleteAgent(agent.id)}
                          disabled={busyId === agent.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {triggers.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground space-y-0.5">
                        {triggers.slice(0, 3).map((t, i) => <li key={i} className="truncate">· {t}</li>)}
                        {triggers.length > 3 && <li className="opacity-60">+{triggers.length - 3} more</li>}
                      </ul>
                    )}

                    {agent.schedule && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border">
                        <Clock className="h-3 w-3" /> {agent.schedule}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {agents.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-6 border-t border-border pt-3">
              Scheduled execution isn&apos;t live yet — agents are saved and ready, and their alerts will
              appear in the Alerts tab once running is enabled.
            </p>
          )}
        </TabsContent>

        {/* ── Alerts ────────────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="flex-1 min-h-0 overflow-auto mt-0 p-4 md:p-6">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <div className="text-center max-w-sm">
                <p className="text-sm font-medium text-foreground">No alerts yet</p>
                <p className="text-xs mt-1">
                  When your agents run and find something worth flagging, their notes land here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
                  {unread > 0 && ` · ${unread} unread`}
                </p>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={markAllRead}>
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={clearAlerts}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {alerts.map(a => (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-lg border p-3.5",
                      a.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.symbol && <span className="font-bold text-primary text-sm">{a.symbol}</span>}
                          <p className="font-medium text-sm">{a.title}</p>
                          {a.conviction && (
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                              CONVICTION_STYLES[a.conviction] ?? CONVICTION_STYLES.low
                            )}>
                              {a.conviction}
                            </span>
                          )}
                        </div>
                        {a.body && (
                          <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{a.body}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {a.agents?.name && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Bot className="h-3 w-3" /> {a.agents.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <AgentChatDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onCreated={agent => setAgents(prev => [agent, ...prev])}
      />
    </div>
  );
}
