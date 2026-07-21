"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  BagCountNumpad,
  parseBagCountValue,
} from "@/components/scan/BagCountNumpad";
import { Modal } from "@/components/ui/Modal";
import { formatBagCount } from "@/lib/utils/inventory";
import type { StockUnit } from "@/lib/types/database";

interface RetailCutDialogProps {
  open: boolean;
  unit: StockUnit | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (bagsQty: number) => void;
  errorMessage?: string | null;
}

function unitProduct(unit: StockUnit) {
  const p = unit.products;
  if (p && typeof p === "object" && !Array.isArray(p) && "name" in p) {
    return {
      name: String(p.name),
      product_code: "product_code" in p ? String(p.product_code ?? "") : "",
      size: "size" in p && p.size ? String(p.size) : null,
    };
  }
  return { name: "Product", product_code: "", size: null as string | null };
}

export function RetailCutDialog({
  open,
  unit,
  loading = false,
  onClose,
  onConfirm,
  errorMessage,
}: RetailCutDialogProps) {
  const [bagsInput, setBagsInput] = useState("");

  const remaining = unit?.remaining_bags ?? 0;
  const entered = bagsInput ? Math.floor(Number(bagsInput)) : null;
  const cutQty = parseBagCountValue(bagsInput, remaining);
  const validCut = cutQty != null;
  const overLimit =
    entered != null && Number.isFinite(entered) && entered > remaining;
  const underMin =
    bagsInput.length > 0 &&
    (entered == null || !Number.isFinite(entered) || entered < 1);

  useEffect(() => {
    if (open) {
      setBagsInput("");
    }
  }, [open, unit?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (overLimit || cutQty == null || loading) return;
    onConfirm(cutQty);
  };

  const product = unit ? unitProduct(unit) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retail stock out"
      description="Enter bags to remove from this bale"
      size="lg"
    >
      {unit && product && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-center rounded-2xl border border-retail/25 bg-retail/5 p-5 ring-1 ring-retail/10">
              <p className="text-xs font-medium uppercase tracking-wider text-retail">
                Scanned bale
              </p>
              <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">
                Backend code
              </p>
              <p className="font-mono text-lg font-bold text-zinc-100">
                {product.product_code || "—"}
              </p>
              <p className="mt-4 text-xs uppercase tracking-wider text-zinc-500">
                Size
              </p>
              <p className="text-lg font-semibold text-zinc-200">
                {product.size || "—"}
              </p>
              <p className="mt-4 text-xs uppercase tracking-wider text-zinc-500">
                Bags in bale now
              </p>
              <p className="text-4xl font-bold tabular-nums text-zinc-50">
                {remaining.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Bale #{unit.unit_number} · {product.name}
              </p>
            </div>

            <div className="flex flex-col">
              <BagCountNumpad
                value={bagsInput}
                onChange={setBagsInput}
                label="Bags to stock out"
                max={remaining}
                disabled={loading}
                accent="retail"
                placeholder="0"
              />
            </div>
          </div>

          {overLimit && (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              Cannot stock out {entered!.toLocaleString()} bags — only{" "}
              {remaining.toLocaleString()} remaining in this bale.
            </p>
          )}

          {underMin && !overLimit && (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              Enter at least 1 bag to stock out.
            </p>
          )}

          {validCut && !overLimit && (
            <p className="text-center text-sm text-zinc-400">
              {remaining - cutQty! === 0 ? (
                <span className="text-retail">
                  Bale will be emptied after this stock out.
                </span>
              ) : (
                <>
                  <span className="font-semibold text-zinc-200">
                    {(remaining - cutQty!).toLocaleString()}
                  </span>{" "}
                  bags will remain in this bale
                </>
              )}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {errorMessage}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-surface-border px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !validCut || overLimit}
              className="flex-1 rounded-xl bg-retail px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-retail-muted disabled:opacity-50"
            >
              {loading ? "Processing…" : "Confirm stock out"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface RetailStockOutApprovalProps {
  productCode: string | null;
  size: string | null;
  bagsRemaining: number;
  baleNumber?: number;
  onDismiss?: () => void;
}

export function RetailStockOutApproval({
  productCode,
  size,
  bagsRemaining,
  baleNumber,
  onDismiss,
}: RetailStockOutApprovalProps) {
  return (
    <div className="rounded-2xl border border-success/40 bg-success/10 p-5 ring-1 ring-success/20 animate-slide-up">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-success">
            Stock out approved
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
            {productCode ? (
              <span>
                Code{" "}
                <span className="font-mono font-semibold text-zinc-200">
                  {productCode}
                </span>
              </span>
            ) : null}
            {size ? (
              <span>
                Size{" "}
                <span className="font-semibold text-zinc-200">{size}</span>
              </span>
            ) : null}
            {baleNumber != null ? (
              <span>
                Bale{" "}
                <span className="font-semibold text-zinc-200">#{baleNumber}</span>
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-xs uppercase tracking-wider text-zinc-500">
            Bags remaining in bale
          </p>
          <p className="text-4xl font-bold tabular-nums text-zinc-50">
            {formatBagCount(bagsRemaining)}
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
