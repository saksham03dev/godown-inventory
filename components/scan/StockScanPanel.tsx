"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GodownSelector } from "@/components/scan/GodownSelector";
import {
  ScannerWindow,
  ScanResultStrip,
} from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import {
  resolvePresetBagsQty,
  StockQtyPreset,
  type QtyPresetMode,
} from "@/components/scan/StockQtyPreset";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type { Godown } from "@/lib/types/database";
import type { TransactionType } from "@/lib/types/database";

interface StockScanPanelProps {
  transactionType: TransactionType;
  godowns: Godown[];
  title: string;
}

export function StockScanPanel({
  transactionType,
  godowns,
  title,
}: StockScanPanelProps) {
  const isStockIn = transactionType === "STOCK_IN";
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [qtyPreset, setQtyPreset] = useState<QtyPresetMode>("full");
  const [customQty, setCustomQty] = useState("");

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const qtyPresetRef = useRef(qtyPreset);
  const customQtyRef = useRef(customQty);
  const transactionTypeRef = useRef(transactionType);

  const { tally, recordScan, resetTally } = useScanTally();

  qtyPresetRef.current = qtyPreset;
  customQtyRef.current = customQty;
  transactionTypeRef.current = transactionType;

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

  useEffect(() => {
    selectedGodownIdRef.current = selectedGodownId;
  }, [selectedGodownId]);

  useEffect(() => {
    if (isStockIn && godowns.length > 0 && !selectedGodownId) {
      setSelectedGodownId(godowns[0].id);
    }
  }, [godowns, selectedGodownId, isStockIn]);

  useEffect(() => {
    resetTally();
    dismissAlert();
    clearApproveFlash();
  }, [selectedGodownId, transactionType, resetTally, dismissAlert, clearApproveFlash]);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current) return;

      const godownId = selectedGodownIdRef.current;
      if (transactionTypeRef.current === "STOCK_IN" && !godownId) return;

      if (qtyPresetRef.current === "custom") {
        const n = Math.floor(Number(customQtyRef.current));
        if (!Number.isFinite(n) || n < 1) {
          return;
        }
      }

      const bagsQty = resolvePresetBagsQty(
        qtyPresetRef.current,
        customQtyRef.current
      );

      processingRef.current = true;
      try {
        await handleScan(
          barcode,
          godownId,
          transactionTypeRef.current,
          bagsQty
        );
      } finally {
        processingRef.current = false;
      }
    },
    [handleScan]
  );

  const {
    isScanning,
    cameraError,
    startScanning,
    stopScanning,
    scannerElementId,
    hardwareListening,
  } = useBarcodeInput({
    onScan: onBarcodeDetected,
    enabled: !isStockIn || Boolean(selectedGodownId),
  });

  const selectedGodown = godowns.find((g) => g.id === selectedGodownId);
  const contextLabel =
    isStockIn && selectedGodown
      ? `${title} · ${selectedGodown.location_name}`
      : title;

  const overlayDetail = lastResult?.stockUnit
    ? `Bale #${lastResult.stockUnit.unit_number} · ${lastResult.stockUnit.unit_barcode}`
    : (lastResult?.product?.name ?? null);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {isStockIn && (
        <GodownSelector
          godowns={godowns}
          selectedId={selectedGodownId}
          onChange={setSelectedGodownId}
          disabled={processing}
        />
      )}

      {isStockIn && !selectedGodownId && (
        <AlertBanner
          alert={{
            type: "info",
            message: "Select a godown to enable scanning.",
          }}
        />
      )}

      <StockQtyPreset
        transactionType={transactionType}
        preset={qtyPreset}
        customQty={customQty}
        onPresetChange={setQtyPreset}
        onCustomQtyChange={setCustomQty}
        disabled={processing}
      />

      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={processing || (isStockIn && !selectedGodownId)}
          contextLabel={contextLabel}
          hardwareListening={
            hardwareListening && (!isStockIn || Boolean(selectedGodownId))
          }
          onManualSubmit={onBarcodeDetected}
          overlay={{
            processing,
            flash: approveFlash ? "success" : errorFlash ? "error" : null,
            message: alert?.message ?? lastResult?.message ?? null,
            detail: overlayDetail,
          }}
        />
      </div>

      <ScanResultStrip
        alert={alert}
        lastResult={lastResult}
        mode={transactionType}
        onDismissAlert={dismissAlert}
      />

      <ScanTallyPanel tally={tally} mode={transactionType} onReset={resetTally} />

      <p className="text-center text-xs text-zinc-600">
        Scan unit barcodes (87…) — camera, 2D scanner, or typed entry. Default{" "}
        {transactionType === "STOCK_IN"
          ? `${BAGS_PER_BALE.toLocaleString()} bags`
          : "full remaining"}{" "}
        per scan unless Custom preset is set.
      </p>
    </div>
  );
}
