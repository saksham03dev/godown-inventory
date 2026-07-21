"use client";

import { useEffect, useState } from "react";
import { GodownSelector } from "@/components/scan/GodownSelector";
import { Modal } from "@/components/ui/Modal";
import { correctUnitGodown } from "@/lib/services/unitScanService";
import { formatBagCount } from "@/lib/utils/inventory";
import type { Godown, StockUnit } from "@/lib/types/database";

interface GodownRelocateDialogProps {
  open: boolean;
  unit: StockUnit | null;
  currentGodownId: string;
  currentGodownName: string;
  godowns: Godown[];
  onClose: () => void;
  onSuccess: () => void;
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

export function GodownRelocateDialog({
  open,
  unit,
  currentGodownId,
  currentGodownName,
  godowns,
  onClose,
  onSuccess,
}: GodownRelocateDialogProps) {
  const [toGodownId, setToGodownId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinationOptions = godowns.filter((g) => g.id !== currentGodownId);

  useEffect(() => {
    if (!open) return;
    const options = godowns.filter((g) => g.id !== currentGodownId);
    setToGodownId(options[0]?.id ?? "");
    setReason("");
    setError(null);
  }, [open, unit?.id, currentGodownId, godowns]);

  const remaining = unit?.remaining_bags ?? 0;
  const toGodown = godowns.find((g) => g.id === toGodownId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit || !toGodownId || loading) return;

    setLoading(true);
    setError(null);
    const result = await correctUnitGodown({
      barcodeId: unit.unit_barcode,
      toGodownId,
      reason: reason.trim() || null,
    });
    setLoading(false);

    if (result.success) {
      onSuccess();
      onClose();
      return;
    }
    setError(result.message);
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="Correct godown location"
      description="Rare fix when a bale was stocked in at the wrong warehouse."
      size="sm"
    >
      {unit && (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">
              Bale #{unit.unit_number} · {productName(unit)}
            </p>
            <p className="mt-1 text-zinc-400">
              {formatBagCount(remaining)} bags · currently at{" "}
              <span className="font-medium text-zinc-200">
                {currentGodownName}
              </span>
            </p>
          </div>

          <GodownSelector
            godowns={destinationOptions}
            selectedId={toGodownId}
            onChange={setToGodownId}
            disabled={loading || destinationOptions.length === 0}
          />

          {destinationOptions.length === 0 && (
            <p className="text-sm text-zinc-500">
              No other godowns available to move this bale to.
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              rows={2}
              placeholder="e.g. Scanned into wrong godown by mistake"
              className="w-full resize-none rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-50"
            />
          </div>

          {toGodown && toGodownId !== currentGodownId && (
            <p className="text-sm text-zinc-400">
              Will move to{" "}
              <span className="font-medium text-zinc-200">
                {toGodown.location_name}
              </span>{" "}
              and log a correction in inventory history.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
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
              disabled={
                loading || !toGodownId || destinationOptions.length === 0
              }
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Moving…" : "Move bale"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
