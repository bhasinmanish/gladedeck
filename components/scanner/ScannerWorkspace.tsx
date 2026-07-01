"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight,
  Filter, Columns3, ArrowUpDown, ArrowUp, ArrowDown, X,
} from "lucide-react";
import {
  FILTER_FIELDS, OPERATORS, ALL_COLUMNS, COLUMN_PRESETS, PAGE_SIZES, DEFAULT_PRESETS,
  type FilterRule, type ScannerPreset, type ColumnDef,
} from "@/lib/scanner-config";

// ─── Result type ──────────────────────────────────────────────────────────────

export type ScanResultRich = {
  symbol: string;
  price: number;
  change_pct: number;
  gap_pct: number;
  change_from_open: number | null;
  rvol: number;
  atr: number;
  volume: number | null;
  avg_volume: number | null;
  perf_1w: number | null;
  perf_1m: number | null;
  market_cap: number | null;
  float_shares: number | null;
  sector: string | null;
  catalyst_tag: string | null;
  eps: number | null;
  pe: number | null;
  roe: number | null;
  debt_equity: number | null;
  gross_margin: number | null;
  net_margin: number | null;
  beta: number | null;
  rsi: number | null;
  short_ratio: number | null;
};

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const STORAGE_KEY = "glade_scanner_presets_v2";
const ACTIVE_KEY  = "glade_scanner_active_v2";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Cell formatter ───────────────────────────────────────────────────────────

