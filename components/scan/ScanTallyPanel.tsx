"use client";

import { RotateCcw } from "lucide-react";
import type { ScanTallyState } from "@/lib/types/scan";
import type { TransactionType } from "@/lib/types/database";

interface ScanTallyPanelProps {
  tally: ScanTallyState;
  mode: TransactionType;
  onReset: () => void;
}

export function ScanTallyPanel({ tally, mode, onReset }: ScanTallyPanelProps) {
  const isStockIn = mode === "STOCK_IN";
  const accent = isStockIn
    ? {
        border: "border-success/30",
        bg: "bg-success/5",
        label: "text-success",
        chip: "bg-success/15 text-success",
        divider: "border-success/20",
        title: "Stock In Tally",
      }
    : {
        border: "border-danger/30",
        bg: "bg-danger/5",
        label: "text-danger",
        chip: "bg-danger/15 text-danger",
        divider: "border-danger/20",
        title: "Stock Out Tally",
      };

  return (
    <div
      className={`rounded-2xl border ${accent.border} ${accent.bg} p-4 [overflow-anchor:none]`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-xs font-medium uppercase tracking-wider ${accent.label}`}
          >
            {accent.title}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-zinc-100">
            {tally.sessionTotal}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              this session
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-surface-border px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {tally.byProduct.length > 0 && (
        <ul
          className={`max-h-36 space-y-2 overflow-y-auto overscroll-contain border-t ${accent.divider} pt-3 scrollbar-thin`}
        >
          {tally.byProduct.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-200">
                  {item.productName}
                </p>
                <p className="text-xs text-zinc-500">{item.productCode}</p>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 font-semibold tabular-nums ${accent.chip}`}
              >
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
