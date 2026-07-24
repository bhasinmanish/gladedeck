"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  GripVertical, TrendingUp, Bell, Receipt,
  CalendarCheck, Lightbulb, Eye, Send, Check, Timer, Plug, CreditCard,
} from "lucide-react";
import { SchwabConnect } from "@/components/brokers/SchwabConnect";
import { CoinbaseConnect } from "@/components/brokers/CoinbaseConnect";
import { cn } from "@/lib/utils";
import {
  type WidgetKey, type DashboardPrefs,
  DEFAULT_PREFS, loadPrefs, savePrefs,
} from "@/lib/dashboard-widgets";
import {
  TIMEOUT_STORAGE_KEY, DEFAULT_TIMEOUT_MIN, clampTimeout,
} from "@/components/session/SessionGuard";

// ─── Widget metadata ──────────────────────────────────────────────────────────

const WIDGET_INFO: Record<WidgetKey, {
  label: string;
  short: string;
  icon: React.ElementType;
  color: string;
}> = {
  "top-setups":   { label: "Today's Top Setups", short: "Top Setups",    icon: TrendingUp,    color: "text-blue-400"    },
  "alerts":       { label: "Alerts",              short: "Alerts",        icon: Bell,          color: "text-amber-400"   },
  "trade-log":    { label: "Trade Log",            short: "Trade Log",     icon: Receipt,       color: "text-emerald-400" },
  "daily-review": { label: "Daily Review",         short: "Daily Review",  icon: CalendarCheck, color: "text-violet-400"  },
  "ideas":        { label: "Trade Ideas",          short: "Ideas",         icon: Lightbulb,     color: "text-yellow-400"  },
  "watchlists":   { label: "Watchlists",           short: "Watchlists",    icon: Eye,           color: "text-cyan-400"    },
};

// ─── Email prefs shape ────────────────────────────────────────────────────────

const EMAIL_DEFAULTS = {
  email_enabled:      false,
  email_news:         true,
  email_scanner:      false,
  email_price_alerts: true,
  email_agents:       true,
};

