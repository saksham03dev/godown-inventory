"use client";

import { Minus, Plus } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import type { AlertState, ScanTransactionResult } from "@/lib/types/database";

interface ScanFeedbackProps {
  alert: AlertState | null;
  lastResult: ScanTransactionResult | null;
  processing: boolean;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onDismissAlert: () => void;
}

export function ScanFeedback({
  alert,
  lastResult,
  processing,
  quantity,
  onQuantityChange,
  onDismissAlert,
}: ScanFeedbackProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Scan Quantity
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={processing || quantity <= 1}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border text-zinc-400 transition hover:bg-white/5 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-2xl font-bold text-zinc-100">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange(quantity + 1)}
            disabled={processing}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border text-zinc-400 transition hover:bg-white/5 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {processing && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm text-accent animate-pulse-soft">
          Processing scan…
        </div>
      )}

      {alert && (
        <AlertBanner alert={alert} onDismiss={onDismissAlert} />
      )}

      {lastResult?.success && lastResult.product && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 animate-slide-up">
          <p className="text-xs font-medium uppercase tracking-wider text-success">
            Last Scan {lastResult.isUnitScan ? "(Unit)" : "(Product)"}
          </p>
          <p className="mt-1 font-medium text-zinc-100">
            {lastResult.product.name}
          </p>
          {lastResult.stockUnit && (
            <p className="text-xs text-zinc-500">
              Unit #{lastResult.stockUnit.unit_number} ·{" "}
              {lastResult.stockUnit.unit_barcode}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            Godown stock: {lastResult.newGodownStock} units · Global:{" "}
            {lastResult.product.total_stock} units
          </p>
        </div>
      )}
    </div>
  );
}
