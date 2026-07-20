"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScannerWindow,
  ScanResultStrip,
} from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import { RetailCutDialog } from "@/components/scan/RetailCutDialog";
import { StockOutModeSwitch } from "@/components/scan/StockOutModeSwitch";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  STOCK_OUT_MODE_STORAGE_KEY,
  type StockOutSaleMode,
} from "@/lib/constants/stockOut";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import type { StockUnit } from "@/lib/types/database";

function readStoredMode(): StockOutSaleMode {
  if (typeof window === "undefined") return "wholesale";
  const stored = localStorage.getItem(STOCK_OUT_MODE_STORAGE_KEY);
  return stored === "retail" ? "retail" : "wholesale";
}

export function StockOutScanPanel() {
  const [saleMode, setSaleMode] = useState<StockOutSaleMode>("wholesale");
  const [retailUnit, setRetailUnit] = useState<StockUnit | null>(null);
  const [retailBarcode, setRetailBarcode] = useState("");
  const [retailLoading, setRetailLoading] = useState(false);

  const processingRef = useRef(false);
  const saleModeRef = useRef(saleMode);
  const retailOpenRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const { tally, recordScan, resetTally } = useScanTally();

  saleModeRef.current = saleMode;
  retailOpenRef.current = Boolean(retailUnit);

  useEffect(() => {
    setSaleMode(readStoredMode());
  }, []);

  useEffect(() => {
    localStorage.setItem(STOCK_OUT_MODE_STORAGE_KEY, saleMode);
    resetTally();
    setRetailUnit(null);
    setRetailBarcode("");
  }, [saleMode, resetTally]);

  const {
    processing,
    alert,
    lastResult,
    approveFlash,
    errorFlash,
    handleScan,
    dismissAlert,
    clearApproveFlash,
  } = useScanTransaction({
    onSuccess: (result) => {
      if (result.isUnitScan !== false) {
        recordScan(result);
      }
    },
  });

  const focusScanner = useCallback(() => {
    setTimeout(() => manualInputRef.current?.focus(), 50);
  }, []);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || retailOpenRef.current) return;

      if (saleModeRef.current === "wholesale") {
        processingRef.current = true;
        try {
          await handleScan(barcode, "", "STOCK_OUT", null);
        } finally {
          processingRef.current = false;
          focusScanner();
        }
        return;
      }

      processingRef.current = true;
      setRetailLoading(true);
      try {
        const unit = await fetchStockUnitByBarcode(barcode);
        if (!unit) {
          await handleScan(barcode, "", "STOCK_OUT", 1);
          focusScanner();
          return;
        }
        if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
          await handleScan(barcode, "", "STOCK_OUT", 1);
          focusScanner();
          return;
        }
        setRetailBarcode(barcode);
        setRetailUnit(unit);
      } catch {
        await handleScan(barcode, "", "STOCK_OUT", 1);
        focusScanner();
      } finally {
        processingRef.current = false;
        setRetailLoading(false);
      }
    },
    [handleScan, focusScanner]
  );

  const closeRetailDialog = useCallback(() => {
    if (retailLoading) return;
    setRetailUnit(null);
    setRetailBarcode("");
    focusScanner();
  }, [retailLoading, focusScanner]);

  const confirmRetailCut = useCallback(
    async (bagsQty: number) => {
      if (!retailBarcode || retailLoading) return;
      setRetailLoading(true);
      processingRef.current = true;
      try {
        const result = await handleScan(
          retailBarcode,
          "",
          "STOCK_OUT",
          bagsQty
        );
        if (result.success) {
          setRetailUnit(null);
          setRetailBarcode("");
          focusScanner();
        }
      } finally {
        processingRef.current = false;
        setRetailLoading(false);
      }
    },
    [retailBarcode, retailLoading, handleScan, focusScanner]
  );

  const scannerEnabled = !retailUnit && !retailLoading;

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

  const overlayDetail = lastResult?.stockUnit
    ? `Bale #${lastResult.stockUnit.unit_number} · ${lastResult.stockUnit.unit_barcode}`
    : (lastResult?.product?.name ?? null);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <StockOutModeSwitch
        mode={saleMode}
        onChange={setSaleMode}
        disabled={processing || retailLoading || Boolean(retailUnit)}
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
            Scan a sealed bale — instant stock out, no confirmation
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-retail/30 bg-retail/5 p-4 text-center ring-1 ring-retail/10">
          <p className="text-xs font-medium uppercase tracking-wider text-retail">
            Retail · by bags
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Scan bale → enter bags to cut → confirm → next scan
          </p>
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={processing || retailLoading || Boolean(retailUnit)}
          contextLabel={
            saleMode === "wholesale" ? "Wholesale stock out" : "Retail stock out"
          }
          hardwareListening={hardwareListening && scannerEnabled}
          onManualSubmit={onBarcodeDetected}
          manualInputRef={manualInputRef}
          manualInputMode="none"
          overlay={{
            processing: processing || retailLoading,
            flash: approveFlash ? "success" : errorFlash ? "error" : null,
            message: alert?.message ?? lastResult?.message ?? null,
            detail: overlayDetail,
          }}
        />
      </div>

      <ScanResultStrip
        alert={alert}
        lastResult={lastResult}
        mode="STOCK_OUT"
        onDismissAlert={dismissAlert}
      />

      <ScanTallyPanel
        tally={tally}
        mode="STOCK_OUT"
        stockOutSaleMode={saleMode}
        onReset={resetTally}
      />

      <p className="text-center text-xs text-zinc-600">
        {saleMode === "wholesale"
          ? "Wholesale removes full bales (1,000 bags) per scan."
          : "Retail opens a popup after each scan so you can enter the exact bag count."}
      </p>

      <RetailCutDialog
        open={Boolean(retailUnit)}
        unit={retailUnit}
        loading={retailLoading}
        onClose={closeRetailDialog}
        onConfirm={(qty) => void confirmRetailCut(qty)}
      />
    </div>
  );
}
