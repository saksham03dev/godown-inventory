"use client";

import { useCallback, useRef, useState } from "react";
import { Package, ShoppingBag } from "lucide-react";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import type { RetailBillLineResult, StockUnit } from "@/lib/types/database";
import { formatBagCount } from "@/lib/utils/inventory";

type ScanFlash = "success" | "error" | null;

interface RetailBillingPanelProps {
  billId: string;
  billNumber: string;
  disabled?: boolean;
  canEditPrice?: boolean;
  onAddLine: (
    billId: string,
    barcode: string,
    bagsQty: number,
    unitPrice?: number
  ) => Promise<RetailBillLineResult>;
}

export function RetailBillingPanel({
  billId,
  billNumber,
  disabled = false,
  canEditPrice = false,
  onAddLine,
}: RetailBillingPanelProps) {
  const [scannedUnit, setScannedUnit] = useState<StockUnit | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [bagsQty, setBagsQty] = useState("1");
  const [priceOverride, setPriceOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanFlash, setScanFlash] = useState<ScanFlash>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const processingRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billIdRef = useRef(billId);
  const bagsQtyRef = useRef(bagsQty);
  const priceOverrideRef = useRef(priceOverride);
  const canEditPriceRef = useRef(canEditPrice);
  const scannedBarcodeRef = useRef<string | null>(null);

  billIdRef.current = billId;
  bagsQtyRef.current = bagsQty;
  priceOverrideRef.current = priceOverride;
  canEditPriceRef.current = canEditPrice;
  scannedBarcodeRef.current = scannedUnit?.unit_barcode ?? null;

  const showFlash = useCallback((flash: ScanFlash, message: string) => {
    setScanFlash(flash);
    setScanMessage(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setScanFlash(null);
      setScanMessage(null);
      flashTimerRef.current = null;
    }, 2200);
  }, []);

  const lookupBale = useCallback(
    async (barcode: string) => {
      setLookupLoading(true);
      try {
        const unit = await fetchStockUnitByBarcode(barcode);
        if (!unit) {
          setScannedUnit(null);
          showFlash("error", `No bale found for barcode: ${barcode}`);
          return;
        }
        if (unit.status !== "STOCKED_IN") {
          setScannedUnit(null);
          showFlash(
            "error",
            "Bale must be stocked in. Use wholesale flow for full bale sales."
          );
          return;
        }
        if (unit.remaining_bags < 1) {
          setScannedUnit(null);
          showFlash("error", "This bale has no bags remaining.");
          return;
        }
        setScannedUnit(unit);
        setBagsQty("1");
        showFlash(
          "success",
          `Bale #${unit.unit_number} — ${formatBagCount(unit.remaining_bags)} bags available`
        );
      } catch (err) {
        setScannedUnit(null);
        showFlash(
          "error",
          err instanceof Error ? err.message : "Failed to look up bale."
        );
      } finally {
        setLookupLoading(false);
      }
    },
    [showFlash]
  );

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || disabled) return;
      await lookupBale(barcode);
    },
    [disabled, lookupBale]
  );

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId, resetDebounce } =
    useBarcodeScan({
      onScan: onBarcodeDetected,
      enabled: !disabled,
    });

  const submitLine = useCallback(async () => {
    const barcode = scannedBarcodeRef.current;
    if (!barcode || processingRef.current || disabled) return;

    const qty = Math.floor(Number(bagsQtyRef.current));
    if (!Number.isFinite(qty) || qty < 1) {
      showFlash("error", "Minimum sale is 1 bag.");
      return;
    }

    const remaining = scannedUnit?.remaining_bags ?? 0;
    if (qty > remaining) {
      showFlash("error", `Only ${formatBagCount(remaining)} bag(s) left in this bale.`);
      return;
    }

    const rawPrice = priceOverrideRef.current.trim();
    const parsedPrice = Number(rawPrice);
    const unitPrice =
      canEditPriceRef.current &&
      rawPrice !== "" &&
      Number.isFinite(parsedPrice) &&
      parsedPrice > 0
        ? parsedPrice
        : 0;

    processingRef.current = true;
    setSubmitting(true);
    setScanFlash(null);

    try {
      const result = await onAddLine(billIdRef.current, barcode, qty, unitPrice);
      showFlash(result.success ? "success" : "error", result.message);

      if (result.success) {
        setScannedUnit(null);
        setBagsQty("1");
        resetDebounce();
      }
    } finally {
      processingRef.current = false;
      setSubmitting(false);
    }
  }, [disabled, onAddLine, resetDebounce, scannedUnit?.remaining_bags, showFlash]);

  const maxBags = scannedUnit?.remaining_bags ?? BAGS_PER_BALE;
  const retailPrice = (
    scannedUnit?.products as { retail_selling_price?: number } | null
  )?.retail_selling_price;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-1 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={disabled || submitting || lookupLoading}
          contextLabel={`Retail · ${billNumber}`}
          overlay={{
            processing: lookupLoading || submitting,
            flash: scanFlash,
            message: scanMessage,
          }}
        />
      </div>

      {lookupLoading && !scannedUnit ? (
        <LoadingSpinner label="Looking up bale…" />
      ) : scannedUnit ? (
        <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-4">
          <LabelDetailCard unit={scannedUnit} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                Bags to sell
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={bagsQty}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) setBagsQty(v);
                }}
                disabled={disabled || submitting}
                className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-base text-zinc-100 outline-none focus:border-accent sm:text-sm"
              />
              <p className="mt-1 text-xs text-zinc-600">
                Max {formatBagCount(maxBags)} bags from this bale
              </p>
            </div>

            {canEditPrice ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Price override (₹/bag) — optional
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceOverride}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d*$/.test(v)) setPriceOverride(v);
                  }}
                  disabled={disabled || submitting}
                  placeholder={
                    retailPrice !== undefined
                      ? `Default ₹${Number(retailPrice).toFixed(2)}`
                      : "Auto from product"
                  }
                  className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-base text-zinc-100 outline-none focus:border-accent sm:text-sm"
                />
              </div>
            ) : retailPrice !== undefined ? (
              <div className="flex items-end">
                <p className="text-sm text-zinc-400">
                  ₹{Number(retailPrice).toFixed(2)} per bag
                </p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void submitLine()}
            disabled={disabled || submitting || !bagsQty || Number(bagsQty) < 1}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50 sm:w-auto"
          >
            <ShoppingBag className="h-4 w-4" />
            Add {bagsQty || "—"} bag{Number(bagsQty) === 1 ? "" : "s"} to bill
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/50 p-6 text-center">
          <Package className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-400">
            Scan a stocked-in bale barcode, then enter bag quantity
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Sealed bales have {formatBagCount(BAGS_PER_BALE)} bags · partial bales
            show remaining count
          </p>
        </div>
      )}
    </div>
  );
}
