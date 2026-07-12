"use client";

import { RotateCcw } from "lucide-react";
import { formatBagCount } from "@/lib/utils/inventory";
import type { StockInTallyState } from "@/lib/types/scan";

interface StockInTallyPanelProps {
  tally: StockInTallyState;
  onReset: () => void;
}

/** @deprecated Use ScanTallyPanel */
export function StockInTallyPanel({ tally, onReset }: StockInTallyPanelProps) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-4 [overflow-anchor:none]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-success">
            Stock In Tally
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-zinc-100">
            {formatBagCount(tally.sessionTotal)}
            <span className="ml-2 text-sm font-normal text-zinc-500">bags</span>
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
        <ul className="max-h-36 space-y-2 overflow-y-auto overscroll-contain border-t border-success/20 pt-3 scrollbar-thin">
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
              <span className="shrink-0 rounded-lg bg-success/15 px-2.5 py-1 font-semibold tabular-nums text-success">
                {formatBagCount(item.bagCount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