function fmtCell(value: unknown, col: ColumnDef): { text: string; colorClass?: string } {
  if (value == null) return { text: "—" };
  const n = Number(value);
  if (Number.isNaN(n) && col.format !== "text") return { text: "—" };

  switch (col.format) {
    case "price":
      return { text: `$${n.toFixed(2)}` };
    case "percent":
      return {
        text: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
        colorClass: n >= 0 ? "text-profit" : "text-loss",
      };
    case "multiple":
      return { text: `${n.toFixed(1)}x` };
    case "volume":
      return {
        text:
          n >= 1e9 ? `${(n / 1e9).toFixed(1)}B`
          : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
          : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K`
          : n.toFixed(0),
      };
    case "market_cap":
      return {
        text:
          n >= 1e12 ? `$${(n / 1e12).toFixed(1)}T`
          : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B`
          : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
          : `$${n.toFixed(0)}`,
      };
    case "number":
      return { text: n.toFixed(2) };
    case "text":
      return { text: String(value) };
    default:
      return { text: String(value) };
  }
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export function ScannerWorkspace() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [presets, setPresets]     = useState<ScannerPreset[]>(DEFAULT_PRESETS);
  const [activeId, setActiveId]   = useState<string>(DEFAULT_PRESETS[0].id);
  const [results, setResults]     = useState<ScanResultRich[]>([]);
  const [totalCount, setTotal]    = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [scanned, setScanned]     = useState(false);
  const [showFilters, setShowF]   = useState(true);
  const [showColumns, setShowC]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName]   = useState("");
  const [sortKey, setSortKey]     = useState("rvol");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");
  const editRef = useRef<HTMLInputElement>(null);

  // ── Load from localStorage after hydration ─────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPresets(JSON.parse(raw) as ScannerPreset[]);
    } catch {}
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved) setActiveId(saved);
  }, []);

  // ── Persist to localStorage ────────────────────────────────────────────────

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
  }, [presets]);

  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  // ── Keep activeId valid ────────────────────────────────────────────────────

  useEffect(() => {
    if (presets.length > 0 && !presets.find(p => p.id === activeId)) {
      setActiveId(presets[0].id);
    }
  }, [presets, activeId]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const preset = (presets.find(p => p.id === activeId) ?? presets[0]) as ScannerPreset;
  const activeColumns = ALL_COLUMNS.filter(c => c.always || preset.columns.includes(c.key));
  const totalPages = preset ? Math.ceil(totalCount / preset.pageSize) : 0;
  const startRow = page * preset.pageSize + 1;
  const endRow   = Math.min((page + 1) * preset.pageSize, totalCount);

  const sortedResults = [...results].sort((a, b) => {
    const av = ((a as Record<string, unknown>)[sortKey] as number) ?? 0;
    const bv = ((b as Record<string, unknown>)[sortKey] as number) ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  // ── Preset mutations ───────────────────────────────────────────────────────

  function patch(id: string, diff: Partial<ScannerPreset>) {
    setPresets(ps => ps.map(p => p.id === id ? { ...p, ...diff } : p));
  }

  function addPreset() {
    const p: ScannerPreset = {
      id: uid(),
      name: "New Scanner",
      filters: [{ id: uid(), field: "gap", op: "greater", value: 3 }],
      columns: COLUMN_PRESETS.default.columns,
      sortBy: "relative_volume_10d_calc",
      sortOrder: "desc",
      pageSize: 50,
    };
    setPresets(ps => [...ps, p]);
    setActiveId(p.id);
    setEditingId(p.id);
    setEditName(p.name);
  }

  function deletePreset(id: string) {
    if (presets.length === 1) return;
    const rest = presets.filter(p => p.id !== id);
    setPresets(rest);
    if (activeId === id) setActiveId(rest[0].id);
  }

  function commitRename() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) patch(editingId, { name: trimmed });
    setEditingId(null);
  }

  // ── Filter mutations ───────────────────────────────────────────────────────

  function addFilter() {
    patch(preset.id, {
      filters: [...preset.filters, { id: uid(), field: "gap", op: "greater", value: 3 }],
    });
  }

  function patchFilter(fid: string, diff: Partial<FilterRule>) {
    patch(preset.id, {
      filters: preset.filters.map(f => f.id === fid ? { ...f, ...diff } : f),
    });
  }

  function removeFilter(fid: string) {
    patch(preset.id, { filters: preset.filters.filter(f => f.id !== fid) });
  }

  // ── Column mutations ───────────────────────────────────────────────────────

  function toggleColumn(key: string) {
    const cols = preset.columns.includes(key)
      ? preset.columns.filter(c => c !== key)
      : [...preset.columns, key];
    patch(preset.id, { columns: cols });
  }

  function applyColPreset(pk: string) {
    patch(preset.id, { columns: COLUMN_PRESETS[pk].columns });
  }

  // ── Sort ───────────────────────────────────────────────────────────────────

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ── Scan ───────────────────────────────────────────────────────────────────

  async function runScan(targetPage = 0) {
    setLoading(true);
    setPage(targetPage);
    try {
      const mapped = preset.filters.map(f => ({
        left: f.field,
        operation: f.op,
        right: Number(f.value),
      }));
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: mapped.length > 0 ? mapped : null,
          page: targetPage,
          page_size: preset.pageSize,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results ?? []);
        setTotal(data.total_count ?? data.count ?? 0);
        setScanned(true);
      } else {
        setResults([]);
        setScanned(true);
        alert(`Scan failed: ${data.error ?? res.status}${data.detail ? "\n\n" + data.detail : ""}`);
      }
    } catch (e) {
      setResults([]);
      setScanned(true);
      alert(`Scan error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!preset) return null;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Preset tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-3">
        {presets.map(p => (
          <div
            key={p.id}
            onClick={() => { if (editingId !== p.id) { setActiveId(p.id); setShowC(false); } }}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm cursor-pointer border transition-colors select-none",
              p.id === activeId
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {editingId === p.id ? (
              <input
                ref={editRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={e => e.stopPropagation()}
                className="bg-transparent outline-none w-28 text-sm"
              />
            ) : (
              <span
                onDoubleClick={e => {
                  e.stopPropagation();
                  setActiveId(p.id);
                  setEditingId(p.id);
                  setEditName(p.name);
                }}
                title="Double-click to rename"
              >
                {p.name}
              </span>
            )}
            {presets.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deletePreset(p.id); }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-destructive transition-opacity"
                title="Delete preset"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPreset}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowF(v => !v)}
          className="gap-2 h-8"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          <span className="bg-primary/20 text-primary text-[10px] px-1.5 rounded-full font-medium">
            {preset.filters.length}
          </span>
        </Button>

        <Button
          variant={showColumns ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowC(v => !v)}
          className="gap-2 h-8"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </Button>

        <Select
          value={String(preset.pageSize)}
          onValueChange={v => patch(preset.id, { pageSize: Number(v) })}
        >
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map(s => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={() => runScan(0)} disabled={loading} className="gap-2 h-8">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Scanning…" : "Run Scan"}
        </Button>

        {scanned && totalCount > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {startRow}–{endRow} of {totalCount.toLocaleString()} stocks
          </span>
        )}
      </div>

      {/* ── Filter editor ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Active Filters{preset.filters.length > 0 && ` (${preset.filters.length})`}
            </p>
            <button
              onClick={addFilter}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Filter
            </button>
          </div>

          {preset.filters.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No filters — will return all stocks.</p>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {preset.filters.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-5 text-right shrink-0 tabular-nums">
                  {i + 1}.
                </span>

                {/* Field — grouped by category */}
                <Select value={f.field} onValueChange={v => patchFilter(f.id, { field: v })}>
                  <SelectTrigger className="flex-1 min-w-0 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {((() => {
                      const groups: Record<string, typeof FILTER_FIELDS[number][]> = {};
                      for (const ff of FILTER_FIELDS) {
                        (groups[ff.category] ??= []).push(ff);
                      }
                      return Object.entries(groups).map(([cat, fields]) => (
                        <SelectGroup key={cat}>
                          <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground py-1.5 pl-3">
                            {cat}
                          </SelectLabel>
                          {fields.map(ff => (
                            <SelectItem key={ff.key} value={ff.key} className="text-xs pl-6">
                              {ff.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ));
                    })())}
                  </SelectContent>
                </Select>

                {/* Operator */}
                <Select value={f.op} onValueChange={v => patchFilter(f.id, { op: v })}>
                  <SelectTrigger className="w-14 h-8 text-xs font-mono shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(op => (
                      <SelectItem key={op.key} value={op.key} className="text-xs font-mono">
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value */}
                <Input
                  type="number"
                  value={f.value}
                  onChange={e => patchFilter(f.id, { value: Number(e.target.value) })}
                  className="w-24 h-8 text-xs font-mono shrink-0"
                />

                <button
                  onClick={() => removeFilter(f.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remove filter"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Column picker ─────────────────────────────────────────────────── */}
      {showColumns && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Columns
            </p>
            <div className="flex gap-1.5">
              {Object.entries(COLUMN_PRESETS).map(([k, cp]) => (
                <button
                  key={k}
                  onClick={() => applyColPreset(k)}
                  className="px-2.5 py-0.5 rounded text-[10px] border border-border hover:bg-muted/60 hover:text-foreground text-muted-foreground transition-colors"
                >
                  {cp.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ALL_COLUMNS.filter(c => !c.always).map(col => {
              const active = preset.columns.includes(col.key);
              return (
                <label key={col.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleColumn(col.key)}
                    className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                  />
                  <span className={cn("text-xs", active ? "text-foreground" : "text-muted-foreground")}>
                    {col.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results table ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border flex-1 min-h-0 overflow-auto">
        <div className="overflow-x-auto min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              {activeColumns.map(col => (
                <TableHead
                  key={col.key}
                  className={cn(col.align === "right" ? "text-right" : "text-left")}
                >
                  {col.format === "symbol" || col.format === "badge" || col.format === "text" ? (
                    col.label
                  ) : (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      {col.label}
                      {sortKey === col.key
                        ? sortDir === "desc"
                          ? <ArrowDown className="h-3 w-3" />
                          : <ArrowUp className="h-3 w-3" />
                        : <ArrowUpDown className="h-3 w-3 opacity-30" />
                      }
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedResults.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={activeColumns.length}
                  className="text-center py-16 text-muted-foreground text-sm"
                >
                  {scanned
                    ? "No stocks matched your filters."
                    : "Configure your filters above and click Run Scan."}
                </TableCell>
              </TableRow>
            ) : (
              sortedResults.map(r => (
                <TableRow key={r.symbol} className="hover:bg-muted/20">
                  {activeColumns.map(col => {
                    if (col.key === "symbol") {
                      return (
                        <TableCell key="symbol">
                          <Link
                            href={`/stocks/${r.symbol}`}
                            className="font-bold text-primary hover:underline"
                          >
                            {r.symbol}
                          </Link>
                        </TableCell>
                      );
                    }
                    if (col.format === "badge") {
                      const val = (r as Record<string, unknown>)[col.key] as string | null;
                      return (
                        <TableCell key={col.key}>
                          {val
                            ? <Badge variant="outline" className="text-xs">{val}</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                      );
                    }
                    const raw = (r as Record<string, unknown>)[col.key];
                    const { text, colorClass } = fmtCell(raw, col);
                    return (
                      <TableCell
                        key={col.key}
                        className={cn(
                          col.align === "right" && "text-right font-mono text-sm",
                          colorClass,
                        )}
                      >
                        {text}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline" size="sm"
            onClick={() => runScan(page - 1)}
            disabled={page === 0 || loading}
            className="gap-1 h-8"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>

          <div className="flex items-center gap-1">
            {buildPageNums(page, totalPages).map((n, i) =>
              n === -1 ? (
                <span key={`ellipsis-${i}`} className="text-muted-foreground text-xs px-1">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => runScan(n)}
                  className={cn(
                    "w-7 h-7 rounded text-xs transition-colors",
                    n === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {n + 1}
                </button>
              )
            )}
          </div>

          <Button
            variant="outline" size="sm"
            onClick={() => runScan(page + 1)}
            disabled={page >= totalPages - 1 || loading}
            className="gap-1 h-8"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page number builder ──────────────────────────────────────────────────────

function buildPageNums(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: number[] = [];
  pages.push(0);
  if (current > 3) pages.push(-1); // ellipsis
  for (let i = Math.max(1, current - 2); i <= Math.min(total - 2, current + 2); i++) {
    pages.push(i);
  }
  if (current < total - 4) pages.push(-1); // ellipsis
  pages.push(total - 1);
  return pages;
}
