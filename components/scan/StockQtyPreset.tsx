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

const PRESET_OPTIONS: { id: QtyPresetMode; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "custom", label: "Custom" },
];

export function StockQtyPreset({
  transactionType,
  preset,
  customQty,
  onPresetChange,
  onCustomQtyChange,
  disabled,
}: StockQtyPresetProps) {
  const isIn = transactionType === "STOCK_IN";
  const fullHint = isIn
    ? `${BAGS_PER_BALE.toLocaleString()} bags per scan`
    : "All remaining per scan";

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Quantity preset
      </p>
      <div
        className="mt-3 grid grid-cols-2 gap-2"
        role="group"
        aria-label="Quantity preset"
      >
        {PRESET_OPTIONS.map(({ id, label }) => {
          const active = preset === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onPresetChange(id)}
              className={`rounded-xl border px-4 py-3.5 text-center text-sm font-semibold transition disabled:opacity-50 ${
                active
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-surface-border text-zinc-300 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {preset === "full" && (
        <p className="mt-2 text-center text-xs text-zinc-500">{fullHint}</p>
      )}
      {preset === "custom" && (
        <div className="mt-3">
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
