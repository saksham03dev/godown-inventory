"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import {
  RetailCutDialog,
  RetailStockOutApproval,
} from "@/components/scan/RetailCutDialog";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import { StockOutModeSwitch } from "@/components/scan/StockOutModeSwitch";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { OnScreenTextPad } from "@/components/scan/OnScreenTextPad";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  STOCK_OUT_MODE_STORAGE_KEY,
  type StockOutSaleMode,
} from "@/lib/constants/stockOut";
import { refreshSessionCookies } from "@/lib/auth/ensureSession";
import { ACTIVITY_PING_INTERVAL_MS } from "@/lib/auth/idle-timeout";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import { confirmStockOutSlip } from "@/lib/services/stockOutSlipService";
import type { AlertState, StockUnit } from "@/lib/types/database";

function readStoredMode(): StockOutSaleMode {
  if (typeof window === "undefined") return "wholesale";
  const stored = localStorage.getItem(STOCK_OUT_MODE_STORAGE_KEY);
  return stored === "retail" ? "retail" : "wholesale";
}

interface StagedStockOutItem {
  barcode: string;
  bagsQty: number;
  productId: string;
  productName: string;
  productCode: string;
  size: string | null;
  unitNumber: number;
  stockUnitId: string;
}

function productFromUnit(unit: StockUnit) {
  const p = unit.products;
  if (p && typeof p === "object" && !Array.isArray(p) && "name" in p) {
    return {
      productId: unit.product_id,
      productName: String(p.name ?? "Product"),
      productCode:
        "product_code" in p ? String(p.product_code ?? "") : unit.unit_barcode,
      size: "size" in p && p.size ? String(p.size) : null,
    };
  }
  return {
    productId: unit.product_id,
    productName: "Product",
    productCode: unit.unit_barcode,
    size: null as string | null,
  };
}

