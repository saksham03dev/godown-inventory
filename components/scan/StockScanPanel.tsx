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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { formatBagCount } from "@/lib/utils/inventory";
import type { Godown, StockUnit, TransactionType } from "@/lib/types/database";

interface StockScanPanelProps {
  transactionType: TransactionType;
  godowns: Godown[];
  title: string;
}

interface PendingCustomOut {
  barcode: string;
  unit: StockUnit;
  currentBags: number;
  stockOutQty: number;
  remainingAfter: number;
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
  const [pendingOut, setPendingOut] = useState<PendingCustomOut | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const qtyPresetRef = useRef(qtyPreset);
  const customQtyRef = useRef(customQty);
  const transactionTypeRef = useRef(transactionType);
  const pendingOutRef = useRef(pendingOut);

  const { tally, recordScan, resetTally } = useScanTally();

  qtyPresetRef.current = qtyPreset;
  customQtyRef.current = customQty;
  transactionTypeRef.current = transactionType;
  pendingOutRef.current = pendingOut;

  const {
    processing,
    alert,
    warningAlert,
    lastResult,
    approveFlash,
    errorFlash,
    handleScan,
    dismissAlert,
    dismissWarningAlert,
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
    dismissWarningAlert();
    clearApproveFlash();
    setPendingOut(null);
  }, [selectedGodownId, transactionType, resetTally, dismissAlert, dismissWarningAlert, clearApproveFlash]);

  const runScan = useCallback(
    async (barcode: string, bagsQty: number | null) => {
      const godownId = selectedGodownIdRef.current;
      if (transactionTypeRef.current === "STOCK_IN" && !godownId) return;

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

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || pendingOutRef.current) return;

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

      // Custom stock-out: show remaining / out / left popup before mutating
      if (
        transactionTypeRef.current === "STOCK_OUT" &&
        qtyPresetRef.current === "custom" &&
        bagsQty != null
      ) {
        processingRef.current = true;
        try {
          const unit = await fetchStockUnitByBarcode(barcode);
          if (!unit) {
            await runScan(barcode, bagsQty);
            return;
          }
          if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
            await runScan(barcode, bagsQty);
            return;
          }

          const currentBags = unit.remaining_bags;
          const stockOutQty = Math.min(bagsQty, currentBags);
          setPendingOut({
            barcode,
            unit,
            currentBags,
            stockOutQty,
            remainingAfter: currentBags - stockOutQty,
          });
        } catch {
          await runScan(barcode, bagsQty);
        } finally {
          processingRef.current = false;
        }
        return;
      }

      await runScan(barcode, bagsQty);
    },
    [runScan]
  );

  const cancelPendingOut = useCallback(() => {
    if (confirmLoading) return;
    setPendingOut(null);
  }, [confirmLoading]);

  const confirmPendingOut = useCallback(async () => {
    if (!pendingOut || confirmLoading) return;
    setConfirmLoading(true);
    processingRef.current = true;
    try {
      await handleScan(
        pendingOut.barcode,
        selectedGodownIdRef.current,
        "STOCK_OUT",
        pendingOut.stockOutQty
      );
      setPendingOut(null);
    } finally {
      processingRef.current = false;
      setConfirmLoading(false);
    }
  }, [pendingOut, confirmLoading, handleScan]);

  const scannerEnabled =
    (!isStockIn || Boolean(selectedGodownId)) && !pendingOut;

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

  const selectedGodown = godowns.find((g) => g.id === selectedGodownId);
  const contextLabel =
    isStockIn && selectedGodown
      ? `${title} · ${selectedGodown.location_name}`
      : title;

  const overlayDetail = lastResult?.stockUnit
    ? `Bale #${lastResult.stockUnit.unit_number} · ${lastResult.stockUnit.unit_barcode}`
    : (lastResult?.product?.name ?? null);

  const pendingProduct =
    pendingOut?.unit.products &&
    typeof pendingOut.unit.products === "object" &&
    "name" in pendingOut.unit.products
      ? String(pendingOut.unit.products.name)
      : "Product";

  const pendingMessage = pendingOut
    ? [
        `Bale #${pendingOut.unit.unit_number} (${pendingProduct}) currently has ${formatBagCount(pendingOut.currentBags)} bags.`,
        `Stocking out ${formatBagCount(pendingOut.stockOutQty)} bags.`,
        pendingOut.remainingAfter > 0
          ? `Leaving ${formatBagCount(pendingOut.remainingAfter)} bags in this bale.`
          : "This will empty the bale (0 bags left).",
      ].join("\n\n")
    : "";

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {isStockIn && (
        <GodownSelector
          godowns={godowns}
          selectedId={selectedGodownId}
          onChange={setSelectedGodownId}
          disabled={processing || confirmLoading}
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
        disabled={processing || confirmLoading || Boolean(pendingOut)}
      />

      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={
            processing ||
            confirmLoading ||
            Boolean(pendingOut) ||
            (isStockIn && !selectedGodownId)
          }
          contextLabel={contextLabel}
          hardwareListening={hardwareListening && scannerEnabled}
          onManualSubmit={onBarcodeDetected}
          overlay={{
            processing: processing || confirmLoading,
            flash: approveFlash ? "success" : errorFlash ? "error" : null,
            message: alert?.message ?? lastResult?.message ?? null,
            detail: overlayDetail,
          }}
        />
      </div>

      <ScanResultStrip
        alert={alert}
        warningAlert={warningAlert}
        lastResult={lastResult}
        mode={transactionType}
        onDismissAlert={dismissAlert}
        onDismissWarning={dismissWarningAlert}
      />

      <ScanTallyPanel tally={tally} mode={transactionType} onReset={resetTally} />

      <p className="text-center text-xs text-zinc-600">
        Scan unit barcodes (87…) — camera, 2D scanner, or typed entry. Default{" "}
        {transactionType === "STOCK_IN"
          ? `${BAGS_PER_BALE.toLocaleString()} bags`
          : "full remaining"}{" "}
        per scan unless Custom preset is set.
        {!isStockIn && qtyPreset === "custom"
          ? " Custom stock-out asks for confirmation with bags remaining."
          : ""}
      </p>

      <ConfirmDialog
        open={Boolean(pendingOut)}
        onClose={cancelPendingOut}
        onConfirm={() => void confirmPendingOut()}
        title="Confirm custom stock out"
        message={pendingMessage}
        confirmLabel="Stock Out"
        loading={confirmLoading}
        destructive
      />
    </div>
  );
}
