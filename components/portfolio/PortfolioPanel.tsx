"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, ArrowUpRight, ArrowDownRight, Link2, RefreshCw, TrendingUp, StickyNote, Bitcoin } from "lucide-react";
import { useSymbolNotes } from "@/components/notes/useSymbolNotes";
import { NoteStar } from "@/components/notes/NoteStar";
import { SymbolNoteDialog } from "@/components/notes/SymbolNoteDialog";

interface Position {
  symbol:       string;
  quantity:     number;
  marketValue:  number;
  dayChange:    number;
  dayChangePct: number | null;
  assetType:    string;
}

type Timeframe = "1D" | "1W" | "1M" | "YTD" | "ALL";

interface Data {
  connected:  boolean;
  totalValue: number;
  dayChange:  number;
  positions:  Position[];
  returns:    Record<Timeframe, number | null>;
}

interface CryptoAsset {
  id:            string;
  name:          string;
  currency:      string;
  balance:       number;
  nativeBalance: number;
}

interface CryptoData {
  connected: boolean;
  accounts:  CryptoAsset[];
  totalUsd:  number;
}

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "YTD", "ALL"];

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// The portfolio's "Notes" side view — notes on the symbols you hold.
function PortfolioNotes({
  positions, notes, onEdit,
}: {
  positions: Position[];
  notes: Record<string, { body: string }>;
  onEdit: (symbol: string) => void;
}) {
  const held = positions.map(p => p.symbol);
  const withNotes = held.filter(s => notes[s]?.body);

  if (withNotes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <StickyNote className="h-7 w-7 mx-auto opacity-30 mb-2" />
        <p className="text-sm font-medium text-foreground">No holding notes yet</p>
        <p className="text-xs mt-1">
          Switch to Holdings and tap the note icon next to a symbol to jot something down.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {withNotes.map(sym => (
        <button
          key={sym}
          onClick={() => onEdit(sym)}
          className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-bold text-primary text-sm font-mono">{sym}</span>
            <StickyNote className="h-3 w-3 text-amber-400" />
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notes[sym].body}</p>
        </button>
      ))}
    </div>
  );
}

export function PortfolioPanel() {
  const [data, setData]         = useState<Data | null>(null);
  const [crypto, setCrypto]     = useState<CryptoData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tf, setTf]             = useState<Timeframe>("1D");
  const [view, setView]         = useState<"holdings" | "notes">("holdings");
  const [editSym, setEditSym]   = useState<string | null>(null);

  const { notes, save, remove } = useSymbolNotes();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [schwabRes, coinbaseRes] = await Promise.all([
        fetch("/api/brokers/schwab/positions"),
        fetch("/api/brokers/coinbase/balances"),
      ]);
      const schwabJson = await schwabRes.json();
      if (!schwabRes.ok) throw new Error(schwabJson.error ?? "Failed to load portfolio");
      setData(schwabJson);

      if (coinbaseRes.ok) {
        const coinbaseJson = await coinbaseRes.json();
        setCrypto(coinbaseJson);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Link2 className="h-8 w-8 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Schwab isn&apos;t connected</p>
          <p className="text-xs mt-1">Connect your Schwab account to see your portfolio here.</p>
        </div>
        <Link href="/dashboard"><Button variant="outline" size="sm">Connect in Preferences</Button></Link>
      </div>
    );
  }

  const ret = data.returns[tf];
  const up  = (ret ?? 0) >= 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Headline */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Portfolio value</p>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <div className="text-3xl md:text-4xl font-bold font-mono mt-1">{money(data.totalValue)}</div>

        {ret == null ? (
          <p className="text-xs text-muted-foreground mt-1.5">
            {tf === "1D" ? "No change data yet." : "Not enough history for this range yet — it fills in daily."}
          </p>
        ) : (
          <div className={cn("flex items-center gap-1.5 mt-1.5 text-sm font-medium", up ? "text-profit" : "text-loss")}>
            {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {up ? "+" : ""}{ret.toFixed(2)}%
            {tf === "1D" && (
              <span className="text-muted-foreground font-normal">
                ({data.dayChange >= 0 ? "+" : ""}{money(data.dayChange)} today)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        {TIMEFRAMES.map(t => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              tf === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Holdings / Notes toggle */}
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["holdings", "notes"] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-3 py-1 rounded text-xs font-medium capitalize transition-colors flex items-center gap-1.5",
              view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "notes" && <StickyNote className="h-3 w-3" />}
            {v}
          </button>
        ))}
      </div>

      {view === "holdings" ? (
        <div>
          {data.positions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No open positions.</p>
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {data.positions.map(p => {
                const pUp = (p.dayChangePct ?? 0) >= 0;
                return (
                  <div key={p.symbol} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0 flex items-center gap-1.5">
                      <Link href={`/stocks/${p.symbol}`} className="font-bold text-primary hover:underline text-sm">
                        {p.symbol}
                      </Link>
                      <NoteStar body={notes[p.symbol]?.body} onClick={() => setEditSym(p.symbol)} />
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {p.quantity.toLocaleString()} sh
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{money(p.marketValue)}</div>
                      {p.dayChangePct != null && (
                        <div className={cn("text-[11px] font-medium flex items-center justify-end gap-0.5", pUp ? "text-profit" : "text-loss")}>
                          {pUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {pUp ? "+" : ""}{p.dayChangePct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <PortfolioNotes
          positions={data.positions}
          notes={notes}
          onEdit={setEditSym}
        />
      )}

      {/* Crypto section — only when Coinbase is connected and has non-zero balances */}
      {crypto?.connected && crypto.accounts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Bitcoin className="h-3.5 w-3.5 text-[#F7931A]" />
            <p className="text-xs font-semibold">Crypto · Coinbase</p>
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {money(crypto.totalUsd)}
            </span>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {crypto.accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm font-mono text-primary">{a.currency}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {a.balance.toLocaleString("en-US", { maximumSignificantDigits: 6 })} {a.currency}
                  </span>
                </div>
                <span className="font-mono text-sm">{money(a.nativeBalance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3" />
        Stock holdings via Schwab. Longer return windows build up from daily snapshots.
      </p>

      <SymbolNoteDialog
        symbol={editSym}
        initial={editSym ? notes[editSym]?.body ?? "" : ""}
        onClose={() => setEditSym(null)}
        onSave={(sym, b) => save(sym, b, "portfolio")}
        onDelete={(sym)  => remove(sym)}
      />
    </div>
  );
}
