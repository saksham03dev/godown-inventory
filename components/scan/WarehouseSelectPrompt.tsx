"use client";

import { MapPin } from "lucide-react";

interface WarehouseSelectPromptProps {
  className?: string;
}

/** Prominent prompt shown before stock-in scanning until a warehouse is chosen. */
export function WarehouseSelectPrompt({ className }: WarehouseSelectPromptProps) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/10 px-5 py-5 ring-1 ring-accent/20 ${className ?? ""}`}
      role="status"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20">
        <MapPin className="h-8 w-8 text-accent" aria-hidden />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-base font-semibold text-zinc-100">
          Pick warehouse first
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Choose where you are receiving stock, then scan labels.
        </p>
      </div>
    </div>
  );
}
