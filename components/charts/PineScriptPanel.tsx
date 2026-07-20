"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, Copy, Check, Loader2, Trash2, Save, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedScript {
  id: string;
  name: string;
  code: string;
  language: "pine" | "thinkscript";
  createdAt: string;
}

const STORAGE_KEY = "glade_pine_scripts";

function loadScripts(): SavedScript[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function persistScripts(scripts: SavedScript[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

// ── Saved script row ──────────────────────────────────────────────────────────

function SavedRow({
  script, onDelete,
}: { script: SavedScript; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(script.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="flex-1 text-xs font-medium truncate">{script.name}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {script.language === "pine" ? "Pine v5" : "ThinkScript"}
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        }
      </div>

      {expanded && (
        <div className="border-t border-border">
          <div className="flex items-center justify-end gap-1 px-2 py-1 bg-muted/20">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={copy}>
              {copied
                ? <><Check className="h-3 w-3" /> Copied</>
                : <><Copy className="h-3 w-3" /> Copy</>
              }
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive"
              onClick={e => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          </div>
          <pre className="px-3 py-2 text-[10px] font-mono whitespace-pre-wrap leading-5 bg-muted/10 overflow-x-auto max-h-48">
            {script.code}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function PineScriptPanel({ locked = false, price = 0 }: { locked?: boolean; price?: number }) {
  const [prompt, setPrompt]     = useState("");
  const [language, setLanguage] = useState<"pine" | "thinkscript">("pine");
  const [output, setOutput]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [open, setOpen]         = useState(false);

  const [saveName, setSaveName] = useState("");
  const [saving, setSaving]     = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [saved, setSaved]       = useState<SavedScript[]>([]);

  useEffect(() => {
    setSaved(loadScripts());
  }, []);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput("");
    setError(null);
    setSaveName("");
    try {
      const res = await fetch("/api/pine-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Server error ${res.status}`);
        return;
      }
      const data = await res.json();
      setOutput(data.code ?? "");
      setSaveName(prompt.slice(0, 40).trim());
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveScript() {
    if (!output || !saveName.trim()) return;
    setSaving(true);
    const script: SavedScript = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      code: output,
      language,
      createdAt: new Date().toISOString(),
    };
    const next = [script, ...saved];
    persistScripts(next);
    setSaved(next);
    setSaving(false);
    setSaveName("");
    setOutput("");
    setPrompt("");
  }

  function deleteScript(id: string) {
    const next = saved.filter(s => s.id !== id);
    persistScripts(next);
    setSaved(next);
  }

  async function subscribe() {
    setSubscribing(true);
    try {
      const res  = await fetch("/api/billing/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ feature_key: "pine_script" }),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else setSubscribing(false);
    } catch {
      setSubscribing(false);
    }
  }

  if (!open) {
    return (
      <div className="w-10 border-l border-border flex flex-col items-center py-4">
        <button
          onClick={() => setOpen(true)}
          title="Open Pine Script generator"
          className="p-2 rounded-md hover:bg-accent/50 transition-colors"
        >
          {locked
            ? <Lock className="h-4 w-4 text-muted-foreground" />
            : <Code2 className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="w-80 border-l border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Code2 className="h-4 w-4 text-primary" />
            Script Generator
          </span>
          <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium">Premium feature</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Subscribe to unlock the Pine Script generator.
            </p>
            <button
              onClick={subscribe}
              disabled={subscribing}
              className="mt-1 rounded-md bg-primary text-primary-foreground text-xs font-medium px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {subscribing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…</>
                : `Subscribe · $${price.toFixed(2)}/mo`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border flex flex-col shrink-0 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Code2 className="h-4 w-4 text-primary" />
          Script Generator
        </span>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">

          {/* Generator */}
          <div className="space-y-3">
            <Select value={language} onValueChange={v => setLanguage(v as "pine" | "thinkscript")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pine">Pine Script v5</SelectItem>
                <SelectItem value="thinkscript">ThinkScript</SelectItem>
              </SelectContent>
            </Select>

            <Textarea
              placeholder='e.g. "Alert when 9 EMA crosses above 20 EMA on 15-min chart"'
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="text-sm min-h-[80px] resize-none"
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            />

            <Button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="w-full"
              size="sm"
            >
              {loading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Generating…</>
                : "Generate ⌘↵"
              }
            </Button>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* Output */}
          {output && (
            <div className="space-y-2 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                <span className="text-xs font-medium text-muted-foreground">Output</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={copy}>
                  {copied
                    ? <><Check className="h-3 w-3" /> Copied</>
                    : <><Copy className="h-3 w-3" /> Copy</>
                  }
                </Button>
              </div>
              <pre className="px-3 py-2 text-[10px] font-mono whitespace-pre-wrap leading-5 max-h-48 overflow-y-auto">
                {output}
              </pre>

              {/* Save */}
              <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                <Input
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Script name…"
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={saveScript}
                  disabled={saving || !saveName.trim()}
                >
                  <Save className="h-3.5 w-3.5" /> Save Script
                </Button>
              </div>
            </div>
          )}

          {/* Saved scripts */}
          {saved.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Saved Scripts ({saved.length})
              </p>
              {saved.map(s => (
                <SavedRow
                  key={s.id}
                  script={s}
                  onDelete={() => deleteScript(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
