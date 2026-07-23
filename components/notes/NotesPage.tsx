"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen, Plus, Trash2, Loader2, StickyNote, Hash, AlertCircle } from "lucide-react";
import { useSymbolNotes } from "./useSymbolNotes";
import { SymbolNoteDialog } from "./SymbolNoteDialog";
import type { Note } from "@/lib/types";

// Columns for the By-Symbol board, in display order. Anything that isn't one
// of the named sources lands in "Other".
const COLUMNS: { key: string; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "trade_log", label: "Trade Log" },
  { key: "orders",    label: "Orders" },
  { key: "other",     label: "Other" },
];

function columnFor(source: string): string {
  return ["portfolio", "trade_log", "orders"].includes(source) ? source : "other";
}

// A single free-form note that autosaves when you click away.
function GeneralNoteCard({
  note, onPatch, onDelete,
}: { note: Note; onPatch: (id: string, body: string) => void; onDelete: (id: string) => void }) {
  const [body, setBody] = useState(note.body);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onBlur={() => { if (body !== note.body) onPatch(note.id, body); }}
        rows={3}
        placeholder="Write anything…"
        className="resize-none text-sm border-0 focus-visible:ring-0 p-0 bg-transparent shadow-none"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground">
          {new Date(note.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button
          onClick={() => onDelete(note.id)}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Delete note"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function NotesPage() {
  const [general, setGeneral] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editSym, setEditSym] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const { notes: symbolMap, save, remove } = useSymbolNotes();
  const symbolNotes = Object.values(symbolMap).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  useEffect(() => {
    fetch("/api/notes?scope=general")
      .then(r => (r.ok ? r.json() : []))
      .then(setGeneral)
      .finally(() => setLoading(false));
  }, []);

  async function addGeneral() {
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: "" }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Couldn’t create the note. The notes table may not be set up yet.");
        return;
      }
      const created: Note = await res.json();
      setGeneral(g => [created, ...g]);
    } catch {
      setError("Couldn’t reach the server.");
    }
  }

  async function patchGeneral(id: string, body: string) {
    await fetch(`/api/notes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
    });
    setGeneral(g => g.map(n => (n.id === id ? { ...n, body } : n)));
  }

  async function deleteGeneral(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setGeneral(g => g.filter(n => n.id !== id));
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="notepad" className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Notes</h1>
          </div>
          <TabsList className="h-8 shrink-0">
            <TabsTrigger value="notepad" className="text-xs gap-1.5">
              <NotebookPen className="h-3.5 w-3.5" /> Notepad
            </TabsTrigger>
            <TabsTrigger value="symbols" className="text-xs gap-1.5">
              <Hash className="h-3.5 w-3.5" /> By Symbol
              {symbolNotes.length > 0 && (
                <span className="ml-0.5 text-[10px] bg-muted-foreground/20 rounded-full px-1.5 leading-none">
                  {symbolNotes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Notepad */}
        <TabsContent value="notepad" className="flex-1 min-h-0 overflow-auto mt-0 p-4 md:p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Your scratchpad — anything that isn&apos;t tied to a specific ticker.
              </p>
              <Button size="sm" onClick={addGeneral} className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> New note
              </Button>
            </div>

            {error && (
              <p className="flex items-start gap-1.5 text-xs text-destructive mb-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : general.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <NotebookPen className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium text-foreground">Nothing here yet</p>
                <p className="text-xs mt-1">Tap “New note” to start writing.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {general.map(n => (
                  <GeneralNoteCard key={n.id} note={n} onPatch={patchGeneral} onDelete={deleteGeneral} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* By Symbol — a column per area; click a ticker to see its note */}
        <TabsContent value="symbols" className="flex-1 min-h-0 overflow-auto mt-0 p-4 md:p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Ticker notes grouped by where you made them. Tap a symbol to read or edit its note.
          </p>
          {symbolNotes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <StickyNote className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium text-foreground">No symbol notes yet</p>
              <p className="text-xs mt-1">
                Tap the note icon next to any ticker in Portfolio, the Trade Log, or Orders to add one.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {COLUMNS.map(col => {
                const items = symbolNotes.filter(n => columnFor(n.source) === col.key);
                // Skip the catch-all "Other" column when it's empty.
                if (col.key === "other" && items.length === 0) return null;
                return (
                  <div key={col.key} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {col.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{items.length}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70 px-3 py-4 text-center">No notes</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {items.map(n => (
                          <button
                            key={n.id}
                            onClick={() => n.symbol && setEditSym(n.symbol)}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-bold text-primary text-sm font-mono">{n.symbol}</span>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SymbolNoteDialog
        symbol={editSym}
        initial={editSym ? symbolMap[editSym]?.body ?? "" : ""}
        onClose={() => setEditSym(null)}
        onSave={(sym, b) => save(sym, b, symbolMap[sym]?.source ?? "symbol")}
        onDelete={(sym)  => remove(sym)}
      />
    </div>
  );
}
