"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link2Off, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Connection { created_at: string; updated_at: string }

export function CoinbaseConnect() {
  const [connected,  setConnected]  = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [open,       setOpen]       = useState(false);
  const [keyName,    setKeyName]    = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [result,     setResult]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => { checkStatus(); }, []);

  async function checkStatus() {
    setLoading(true);
    try {
      const res  = await fetch("/api/brokers/coinbase/status");
      const data = await res.json();
      setConnected(data.connected);
      setConnection(data.connection);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!keyName.trim() || !privateKey.trim()) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch("/api/brokers/coinbase/save-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ keyName: keyName.trim(), privateKey: privateKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to connect"); return; }
      setResult("Coinbase connected successfully.");
      setConnected(true);
      setConnection({ created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setOpen(false);
      setKeyName("");
      setPrivateKey("");
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Coinbase? Your API key will be removed from Glade Deck.")) return;
    setLoading(true);
    await fetch("/api/brokers/coinbase/disconnect", { method: "DELETE" });
    setConnected(false);
    setConnection(null);
    setResult(null);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-[#0052FF]/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#0052FF]">CB</span>
          </div>
          <div>
            <p className="text-sm font-medium">Coinbase</p>
            {connected && connection && (
              <p className="text-[10px] text-muted-foreground">
                Connected {new Date(connection.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        {connected ? (
          <Badge className="gap-1 bg-profit/10 text-profit border border-profit/20 hover:bg-profit/10">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {connected ? (
          <Button size="sm" variant="ghost" onClick={disconnect}
            className="gap-1.5 text-muted-foreground hover:text-destructive">
            <Link2Off className="h-3.5 w-3.5" /> Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)} className="gap-1.5">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Cancel" : "Connect Coinbase"}
          </Button>
        )}
      </div>

      {/* Paste-key form */}
      {open && !connected && (
        <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Go to <strong>coinbase.com → Settings → API</strong>, create a key with{" "}
            <strong>View (read-only)</strong> permission, then paste both values below.
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Key Name</label>
            <Input
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="organizations/…/apiKeys/…"
              className="text-xs font-mono h-8"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Private Key</label>
            <Textarea
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
              placeholder={"-----BEGIN EC PRIVATE KEY-----\n…\n-----END EC PRIVATE KEY-----"}
              rows={4}
              className="text-[11px] font-mono resize-none"
            />
          </div>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !keyName.trim() || !privateKey.trim()}
            className="w-full gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Verifying…" : "Save & Connect"}
          </Button>
        </div>
      )}

      {result && (
        <p className={cn("flex items-center gap-1.5 text-xs", "text-profit")}>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {result}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {connected && (
        <p className="text-[10px] text-muted-foreground">
          Shows your crypto balances in Portfolio. Read-only — Glade Deck cannot trade on your behalf.
        </p>
      )}
    </div>
  );
}
