"use client";

import { useState, useEffect, useCallback } from "react";
import type { Note } from "@/lib/types";

// Loads the user's per-symbol notes into a { SYMBOL: Note } map and exposes
// save / remove helpers. Shared by any surface that lists tickers.
export function useSymbolNotes() {
  const [notes, setNotes] = useState<Record<string, Note>>({});

  useEffect(() => {
    fetch("/api/notes?scope=symbol")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Note[]) => {
        const map: Record<string, Note> = {};
        rows.forEach(n => { if (n.symbol) map[n.symbol] = n; });
        setNotes(map);
      })
      .catch(() => {});
  }, []);

  // Returns true on success, false on failure — so callers can surface errors.
  const save = useCallback(async (symbol: string, body: string, source = "symbol"): Promise<boolean> => {
    try {
      const res = await fetch("/api/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ symbol, body, source }),
      });
      if (!res.ok) return false;
      const note: Note = await res.json();
      setNotes(prev => ({ ...prev, [symbol.toUpperCase()]: note }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const remove = useCallback(async (symbol: string): Promise<boolean> => {
    const note = notes[symbol.toUpperCase()];
    if (!note) return true;
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setNotes(prev => {
        const next = { ...prev };
        delete next[symbol.toUpperCase()];
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }, [notes]);

  return { notes, save, remove };
}
