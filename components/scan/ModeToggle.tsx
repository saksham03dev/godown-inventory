"use client";

import type { TransactionType } from "@/lib/types/database";

interface ModeToggleProps {
  mode: TransactionType;
  onChange: (mode: TransactionType) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const isStockIn = mode === "STOCK_IN";

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-1">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("STOCK_IN")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            isStockIn
              ? "bg-success/20 text-success shadow-sm shadow-success/10"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          STOCK IN 🟢
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("STOCK_OUT")}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            !isStockIn
              ? "bg-danger/20 text-danger shadow-sm shadow-danger/10"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          STOCK OUT 🔴
        </button>
      </div>
    </div>
  );
}
