"use client";

import { useEffect, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { formatBagCount } from "@/lib/utils/inventory";
import type { StockUnit } from "@/lib/types/database";

interface RetailCutDialogProps {
  open: boolean;
  unit: StockUnit | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (bagsQty: number) => void;
}

function productName(unit: StockUnit | null): string {
  if (
    unit?.products &&
    typeof unit.products === "object" &&
    "name" in unit.products
  ) {
    return String(unit.products.name);
  }
  return "Product";
}

export function RetailCutDialog({
  open,
  unit,
  loading = false,
  onClose,
  onConfirm,
}: RetailCutDialogProps) {
  const inputId = useId();
  const [bagsInput, setBagsInput] = useState("");

  const remaining = unit?.remaining_bags ?? 0;
  const cutQty = Math.floor(Number(bagsInput));
  const validCut =
    Number.isFinite(cutQty) && cutQty >= 1 && cutQty <= remaining;
  const leftAfter = validCut ? remaining - cutQty : null;

  useEffect(() => {
    if (open) {
      setBagsInput("");
    }
  }, [open, unit?.id]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(inputId);
      el?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open, inputId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validCut || loading) return;
    onConfirm(cutQty);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retail stock out"
      size="sm"
    >
      {unit && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-retail/25 bg-retail/5 p-3 ring-1 ring-retail/10">
            <span className="mb-2 inline-block rounded-lg bg-retail/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-retail">
              Retail cut
            </span>
            <p className="text-sm font-medium text-zinc-100">
              Bale #{unit.unit_number} · {productName(unit)}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Remaining:{" "}
              <span className="font-semibold text-zinc-200">
                {formatBagCount(remaining)}
              </span>{" "}
              bags
            </p>
          </div>

          <div>
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500"
            >
              Bags to cut
            </label>
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={bagsInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) setBagsInput(v);
              }}
              disabled={loading}
              placeholder="e.g. 10"
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-lg font-semibold tabular-nums text-zinc-100 outline-none focus:border-retail disabled:opacity-50"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Enter 1–{remaining.toLocaleString()} bags (max{" "}
              {BAGS_PER_BALE.toLocaleString()})
            </p>
          </div>

          {bagsInput && (
            <p className="text-sm text-zinc-300">
              {validCut ? (
                leftAfter === 0 ? (
                  <span className="text-retail">
                    This will empty the bale (0 bags left).
                  </span>
                ) : (
                  <>
                    Left after cut:{" "}
                    <span className="font-semibold text-zinc-100">
                      {formatBagCount(leftAfter!)}
                    </span>{" "}
                    bags
                  </>
                )
              ) : (
                <span className="text-danger">Enter a valid bag count.</span>
              )}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !validCut}
              className="rounded-xl bg-retail px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-retail-muted disabled:opacity-50"
            >
              {loading ? "Processing…" : "Stock Out"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
