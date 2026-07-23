"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Loader2, AlertCircle } from "lucide-react";

interface Props {
  symbol:   string | null;   // open when non-null
  initial:  string;
  onClose:  () => void;
  onSave:   (symbol: string, body: string) => Promise<boolean>;
  onDelete: (symbol: string) => Promise<boolean>;
}

export function SymbolNoteDialog({ symbol, initial, onClose, onSave, onDelete }: Props) {
  const [body, setBody]     = useState(initial);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => { setBody(initial); setError(null); }, [initial, symbol]);

  const open = symbol !== null;
  const hadNote = initial.trim().length > 0;

  async function handleSave() {
    if (!symbol || !body.trim()) return;
    setBusy(true);
    setError(null);
    const ok = await onSave(symbol, body.trim());
    setBusy(false);
    if (ok) onClose();
    else setError("Couldn’t save the note. If this keeps happening, the notes table may not be set up yet.");
  }

  async function handleDelete() {
    if (!symbol) return;
    setBusy(true);
    setError(null);
    const ok = await onDelete(symbol);
    setBusy(false);
    if (ok) onClose();
    else setError("Couldn’t delete the note.");
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Note · <span className="font-mono text-primary">{symbol}</span>
          </DialogTitle>
        </DialogHeader>

        <Textarea
          autoFocus
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          placeholder="e.g. Sell when it crosses 2000"
          className="resize-none text-sm"
        />

        {error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {hadNote ? (
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={handleDelete}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button size="sm" disabled={busy || !body.trim()} onClick={handleSave} className="gap-1.5">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
