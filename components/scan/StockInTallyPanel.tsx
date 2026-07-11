"use client";

import { RotateCcw } from "lucide-react";
import type { StockInTallyState } from "@/lib/types/scan";

interface StockInTallyPanelProps {
  tally: StockInTallyState;
  onReset: () => void;
}

export function StockInTallyPanel({ tally, onReset }: StockInTallyPanelProps) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-success">
            Stock In Tally
          </p>
          <p className="mt-1 text-3xl font-bold text-zinc-100">
            {tally.sessionTotal}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              label{tally.sessionTotal !== 1 ? "s" : ""} scanned this session
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-xl border border-surface-border px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {tally.byProduct.length > 0 && (
        <ul className="space-y-2 border-t border-success/20 pt-3">
          {tally.byProduct.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <p className="font-medium text-zinc-200">{item.productName}</p>
                <p className="text-xs text-zinc-500">{item.productCode}</p>
              </div>
              <span className="rounded-lg bg-success/15 px-2.5 py-1 font-semibold text-success">
                {item.count} scanned
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
