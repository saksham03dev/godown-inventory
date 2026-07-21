"use client";

import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { BagCountNumpad } from "@/components/scan/BagCountNumpad";
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
        <div className="mt-4">
          <BagCountNumpad
            value={customQty}
            onChange={onCustomQtyChange}
            disabled={disabled}
            max={BAGS_PER_BALE}
            hint={`Bags per scan (1–${BAGS_PER_BALE.toLocaleString()})`}
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
