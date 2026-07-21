"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Sparkles, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";

interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

interface StructuredTrigger {
  type:       string;
  period?:    number;
  direction?: string;
  pct?:       number;
  window?:    string;
  multiple?:  number;
  days?:      number;
}

interface Proposal {
  name:                 string;
  description:          string;
  universe?:            string;
  universe_type?:       string;
  symbols?:             string[];
  triggers?:            string[];
  structured_triggers?: StructuredTrigger[];
  schedule?:            string;
  run_interval?:        string;
  cooldown_days?:       number;
  cooldown_hours?:      number;
  suppress?:            string[];
  context?:             string[];
  output_style?:        string;
}

// Plain-English summary of a machine-evaluable trigger.
function triggerLabel(t: StructuredTrigger): string {
  switch (t.type) {
    case "sma_cross":       return `Crosses ${t.direction ?? "below"} the ${t.period ?? 200}-day SMA`;
    case "drawdown":        return `Drops ${t.pct ?? 5}% over ${t.window ?? "1d"}`;
    case "gain":            return `Gains ${t.pct ?? 5}% over ${t.window ?? "1d"}`;
    case "volume_spike":    return `Volume ${t.multiple ?? 2}x its 20-day average`;
    case "earnings_within": return `Earnings within ${t.days ?? 10} days`;
    default:                return t.type;
  }
}

const STARTERS = [
  "Draft three agent ideas tailored to my portfolio",
  "Watch my holdings for thesis damage and only ping me when it actually matters",
  "Alert me when a watchlist name breaks its 200-day moving average, with context",
  "Watch my holdings for earnings in the next 10 days",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (agent: Agent) => void;
}

export function AgentChatDialog({ open, onClose, onCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMessages([]); setInput(""); setProposal(null); setError(null); setLoading(false);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, proposal, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setProposal(null);
    setError(null);
    setLoading(true);

    try {
      const res  = await fetch("/api/agents/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      if (data.reply) setMessages(m => [...m, { role: "assistant", content: data.reply }]);
      if (data.proposal) setProposal(data.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function createAgent() {
    if (!proposal) return;
    setCreating(true);
    setError(null);
    try {
      const { name, description, ...spec } = proposal;
      const res  = await fetch("/api/agents", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name,
          description,
          schedule: proposal.schedule ?? null,
          spec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create agent");
      onCreated(data as Agent);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create agent");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !creating) onClose(); }}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" /> Build an agent
          </DialogTitle>
        </DialogHeader>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-sm leading-relaxed">
                <p className="font-medium mb-1">What should this agent watch?</p>
                <p className="text-muted-foreground">
                  Agents can be dead simple or highly opinionated — a plain moving-average trigger, or an
                  analyst that only speaks up when your thesis actually weakens. Describe what you want in
                  your own words, or start from one of these:
                </p>
              </div>
              <div className="space-y-2">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: one sentence works great —{" "}
                <span className="text-foreground">
                  Watch [what] for [condition], check [how often], notify me with [what kind of note].
                </span>
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 ml-8"
                  : "text-foreground"
              )}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}

          {/* Agent proposal preview */}
          {proposal && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{proposal.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{proposal.description}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {proposal.universe && (
                  <Row label="Watches" value={proposal.universe} />
                )}
                {proposal.structured_triggers && proposal.structured_triggers.length > 0 && (
                  <ListRow label="Fires when" items={proposal.structured_triggers.map(triggerLabel)} />
                )}
                {proposal.triggers && proposal.triggers.length > 0 && (
                  <ListRow label="Watching for" items={proposal.triggers} />
                )}
                {proposal.schedule && (
                  <Row
                    label="Runs"
                    value={
                      proposal.run_interval && proposal.run_interval !== "daily"
                        ? `${proposal.schedule} · every ${proposal.run_interval} (market hours)`
                        : proposal.schedule
                    }
                  />
                )}
                {(proposal.cooldown_hours != null || proposal.cooldown_days != null) && (
                  <Row
                    label="Cooldown"
                    value={
                      proposal.cooldown_hours != null
                        ? `${proposal.cooldown_hours} hours per symbol`
                        : `${proposal.cooldown_days} days per symbol`
                    }
                  />
                )}
                {proposal.context && proposal.context.length > 0 && (
                  <ListRow label="Context" items={proposal.context} />
                )}
                {proposal.suppress && proposal.suppress.length > 0 && (
                  <ListRow label="Stays quiet on" items={proposal.suppress} />
                )}
                {proposal.output_style && <Row label="Alert style" value={proposal.output_style} />}
              </div>

              <Button onClick={createAgent} disabled={creating} className="w-full gap-2" size="sm">
                {creating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  : <><Check className="h-4 w-4" /> Create this agent</>}
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              placeholder="Describe the agent you want…"
              className="min-h-[44px] max-h-32 resize-none text-sm"
              disabled={loading}
            />
            <Button size="icon" onClick={() => send(input)} disabled={loading || !input.trim()} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}

function ListRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <ul className="min-w-0 space-y-0.5">
        {items.map((it, i) => <li key={i}>· {it}</li>)}
      </ul>
    </div>
  );
}
