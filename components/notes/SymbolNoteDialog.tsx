"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";

interface Props {
  symbol:   string | null;   // open when non-null
  initial:  string;
  onClose:  () => void;
  onSave:   (symbol: string, body: string) => void;
  onDelete: (symbol: string) => void;
}

export function SymbolNoteDialog({ symbol, initial, onClose, onSave, onDelete }: Props) {
  const [body, setBody] = useState(initial);

  useEffect(() => { setBody(initial); }, [initial, symbol]);

  const open = symbol !== null;
  const hadNote = initial.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
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

        <DialogFooter className="gap-2 sm:justify-between">
          {hadNote ? (
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => { if (symbol) onDelete(symbol); }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={!body.trim()}
              onClick={() => { if (symbol) onSave(symbol, body.trim()); }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
