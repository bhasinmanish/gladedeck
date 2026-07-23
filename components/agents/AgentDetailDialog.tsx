"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Loader2, Plus, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentSpec, StructuredTrigger } from "@/lib/types";

// ── Display helpers ───────────────────────────────────────────────────────────

const INTERVALS = [
  { value: "5m", label: "Every 5 minutes" },
  { value: "15m", label: "Every 15 minutes" },
  { value: "30m", label: "Every 30 minutes" },
  { value: "1h", label: "Every hour" },
  { value: "4h", label: "Every 4 hours" },
  { value: "daily", label: "Once per day" },
];

const TRIGGER_TYPES = [
  { value: "sma_cross",       label: "Moving-average cross" },
  { value: "drawdown",        label: "Drop of X%" },
  { value: "gain",            label: "Gain of X%" },
  { value: "volume_spike",    label: "Volume spike" },
  { value: "earnings_within", label: "Earnings within N days" },
];

function triggerLabel(t: StructuredTrigger): string {
  switch (t.type) {
    case "sma_cross":       return `Crosses ${t.direction ?? "below"} the ${t.period ?? 200}-day SMA`;
    case "drawdown":        return `Drops ${t.pct ?? 5}% over ${t.window ?? "1d"}${t.require_volume_spike ? " on heavy volume" : ""}`;
    case "gain":            return `Gains ${t.pct ?? 5}% over ${t.window ?? "1d"}`;
    case "volume_spike":    return `Volume ${t.multiple ?? 2}x its 20-day average`;
    case "earnings_within": return `Earnings within ${t.days ?? 10} days`;
    default:                return t.type;
  }
}

function scheduleLabel(interval: string): string {
  const found = INTERVALS.find(i => i.value === interval);
  if (!found) return "Once per day";
  return interval === "daily" ? "Once per day" : `${found.label} during market hours`;
}

function defaultTrigger(type: string): StructuredTrigger {
  switch (type) {
    case "sma_cross":       return { type: "sma_cross", period: 200, direction: "below" };
    case "drawdown":        return { type: "drawdown", pct: 5, window: "1d" };
    case "gain":            return { type: "gain", pct: 5, window: "1d" };
    case "volume_spike":    return { type: "volume_spike", multiple: 2 };
    case "earnings_within": return { type: "earnings_within", days: 10 };
    default:                return { type: "sma_cross", period: 200, direction: "below" };
  }
}

// ── Read-only section helpers ─────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</h3>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="text-sm space-y-1">
      {items.map((it, i) => <li key={i} className="text-muted-foreground">· {it}</li>)}
    </ul>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  agent:    Agent | null;
  onClose:  () => void;
  onSaved:  (agent: Agent) => void;
  onDelete: (id: string) => void;
}

