"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search, Loader2, Link2, ChevronUp, ChevronDown, ChevronsUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderView {
  orderId:        string;
  symbol:         string;
  instruction:    string;
  orderType:      string;
  quantity:       number;
  filledQuantity: number;
  price:          number | null;
  status:         string;
  enteredTime:    string;
  closeTime:      string | null;
  account:        string;
}

type Category = "working" | "filled" | "canceled" | "rejected" | "expired";
type SortKey = "symbol" | "type" | "qty" | "price" | "status" | "date";
type SortDir = "asc" | "desc";

function titleCase(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function category(status: string): Category {
  const s = status.toUpperCase();
  if (s === "FILLED")   return "filled";
  if (s === "CANCELED") return "canceled";
  if (s === "REJECTED") return "rejected";
  if (s === "EXPIRED")  return "expired";
  return "working"; // WORKING / QUEUED / ACCEPTED / PENDING_* / AWAITING_* / NEW / …
}

function statusClass(status: string): string {
  switch (category(status)) {
    case "filled":   return "text-profit border-profit/30 bg-profit/5";
    case "working":  return "text-amber-400 border-amber-400/30 bg-amber-400/5";
    case "canceled": return "text-muted-foreground border-border bg-muted/40";
    case "rejected": return "text-loss border-loss/30 bg-loss/5";
    case "expired":  return "text-muted-foreground border-border bg-muted/40";
  }
}

function sortValue(o: OrderView, key: SortKey): string | number | null {
  switch (key) {
    case "symbol": return o.symbol;
    case "type":   return o.orderType;
    case "qty":    return o.quantity;
    case "price":  return o.price;
    case "status": return o.status;
    case "date":   return o.enteredTime;
  }
}

export function OrdersWorkspace() {
  const [orders, setOrders]       = useState<OrderView[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | Category>("all");
  const [query, setQuery]               = useState("");
  const [sort, setSort]                 = useState<{ key: SortKey; dir: SortDir }>({ key: "date", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/brokers/schwab/orders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load orders");
      setConnected(data.connected);
      setOrders(data.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" || key === "price" || key === "qty" ? "desc" : "asc" }
    );
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = orders.filter(o => {
      if (statusFilter !== "all" && category(o.status) !== statusFilter) return false;
      if (q && !o.symbol.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [orders, statusFilter, query, sort]);

  // Counts per category for the filter labels.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach(o => { const k = category(o.status); c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [orders]);

  function SortHead({ label, k, align }: { label: string; k: SortKey; align?: "right" }) {
    const active = sort.key === k;
    return (
      <TableHead className={align === "right" ? "text-right" : undefined}>
        <button
          onClick={() => toggleSort(k)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors select-none",
            align === "right" && "flex-row-reverse",
            active ? "text-foreground font-semibold" : "text-muted-foreground"
          )}
        >
          {label}
          {active
            ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </TableHead>
    );
  }

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!loading && !connected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Link2 className="h-8 w-8 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium">Schwab isn&apos;t connected</p>
          <p className="text-xs mt-1">Connect your Schwab account to see your orders.</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">Open Dashboard Preferences to connect</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="h-8 pl-8 w-32 text-xs font-mono"
          />
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses ({counts.all ?? 0})</SelectItem>
            <SelectItem value="working">Working / Open ({counts.working ?? 0})</SelectItem>
            <SelectItem value="filled">Filled ({counts.filled ?? 0})</SelectItem>
            <SelectItem value="canceled">Canceled ({counts.canceled ?? 0})</SelectItem>
            <SelectItem value="rejected">Rejected ({counts.rejected ?? 0})</SelectItem>
            <SelectItem value="expired">Expired ({counts.expired ?? 0})</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <p className="text-xs text-muted-foreground mr-1">
            {visible.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
          </p>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive shrink-0">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border flex-1 min-h-0 overflow-auto">
        <div className="overflow-x-auto min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Symbol" k="symbol" />
                <TableHead>Side</TableHead>
                <SortHead label="Type"   k="type" />
                <SortHead label="Qty"    k="qty"    align="right" />
                <SortHead label="Price"  k="price"  align="right" />
                <SortHead label="Status" k="status" />
                <SortHead label="Entered" k="date" />
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    No orders found in the last 60 days.
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    No orders match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(o => {
                  const isBuy = o.instruction.includes("BUY");
                  const entered = new Date(o.enteredTime);
                  return (
                    <TableRow key={o.orderId} className="hover:bg-muted/20">
                      <TableCell>
                        <Link href={`/stocks/${o.symbol}`} className="font-bold text-primary hover:underline">
                          {o.symbol}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-medium", isBuy ? "text-profit" : "text-loss")}>
                          {titleCase(o.instruction)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{titleCase(o.orderType)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {o.filledQuantity > 0 && o.filledQuantity < o.quantity
                          ? <span>{o.filledQuantity.toLocaleString()}<span className="text-muted-foreground">/{o.quantity.toLocaleString()}</span></span>
                          : o.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {o.price != null ? `$${o.price.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-block text-[10px] font-medium px-2 py-0.5 rounded border", statusClass(o.status))}>
                          {titleCase(o.status)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {entered.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="block text-[10px] text-muted-foreground/70 font-mono">
                          {entered.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">{o.account}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