export function StockOutScanPanel() {
  const [saleMode, setSaleMode] = useState<StockOutSaleMode>("wholesale");
  const [staged, setStaged] = useState<StagedStockOutItem[]>([]);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [approveFlash, setApproveFlash] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [billerName, setBillerName] = useState("");
  const [billNo, setBillNo] = useState("");
  /** Which optional field the on-screen pad is editing. */
  const [padTarget, setPadTarget] = useState<"biller" | "billNo">("biller");
  const [confirming, setConfirming] = useState(false);
  const [confirmedSlipId, setConfirmedSlipId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const [retailUnit, setRetailUnit] = useState<StockUnit | null>(null);
  const [retailBarcode, setRetailBarcode] = useState("");
  const [retailLoading, setRetailLoading] = useState(false);
  const [retailDialogError, setRetailDialogError] = useState<string | null>(
    null
  );
  const [retailApproval, setRetailApproval] = useState<{
    productCode: string | null;
    size: string | null;
    bagsRemaining: number;
    baleNumber?: number;
  } | null>(null);

  const processingRef = useRef(false);
  const saleModeRef = useRef(saleMode);
  const retailOpenRef = useRef(false);
  const confirmOpenRef = useRef(false);
  const stagedRef = useRef(staged);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const { tally, recordBags, resetTally } = useScanTally();
  const isRetail = saleMode === "retail";

  saleModeRef.current = saleMode;
  retailOpenRef.current = Boolean(retailUnit);
  confirmOpenRef.current = confirmOpen;
  stagedRef.current = staged;

  useEffect(() => {
    setSaleMode(readStoredMode());
  }, []);

  const clearSession = useCallback(() => {
    setStaged([]);
    resetTally();
    setRetailUnit(null);
    setRetailBarcode("");
    setRetailDialogError(null);
    setRetailApproval(null);
    setLastMessage(null);
    setAlert(null);
    setConfirmOpen(false);
    setBillerName("");
    setBillNo("");
  }, [resetTally]);

  useEffect(() => {
    localStorage.setItem(STOCK_OUT_MODE_STORAGE_KEY, saleMode);
    clearSession();
    setConfirmedSlipId(null);
  }, [saleMode, clearSession]);

  useEffect(() => {
    if (staged.length === 0 && !confirmOpen) return;
    void refreshSessionCookies();
    const timer = window.setInterval(() => {
      void refreshSessionCookies();
    }, ACTIVITY_PING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [staged.length, confirmOpen]);

  const focusScanner = useCallback(() => {
    setTimeout(() => manualInputRef.current?.focus(), 50);
  }, []);

  const flashSuccess = useCallback((message: string) => {
    setApproveFlash(true);
    setErrorFlash(false);
    setLastMessage(message);
    setAlert({ type: "success", message });
    playScanOkay();
    setTimeout(() => setApproveFlash(false), 900);
  }, []);

  const flashError = useCallback((message: string) => {
    setErrorFlash(true);
    setApproveFlash(false);
    setLastMessage(message);
    setAlert({ type: "error", message });
    playScanReject();
    setTimeout(() => setErrorFlash(false), 900);
  }, []);

  const stageItem = useCallback(
    (unit: StockUnit, bagsQty: number) => {
      if (stagedRef.current.some((s) => s.barcode === unit.unit_barcode)) {
        flashError("This bale is already in the session.");
        return false;
      }
      if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
        flashError("Bale is not available for stock out.");
        return false;
      }
      if (bagsQty < 1 || bagsQty > unit.remaining_bags) {
        flashError(
          `Cannot stage ${bagsQty} bags — only ${unit.remaining_bags} remaining.`
        );
        return false;
      }

      const meta = productFromUnit(unit);
      const item: StagedStockOutItem = {
        barcode: unit.unit_barcode,
        bagsQty,
        productId: meta.productId,
        productName: meta.productName,
        productCode: meta.productCode,
        size: meta.size,
        unitNumber: unit.unit_number,
        stockUnitId: unit.id,
      };
      setStaged((prev) => [...prev, item]);
      recordBags({
        productId: meta.productId,
        productName: meta.productName,
        productCode: meta.productCode,
        size: meta.size,
        bags: bagsQty,
      });
      flashSuccess(`Staged bale #${unit.unit_number} · ${bagsQty} bags`);
      return true;
    },
    [flashError, flashSuccess, recordBags]
  );

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (
        processingRef.current ||
        retailOpenRef.current ||
        confirmOpenRef.current ||
        confirming
      ) {
        return;
      }

      setConfirmedSlipId(null);
      setRetailApproval(null);

      if (saleModeRef.current === "wholesale") {
        processingRef.current = true;
        try {
          const unit = await fetchStockUnitByBarcode(barcode);
          if (!unit) {
            flashError("Unknown barcode.");
            return;
          }
          const bags =
            unit.remaining_bags > 0 ? unit.remaining_bags : BAGS_PER_BALE;
          stageItem(unit, bags);
        } catch (err) {
          flashError(
            err instanceof Error ? err.message : "Could not look up bale."
          );
        } finally {
          processingRef.current = false;
          focusScanner();
        }
        return;
      }

      processingRef.current = true;
      setRetailLoading(true);
      setRetailDialogError(null);
      try {
        const unit = await fetchStockUnitByBarcode(barcode);
        if (!unit) {
          flashError("Unknown barcode.");
          focusScanner();
          return;
        }
        if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
          flashError("Bale is not available for stock out.");
          focusScanner();
          return;
        }
        setRetailBarcode(barcode);
        setRetailUnit(unit);
      } catch (err) {
        flashError(
          err instanceof Error ? err.message : "Could not look up bale."
        );
        focusScanner();
      } finally {
        processingRef.current = false;
        setRetailLoading(false);
      }
    },
    [confirming, flashError, focusScanner, stageItem]
  );

  const closeRetailDialog = useCallback(() => {
    if (retailLoading) return;
    setRetailUnit(null);
    setRetailBarcode("");
    setRetailDialogError(null);
    focusScanner();
  }, [retailLoading, focusScanner]);

  const confirmRetailCut = useCallback(
    (bagsQty: number) => {
      if (!retailBarcode || !retailUnit || retailLoading) return;
      if (bagsQty > retailUnit.remaining_bags) {
        setRetailDialogError(
          `Cannot stock out ${bagsQty.toLocaleString()} bags — only ${retailUnit.remaining_bags.toLocaleString()} remaining.`
        );
        return;
      }
      const ok = stageItem(retailUnit, bagsQty);
      if (ok) {
        setRetailApproval({
          productCode: productFromUnit(retailUnit).productCode,
          size: productFromUnit(retailUnit).size,
          bagsRemaining: retailUnit.remaining_bags - bagsQty,
          baleNumber: retailUnit.unit_number,
        });
        setRetailUnit(null);
        setRetailBarcode("");
        focusScanner();
      }
    },
    [retailBarcode, retailUnit, retailLoading, stageItem, focusScanner]
  );

  const openConfirmModal = useCallback(() => {
    if (staged.length === 0 || confirming) return;
    setBillerName("");
    setBillNo("");
    setPadTarget("biller");
    setConfirmOpen(true);
    // Drop focus so OTG keystrokes cannot land in a text field
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
  }, [staged.length, confirming]);

  const closeConfirmModal = useCallback(() => {
    if (confirming) return;
    setConfirmOpen(false);
    focusScanner();
  }, [confirming, focusScanner]);

  const handleConfirmStockOut = useCallback(async () => {
    if (staged.length === 0 || confirming) return;
    setConfirming(true);
    setAlert(null);
    try {
      const sessionOk = await refreshSessionCookies();
      if (!sessionOk) {
        flashError(
          "Session expired. Log in again, then restage these bales — nothing was stocked out."
        );
        return;
      }

      const result = await confirmStockOutSlip({
        billerName,
        billNo,
        saleChannel: saleMode === "retail" ? "RETAIL" : "WHOLESALE",
        items: staged.map((s) => ({
          barcode: s.barcode,
          bagsQty: s.bagsQty,
        })),
      });
      if (!result.success) {
        flashError(result.message);
        return;
      }
      setConfirmedSlipId(result.data?.id ?? null);
      clearSession();
      setAlert({
        type: "success",
        message: result.message,
      });
      setApproveFlash(true);
      playScanOkay();
      setTimeout(() => setApproveFlash(false), 1200);
    } catch (err) {
      flashError(err instanceof Error ? err.message : "Confirm failed.");
    } finally {
      setConfirming(false);
      focusScanner();
    }
  }, [
    staged,
    confirming,
    billerName,
    billNo,
    saleMode,
    flashError,
    clearSession,
    focusScanner,
  ]);

  const scannerEnabled =
    !retailUnit && !retailLoading && !confirming && !confirmOpen;

  const {
    isScanning,
    cameraError,
    startScanning,
    stopScanning,
    scannerElementId,
    hardwareListening,
  } = useBarcodeInput({
    onScan: onBarcodeDetected,
    enabled: scannerEnabled,
  });

  const busy = confirming || retailLoading;
  const totalBags = staged.reduce((sum, s) => sum + s.bagsQty, 0);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <StockOutModeSwitch
        mode={saleMode}
        onChange={setSaleMode}
        disabled={busy || staged.length > 0 || Boolean(retailUnit)}
      />

      {saleMode === "wholesale" ? (
        <div className="rounded-2xl border border-wholesale/30 bg-wholesale/5 p-4 text-center ring-1 ring-wholesale/10">
          <p className="text-xs font-medium uppercase tracking-wider text-wholesale">
            Wholesale · full bale
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">
            {BAGS_PER_BALE.toLocaleString()}
            <span className="ml-2 text-sm font-normal text-zinc-500">bags</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Scan to stage, then confirm to stock out
          </p>
        </div>
      ) : null}

      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={busy || Boolean(retailUnit) || confirmOpen}
          contextLabel={
            saleMode === "wholesale" ? "Wholesale stock out" : "Scan bale"
          }
          hardwareListening={hardwareListening && scannerEnabled}
          onManualSubmit={onBarcodeDetected}
          manualInputRef={manualInputRef}
          manualInputMode="none"
          overlay={{
            processing: busy,
            flash: approveFlash ? "success" : errorFlash ? "error" : null,
            message: lastMessage,
            detail: null,
          }}
        />
      </div>

      {alert && (
        <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />
      )}

      {confirmedSlipId && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Slip created.{" "}
          <Link
            href="/stock-out-slips"
            className="font-medium underline underline-offset-2"
          >
            View stock-out slips
          </Link>
        </div>
      )}

      {isRetail && retailApproval && (
        <RetailStockOutApproval
          productCode={retailApproval.productCode}
          size={retailApproval.size}
          bagsRemaining={retailApproval.bagsRemaining}
          baleNumber={retailApproval.baleNumber}
          onDismiss={() => setRetailApproval(null)}
        />
      )}

      <ScanTallyPanel
        tally={tally}
        mode="STOCK_OUT"
        stockOutSaleMode={saleMode}
        onReset={() => {
          if (staged.length > 0) setResetOpen(true);
          else clearSession();
        }}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (staged.length > 0) setResetOpen(true);
            else clearSession();
          }}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-border px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
        <button
          type="button"
          onClick={openConfirmModal}
          disabled={busy || staged.length === 0}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {`Confirm stock out · ${staged.length}`}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600">
        {isRetail
          ? "Scan a bale, enter bags in the popup, then confirm. Optional biller details are asked at confirm."
          : `Wholesale stages full remaining bags (usually ${BAGS_PER_BALE.toLocaleString()}) per scan. Optional biller / bill no at confirm.`}
      </p>

      <RetailCutDialog
        open={Boolean(retailUnit)}
        unit={retailUnit}
        loading={retailLoading}
        onClose={closeRetailDialog}
        onConfirm={(qty) => confirmRetailCut(qty)}
        errorMessage={retailDialogError}
      />

      <Modal
        open={confirmOpen}
        onClose={closeConfirmModal}
        title="Confirm stock out"
        description="Optional details — use the on-screen pad (OTG-safe)"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Labels: </span>
              <span className="font-semibold tabular-nums text-zinc-100">
                {staged.length}
              </span>
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">Bags: </span>
              <span className="font-semibold tabular-nums text-zinc-100">
                {Math.round(totalBags)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={confirming}
              onClick={() => setPadTarget("biller")}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                padTarget === "biller"
                  ? "border-accent/50 bg-accent/10"
                  : "border-surface-border bg-surface-overlay"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Biller
              </p>
              <p className="mt-0.5 truncate text-sm text-zinc-100">
                {billerName || (
                  <span className="text-zinc-600">Optional</span>
                )}
              </p>
            </button>
            <button
              type="button"
              disabled={confirming}
              onClick={() => setPadTarget("billNo")}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                padTarget === "billNo"
                  ? "border-accent/50 bg-accent/10"
                  : "border-surface-border bg-surface-overlay"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Bill No
              </p>
              <p className="mt-0.5 truncate text-sm text-zinc-100">
                {billNo || <span className="text-zinc-600">Optional</span>}
              </p>
            </button>
          </div>

          <OnScreenTextPad
            key={padTarget}
            label={
              padTarget === "biller"
                ? "Biller name (optional)"
                : "Bill No (optional)"
            }
            value={padTarget === "biller" ? billerName : billNo}
            onChange={padTarget === "biller" ? setBillerName : setBillNo}
            placeholder={
              padTarget === "biller" ? "Person billed" : "Bill / purchase no"
            }
            disabled={confirming}
            defaultMode={padTarget === "billNo" ? "digits" : "letters"}
          />

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={closeConfirmModal}
              disabled={confirming}
              className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmStockOut()}
              disabled={confirming || staged.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {confirming ? "Confirming…" : "Confirm stock out"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          clearSession();
          setConfirmedSlipId(null);
          setResetOpen(false);
        }}
        title="Reset session?"
        message="Clear staged scans. Nothing has been stocked out yet."
        confirmLabel="Reset"
        destructive
      />
    </div>
  );
}
