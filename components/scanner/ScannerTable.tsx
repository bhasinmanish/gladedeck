"use client";

import { useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, RefreshCw } from "lucide-react";
import { formatPercent } from "@/lib/utils";
import type { ScanResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "gap_pct" | "rvol" | "atr" | "change_pct" | "price";

interface Props {
  results: ScanResult[];
}

export function ScannerTable({ results: initial }: Props) {
  const [results, setResults] = useState<ScanResult[]>(initial);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rvol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const sectors = Array.from(new Set(results.map((r) => r.sector).filter(Boolean))) as string[];

  const filtered = results
    .filter((r) => {
      const matchesSearch = r.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesSector = sectorFilter === "all" || r.sector === sectorFilter;
      return matchesSearch && matchesSector;
    })
    .sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      return dir * (a[sortKey] - b[sortKey]);
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/scanner", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    return (
      <button
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {sectors.length > 0 && (
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {loading ? "Scanning…" : "Refresh"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} stock{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">
                <SortHeader label="Price" field="price" />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader label="Chg%" field="change_pct" />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader label="Gap%" field="gap_pct" />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader label="RVOL" field="rvol" />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader label="ATR" field="atr" />
              </TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Catalyst</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {results.length === 0
                    ? "Scanner hasn't run yet today. Click Refresh to trigger a scan."
                    : "No results match your filters."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/stocks/${r.symbol}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {r.symbol}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${r.price.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono", r.change_pct >= 0 ? "text-profit" : "text-loss")}>
                    {formatPercent(r.change_pct)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono", r.gap_pct >= 0 ? "text-profit" : "text-loss")}>
                    {formatPercent(r.gap_pct)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.rvol.toFixed(1)}x</TableCell>
                  <TableCell className="text-right font-mono">${r.atr.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-xs">{r.sector ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    {r.catalyst_tag ? (
                      <Badge variant="outline" className="text-xs">
                        {r.catalyst_tag}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