export function AgentDetailDialog({ agent, onClose, onSaved, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Edit state
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [interval, setInterval]       = useState("daily");
  const [cooldownValue, setCooldownValue] = useState(7);
  const [cooldownUnit, setCooldownUnit]   = useState<"hours" | "days">("days");
  const [logic, setLogic]             = useState<"any" | "all">("any");
  const [triggers, setTriggers]       = useState<StructuredTrigger[]>([]);
  const [watching, setWatching]       = useState("");
  const [context, setContext]         = useState("");
  const [suppress, setSuppress]       = useState("");
  const [outputStyle, setOutputStyle] = useState("");

  // Initialise edit state whenever the agent (or edit toggle) changes.
  useEffect(() => {
    if (!agent) return;
    const s = agent.spec ?? {};
    setName(agent.name);
    setDescription(agent.description ?? "");
    setInterval(String(s.run_interval ?? "daily"));
    if (s.cooldown_hours != null)      { setCooldownValue(Number(s.cooldown_hours)); setCooldownUnit("hours"); }
    else if (s.cooldown_days != null)  { setCooldownValue(Number(s.cooldown_days));  setCooldownUnit("days"); }
    else { setCooldownValue(7); setCooldownUnit("days"); }
    setLogic((s.trigger_logic as "any" | "all") ?? "any");
    setTriggers([...(s.structured_triggers ?? [])]);
    setWatching((s.triggers ?? []).join("\n"));
    setContext((s.context ?? []).join("\n"));
    setSuppress((s.suppress ?? []).join("\n"));
    setOutputStyle(s.output_style ?? "");
    setEditing(false);
    setError(null);
  }, [agent]);

  if (!agent) return null;
  const s = agent.spec ?? {};

  function updateTrigger(i: number, patch: Partial<StructuredTrigger>) {
    setTriggers(prev => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const toLines = (text: string) => text.split("\n").map(l => l.trim()).filter(Boolean);

  async function save() {
    if (!name.trim()) { setError("Name is required."); return; }
    if (triggers.length === 0) { setError("Add at least one trigger, or the agent can never fire."); return; }
    setSaving(true);
    setError(null);

    const spec: AgentSpec = {
      ...s,
      structured_triggers: triggers,
      trigger_logic:       triggers.length > 1 ? logic : undefined,
      run_interval:        interval as AgentSpec["run_interval"],
      triggers:            toLines(watching),
      context:             toLines(context),
      suppress:            toLines(suppress),
      output_style:        outputStyle.trim() || undefined,
      cooldown_hours:      cooldownUnit === "hours" ? cooldownValue : undefined,
      cooldown_days:       cooldownUnit === "days"  ? cooldownValue : undefined,
    };

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:        name.trim(),
          description: description.trim() || null,
          schedule:    scheduleLabel(interval),
          spec,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      onSaved(await res.json());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const structured = (s.structured_triggers ?? []) as StructuredTrigger[];
  const cooldownText = s.cooldown_hours != null
    ? `${s.cooldown_hours} hours per symbol`
    : s.cooldown_days != null
      ? `${s.cooldown_days} days per symbol`
      : "—";

  return (
    <Dialog open={!!agent} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {editing ? "Edit agent" : agent.name}
            {!editing && (
              <Badge variant="outline" className={cn("text-[10px]", agent.status === "active" ? "text-profit border-profit/30" : "text-muted-foreground")}>
                {agent.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {editing ? (
            /* ── EDIT ─────────────────────────────────────────────────────── */
            <>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>

              {/* Triggers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fires when</Label>
                  {triggers.length > 1 && (
                    <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                      {(["any", "all"] as const).map(l => (
                        <button
                          key={l}
                          onClick={() => setLogic(l)}
                          className={cn("px-2 py-0.5 rounded text-[10px] font-medium capitalize",
                            logic === l ? "bg-card shadow-sm" : "text-muted-foreground")}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {triggers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap rounded-md border border-border p-2">
                    <span className="text-xs font-medium w-full sm:w-auto">
                      {TRIGGER_TYPES.find(tt => tt.value === t.type)?.label ?? t.type}
                    </span>
                    {t.type === "sma_cross" && (
                      <>
                        <Select value={t.direction ?? "below"} onValueChange={v => updateTrigger(i, { direction: v as "above" | "below" })}>
                          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="above">above</SelectItem>
                            <SelectItem value="below">below</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="number" value={t.period ?? 200} onChange={e => updateTrigger(i, { period: Number(e.target.value) })} className="h-7 w-20 text-xs" />
                        <span className="text-xs text-muted-foreground">day SMA</span>
                      </>
                    )}
                    {(t.type === "drawdown" || t.type === "gain") && (
                      <>
                        <Input type="number" value={t.pct ?? 5} onChange={e => updateTrigger(i, { pct: Number(e.target.value) })} className="h-7 w-16 text-xs" />
                        <span className="text-xs text-muted-foreground">% over</span>
                        <Select value={t.window ?? "1d"} onValueChange={v => updateTrigger(i, { window: v as "1d" | "5d" | "1mo" })}>
                          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1d">1 day</SelectItem>
                            <SelectItem value="5d">5 days</SelectItem>
                            <SelectItem value="1mo">1 month</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    {t.type === "volume_spike" && (
                      <>
                        <Input type="number" step="0.1" value={t.multiple ?? 2} onChange={e => updateTrigger(i, { multiple: Number(e.target.value) })} className="h-7 w-16 text-xs" />
                        <span className="text-xs text-muted-foreground">x avg volume</span>
                      </>
                    )}
                    {t.type === "earnings_within" && (
                      <>
                        <Input type="number" value={t.days ?? 10} onChange={e => updateTrigger(i, { days: Number(e.target.value) })} className="h-7 w-16 text-xs" />
                        <span className="text-xs text-muted-foreground">days</span>
                      </>
                    )}
                    <button onClick={() => setTriggers(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Select value="" onValueChange={v => v && setTriggers(prev => [...prev, defaultTrigger(v)])}>
                  <SelectTrigger className="h-8 text-xs gap-1.5"><Plus className="h-3.5 w-3.5" /><span>Add trigger</span></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(tt => <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Cadence + cooldown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Runs</Label>
                  <Select value={interval} onValueChange={setInterval}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cooldown</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={cooldownValue} onChange={e => setCooldownValue(Number(e.target.value))} className="h-9 text-xs w-16" />
                    <Select value={cooldownUnit} onValueChange={v => setCooldownUnit(v as "hours" | "days")}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Watching for <span className="text-muted-foreground font-normal">(one per line)</span></Label>
                <Textarea value={watching} onChange={e => setWatching(e.target.value)} rows={3} className="resize-none text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Context <span className="text-muted-foreground font-normal">(one per line)</span></Label>
                <Textarea value={context} onChange={e => setContext(e.target.value)} rows={4} className="resize-none text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Stays quiet on <span className="text-muted-foreground font-normal">(one per line)</span></Label>
                <Textarea value={suppress} onChange={e => setSuppress(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Alert style</Label>
                <Textarea value={outputStyle} onChange={e => setOutputStyle(e.target.value)} rows={2} className="resize-none text-sm" />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </>
          ) : (
            /* ── VIEW ─────────────────────────────────────────────────────── */
            <>
              {agent.description && <p className="text-sm text-muted-foreground">{agent.description}</p>}

              {structured.length > 0 && (
                <Section label={`Fires when${structured.length > 1 ? ` (${s.trigger_logic === "all" ? "all" : "any"})` : ""}`}>
                  <Bullets items={structured.map(triggerLabel)} />
                </Section>
              )}
              {(s.triggers ?? []).length > 0 && (
                <Section label="Watching for"><Bullets items={s.triggers as string[]} /></Section>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Section label="Runs">
                  <p className="text-sm flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{agent.schedule ?? scheduleLabel(String(s.run_interval ?? "daily"))}</p>
                </Section>
                <Section label="Cooldown"><p className="text-sm">{cooldownText}</p></Section>
              </div>

              {(s.context ?? []).length > 0 && (
                <Section label="Context"><Bullets items={s.context as string[]} /></Section>
              )}
              {(s.suppress ?? []).length > 0 && (
                <Section label="Stays quiet on"><Bullets items={s.suppress as string[]} /></Section>
              )}
              {s.output_style && (
                <Section label="Alert style"><p className="text-sm text-muted-foreground">{s.output_style as string}</p></Section>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border shrink-0 sm:justify-between">
          {editing ? (
            <>
              <span />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => onDelete(agent.id)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
                <Button size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
