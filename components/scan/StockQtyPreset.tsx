"use client";

import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type { TransactionType } from "@/lib/types/database";

export type QtyPresetMode = "full" | "custom";

interface StockQtyPresetProps {
  transactionType: TransactionType;
  preset: QtyPresetMode;
  customQty: string;
  onPresetChange: (preset: QtyPresetMode) => void;
  onCustomQtyChange: (value: string) => void;
  disabled?: boolean;
}

export function StockQtyPreset({
  transactionType,
  preset,
  customQty,
  onPresetChange,
  onCustomQtyChange,
  disabled,
}: StockQtyPresetProps) {
  const isIn = transactionType === "STOCK_IN";
  const activeLabel =
    preset === "full"
      ? isIn
        ? `Receiving ${BAGS_PER_BALE.toLocaleString()} bags per scan`
        : "Removing all remaining bags per scan"
      : isIn
        ? `Receiving ${customQty || "—"} bags per scan`
        : `Removing ${customQty || "—"} bags per scan`;

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Quantity preset
      </p>
      <p className="mt-1 text-sm text-zinc-300">{activeLabel}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPresetChange("full")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            preset === "full"
              ? "bg-accent/15 text-accent"
              : "border border-surface-border text-zinc-400 hover:bg-white/5"
          } disabled:opacity-50`}
        >
          Full
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPresetChange("custom")}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            preset === "custom"
              ? "bg-accent/15 text-accent"
              : "border border-surface-border text-zinc-400 hover:bg-white/5"
          } disabled:opacity-50`}
        >
          Custom
        </button>
      </div>
      {preset === "custom" && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs text-zinc-500">
            Bags per scan (1–{BAGS_PER_BALE.toLocaleString()})
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={customQty}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) onCustomQtyChange(v);
            }}
            disabled={disabled}
            placeholder={isIn ? "650" : "200"}
            className="w-full max-w-xs rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}

/** Resolve API bagsQty: null = full (server default). */
export function resolvePresetBagsQty(
  preset: QtyPresetMode,
  customQty: string
): number | null {
  if (preset === "full") return null;
  const n = Math.floor(Number(customQty));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}
