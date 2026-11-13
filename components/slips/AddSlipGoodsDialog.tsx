"use client";

import { useCallback, useRef, useState } from "react";
import { Check } from "lucide-react";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { Modal } from "@/components/ui/Modal";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { updateStockOutSlip } from "@/lib/services/stockOutSlipService";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import type { StockOutSlipWithDetails, StockUnit } from "@/lib/types/database";

interface AddSlipGoodsDialogProps {
  open: boolean;
  slipId: string;
  onClose: () => void;
  onAdded: (slip: StockOutSlipWithDetails) => void;
}

export function AddSlipGoodsDialog({
  open,
  slipId,
  onClose,
  onAdded,
}: AddSlipGoodsDialogProps) {
  const [unit, setUnit] = useState<StockUnit | null>(null);
  const [qty, setQty] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const processingRef = useRef(false);

  const resetScan = useCallback(() => {
    setUnit(null);
    setQty("");
  }, []);

  const onScan = useCallback(
    async (barcode: string) => {
      if (processingRef.current || saving) return;
      processingRef.current = true;
      setChecking(true);
      setError(null);
      setMessage(null);
      try {
        const found = await fetchStockUnitByBarcode(barcode);
        if (!found) {
          setUnit(null);
          setError("Unknown barcode.");
          playScanReject();
          return;
        }
        if (found.status !== "STOCKED_IN" || found.remaining_bags < 1) {
          setUnit(null);
          setError("Bale is not available to add.");
          playScanReject();
          return;
        }
        setUnit(found);
        setQty(String(found.remaining_bags));
        playScanOkay();
      } catch (err) {
        setUnit(null);
        setError(err instanceof Error ? err.message : "Could not look up this label.");
        playScanReject();
      } finally {
        processingRef.current = false;
        setChecking(false);
      }
    },
    [saving]
  );

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId, hardwareListening } =
    useBarcodeInput({ onScan, enabled: open && !saving });

  const add = async () => {
    if (!unit || saving) return;
    const bagsQty = Math.floor(Number(qty));
    if (!Number.isFinite(bagsQty) || bagsQty < 1 || bagsQty > unit.remaining_bags) {
      setError(`Enter a qty from 1 to ${unit.remaining_bags}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateStockOutSlip({
        id: slipId,
        addItems: [{ barcode: unit.unit_barcode, bagsQty }],
      });
      if (!result.success || !result.data) {
        setError(result.message);
        playScanReject();
        return;
      }
      onAdded(result.data);
      setMessage(`Added bale #${unit.unit_number} · ${bagsQty} bags.`);
      playScanOkay();
      resetScan();
    } finally {
      setSaving(false);
    }
  };

  const product = unit?.products;
  const productLabel =
    product && typeof product === "object" && !Array.isArray(product) && "product_code" in product
      ? String(product.product_code ?? unit?.unit_barcode)
      : unit?.unit_barcode;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add goods"
      description="Scan a missed bale and set how many bags go on this bill."
      size="lg"
    >
      <div className="space-y-4">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={saving}
          hardwareListening={hardwareListening}
          onManualSubmit={onScan}
          manualInputMode="none"
          overlay={{ processing: checking, message: error }}
        />
        {unit && (
          <div className="rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
            <p className="text-sm font-medium text-zinc-100">
              {productLabel} · bale #{unit.unit_number}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {unit.remaining_bags.toLocaleString()} bags available
            </p>
            <label className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-400">Bags</span>
              <input
                type="number"
                min={1}
                max={Math.min(BAGS_PER_BALE, unit.remaining_bags)}
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={saving}
                className="w-28 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-right text-sm tabular-nums text-zinc-100 outline-none focus:border-accent"
              />
            </label>
          </div>
        )}
        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void add()}
            disabled={!unit || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? "Adding…" : "Add to bill"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
