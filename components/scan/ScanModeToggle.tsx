"use client";

import { Eye } from "lucide-react";
import type { ScanMode } from "@/lib/types/scan";

interface ScanModeToggleProps {
  mode: ScanMode;
  onChange: (mode: ScanMode) => void;
  disabled?: boolean;
  showViewLabel?: boolean;
}

export function ScanModeToggle({
  mode,
  onChange,
  disabled,
  showViewLabel = false,
}: ScanModeToggleProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-1">
      <div
        className={`grid gap-1 ${showViewLabel ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("STOCK_IN")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
            mode === "STOCK_IN"
              ? "bg-success/20 text-success shadow-sm shadow-success/10"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Stock In
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("STOCK_OUT")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
            mode === "STOCK_OUT"
              ? "bg-danger/20 text-danger shadow-sm shadow-danger/10"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Stock Out
        </button>
        {showViewLabel && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("VIEW_LABEL")}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${
              mode === "VIEW_LABEL"
                ? "bg-accent/20 text-accent shadow-sm shadow-accent/10"
                : "text-zinc-500 hover:text-zinc-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Eye className="h-4 w-4" />
            View Label
          </button>
        )}
      </div>
    </div>
  );
}