const EMAIL_CATEGORIES = [
  { key: "email_news",         label: "Breaking News",    desc: "Earnings, FDA, M&A, analyst updates"   },
  { key: "email_scanner",      label: "Scanner Alerts",   desc: "High RVOL, big gap setups"             },
  { key: "email_price_alerts", label: "My Price Alerts",  desc: "Your custom price alert conditions"    },
  { key: "email_agents",       label: "Agent Alerts",     desc: "Notes from your AI agents"             },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function DashboardPreferences({ open, onClose }: Props) {
  const [prefs, setPrefs]         = useState<DashboardPrefs>(DEFAULT_PREFS);
  const [isDragging, setDragging] = useState(false);
  const dragIndex                 = useRef<number | null>(null);

  const [emailPrefs, setEmailPrefs]   = useState(EMAIL_DEFAULTS);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent]       = useState(false);
  const [testError, setTestError]     = useState<string | null>(null);
  const [timeoutMin, setTimeoutMin]   = useState(DEFAULT_TIMEOUT_MIN);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError]     = useState<string | null>(null);

  // Re-load from localStorage + fetch email prefs every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setPrefs(loadPrefs());
    setTestSent(false);
    setTestError(null);
    const stored = localStorage.getItem(TIMEOUT_STORAGE_KEY);
    setTimeoutMin(stored ? clampTimeout(parseInt(stored, 10)) : DEFAULT_TIMEOUT_MIN);

    fetch("/api/notification-prefs")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setEmailPrefs({ ...EMAIL_DEFAULTS, ...data }); })
      .catch(() => {});
  }, [open]);

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function onDragStart(index: number) {
    dragIndex.current = index;
    setDragging(true);
  }

  function onDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === targetIndex) return;
    const from = dragIndex.current;
    setPrefs(prev => {
      const next = [...prev.widgetOrder];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, widgetOrder: next };
    });
    dragIndex.current = targetIndex;
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragging(false);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function save() {
    savePrefs(prefs);
    localStorage.setItem(TIMEOUT_STORAGE_KEY, String(timeoutMin));
    try {
      await fetch("/api/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPrefs),
      });
    } catch { /* fail silently */ }
    onClose();
  }

  function reset() {
    setPrefs(DEFAULT_PREFS);
    setTimeoutMin(DEFAULT_TIMEOUT_MIN);
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res  = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      setPortalError(data.error ?? "Could not open billing portal.");
    } catch {
      setPortalError("Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function sendTestEmail() {
    setTestSending(true);
    setTestError(null);
    try {
      const res = await fetch("/api/notification-prefs/test", { method: "POST" });
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* non-JSON body */ }
      console.log("[test-email] status:", res.status, "body:", json);
      if (res.ok && json.ok) {
        setTestSent(true);
      } else {
        setTestError((json.error as string) ?? `HTTP ${res.status} — see browser console for details`);
      }
    } catch (e) {
      console.error("[test-email] fetch error:", e);
      setTestError(`Network error: ${String(e)}`);
    } finally {
      setTestSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard Preferences</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-6 py-1">

            {/* Layout */}
            <div>
              <p className="text-sm font-semibold mb-2">Layout</p>
              <div className="flex items-center gap-0.5 bg-muted p-1 rounded-lg w-fit">
                {([3, 2] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setPrefs(prev => ({ ...prev, cols: n }))}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                      prefs.cols === n
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n} columns
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {prefs.cols === 3
                  ? "All 6 widgets fit on one screen without scrolling."
                  : "Wider widgets, 3 rows — page will scroll."}
              </p>
            </div>

            {/* Widget order */}
            <div>
              <p className="text-sm font-semibold mb-1">Widget Order</p>
              <p className="text-xs text-muted-foreground mb-3">
                Drag to rearrange. Fills left-to-right, top-to-bottom.
              </p>

              {/* Live grid preview */}
              <div
                className={cn(
                  "grid gap-1 mb-4 p-2 bg-muted/40 rounded-lg border border-border",
                  prefs.cols === 3 ? "grid-cols-3" : "grid-cols-2"
                )}
              >
                {prefs.widgetOrder.map(key => {
                  const info = WIDGET_INFO[key];
                  const Icon = info.icon;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 bg-card border border-border rounded px-2 py-1.5 min-w-0"
                    >
                      <Icon className={cn("h-3 w-3 shrink-0", info.color)} />
                      <span className="text-[10px] font-medium truncate">{info.short}</span>
                    </div>
                  );
                })}
              </div>

              {/* Draggable list */}
              <div className="space-y-1.5">
                {prefs.widgetOrder.map((key, index) => {
                  const info = WIDGET_INFO[key];
                  const Icon = info.icon;
                  const isGrabbed = isDragging && dragIndex.current === index;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={e => onDragOver(e, index)}
                      onDragEnd={onDragEnd}
                      onDrop={e => e.preventDefault()}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card select-none transition-all",
                        isGrabbed
                          ? "opacity-40 border-primary/40 cursor-grabbing scale-[0.98]"
                          : "cursor-grab hover:border-primary/30 border-border"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Icon className={cn("h-4 w-4 shrink-0", info.color)} />
                      <span className="text-sm font-medium flex-1">{info.label}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted w-5 h-5 flex items-center justify-center rounded font-mono">
                        {index + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Email notifications */}
            <div>
              <p className="text-sm font-semibold mb-3">Email Notifications</p>

              {/* Master on/off toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card mb-3">
                <div>
                  <p className="text-sm font-medium">Email alerts</p>
                  <p className="text-xs text-muted-foreground">Receive alerts via email when they fire</p>
                </div>
                <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-md">
                  {(["Off", "On"] as const).map(label => {
                    const active = label === "On" ? emailPrefs.email_enabled : !emailPrefs.email_enabled;
                    return (
                      <button
                        key={label}
                        onClick={() => setEmailPrefs(p => ({ ...p, email_enabled: label === "On" }))}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                          active
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category toggles — only visible when email is enabled */}
              {emailPrefs.email_enabled && (
                <div className="space-y-1.5 mb-3">
                  {EMAIL_CATEGORIES.map(({ key, label, desc }) => {
                    const isOn = emailPrefs[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setEmailPrefs(p => ({ ...p, [key]: !p[key] }))}
                        className={cn(
                          "flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-left transition-colors",
                          isOn
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:border-border/80"
                        )}
                      >
                        <div>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{desc}</p>
                        </div>
                        <div className={cn(
                          "h-4 w-4 rounded flex items-center justify-center border shrink-0 ml-3 transition-colors",
                          isOn ? "bg-primary border-primary" : "border-muted-foreground/40"
                        )}>
                          {isOn && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Send test email */}
              {emailPrefs.email_enabled && (
                <div className="space-y-1.5">
                  <button
                    onClick={sendTestEmail}
                    disabled={testSending || testSent}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors",
                      testSent
                        ? "text-emerald-400 cursor-default"
                        : "text-primary hover:text-primary/80 disabled:opacity-50"
                    )}
                  >
                    {testSent ? (
                      <><Check className="h-3.5 w-3.5" /> Test email sent — check your inbox</>
                    ) : testSending ? (
                      "Sending..."
                    ) : (
                      <><Send className="h-3.5 w-3.5" /> Send test email</>
                    )}
                  </button>
                  {testError && (
                    <p className="text-[10px] text-red-400 leading-snug max-w-xs">{testError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Broker connections */}
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <Plug className="h-4 w-4 text-muted-foreground" /> Connected Accounts
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Link your broker to auto-import trades and view holdings.
              </p>
              <div className="space-y-4">
                <SchwabConnect />
                <div className="border-t border-border pt-4">
                  <CoinbaseConnect />
                </div>
              </div>
            </div>

            {/* Billing */}
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Subscriptions
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Manage or cancel your feature subscriptions and view invoices.
              </p>
              <Button
                variant="outline" size="sm"
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {portalLoading ? "Opening…" : "Manage subscriptions"}
              </Button>
              {portalError && <p className="text-[11px] text-muted-foreground mt-1.5">{portalError}</p>}
            </div>

            {/* Session timeout */}
            <div>
              <p className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-muted-foreground" /> Security
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Automatically sign out after this period of inactivity.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "10 min", value: 10 },
                  { label: "15 min", value: 15 },
                  { label: "30 min", value: 30 },
                  { label: "45 min", value: 45 },
                  { label: "1 hour", value: 60 },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeoutMin(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                      timeoutMin === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <button
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset to default
          </button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
