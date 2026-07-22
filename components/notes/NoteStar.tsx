"use client";

import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

// Small note indicator shown next to a ticker. Filled/amber when a note
// exists (hover shows it via the title tooltip), faint otherwise.
export function NoteStar({
  body, onClick,
}: { body?: string; onClick: () => void }) {
  const has = !!body;
  return (
    <button
      onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      title={has ? body : "Add a note"}
      className={cn(
        "shrink-0 transition-colors align-middle",
        has ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground/25 hover:text-muted-foreground"
      )}
      aria-label={has ? "Edit note" : "Add note"}
    >
      <StickyNote className={cn("h-3.5 w-3.5", has && "fill-amber-400/20")} />
    </button>
  );
}
