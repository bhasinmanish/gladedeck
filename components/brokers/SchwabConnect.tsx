"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Link2Off, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Connection {
  account_hash: string | null;
  created_at:   string;
  updated_at:   string;
}

export function SchwabConnect() {
  const [connected,  setConnected]  = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    checkStatus();

    // Show result from OAuth redirect query param
    const params = new URLSearchParams(window.location.search);
    const schwab = params.get("schwab");
    if (schwab === "connected") setSyncResult("Schwab connected successfully.");
    if (schwab === "error")     setError("Failed to connect Schwab. Try again.");
    if (schwab) {
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("schwab");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function checkStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/brokers/schwab/status");
      const data = await res.json();
      setConnected(data.connected);
      setConnection(data.connection);
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    window.location.href = "/api/brokers/schwab/connect";
  }

  async function disconnect() {
    if (!confirm("Disconnect Schwab? Your existing synced trades won't be deleted.")) return;
    setLoading(true);
    await fetch("/api/brokers/schwab/disconnect", { method: "DELETE" });
    setConnected(false);
    setConnection(null);
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res  = await fetch("/api/brokers/schwab/sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ days: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncResult(
        data.synced > 0
          ? `Synced ${data.synced} new trade${data.synced !== 1 ? "s" : ""} from the last 90 days.`
          : data.message ?? "No new trades found."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Schwab logo placeholder */}
          <div className="h-8 w-8 rounded bg-[#00A3E0]/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#00A3E0]">SCH</span>
          </div>
          <div>
            <p className="text-sm font-medium">Charles Schwab</p>
            {connected && connection && (
              <p className="text-[10px] text-muted-foreground">
                Last synced {new Date(connection.updated_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <Badge className="gap-1 bg-profit/10 text-profit border border-profit/20 hover:bg-profit/10">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          )}
          {!connected && (
            <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {connected ? (
          <>
            <Button
              size="sm" variant="outline"
              onClick={sync} disabled={syncing}
              className="gap-1.5"
            >
              {syncing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…</>
                : <><RefreshCw className="h-3.5 w-3.5" /> Sync Trades</>
              }
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={disconnect}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Link2Off className="h-3.5 w-3.5" /> Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={connect} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Connect Schwab
          </Button>
        )}
      </div>

      {syncResult && (
        <div className={cn("flex items-center gap-1.5 text-xs", "text-profit")}>
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {syncResult}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {connected && (
        <p className="text-[10px] text-muted-foreground">
          Syncs filled orders from the last 90 days into your Trade Log.
          Existing trades are not duplicated.
        </p>
      )}
    </div>
  );
}
