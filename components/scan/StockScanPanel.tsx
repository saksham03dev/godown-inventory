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
import { WarehouseSelectModal } from "@/components/scan/WarehouseSelectModal";
import { WarehouseSelectPrompt } from "@/components/scan/WarehouseSelectPrompt";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { useStockInQueue } from "@/hooks/useStockInQueue";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { formatBagCount } from "@/lib/utils/inventory";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import type { AlertState, Godown, StockUnit, TransactionType } from "@/lib/types/database";

interface StockScanPanelProps {
  transactionType: TransactionType;
  godowns: Godown[];
  title: string;
}

function productFromUnit(unit: StockUnit) {
  const raw = unit.products;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "name" in raw) {
    return {
      productId: unit.product_id,
      productName: String(raw.name ?? "Product"),
      productCode: "product_code" in raw ? String(raw.product_code ?? "") : "",
      size: "size" in raw && raw.size ? String(raw.size) : null,
    };
  }
  return {
    productId: unit.product_id,
    productName: "Product",
    productCode: unit.unit_barcode,
    size: null as string | null,
  };
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
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<AlertState | null>(null);
  const [acceptFlash, setAcceptFlash] = useState<"success" | "error" | null>(null);
  const [checkingLabel, setCheckingLabel] = useState(false);
  const isMobile = useIsMobile();
  const stockInQueue = useStockInQueue();

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const qtyPresetRef = useRef(qtyPreset);
  const customQtyRef = useRef(customQty);
  const transactionTypeRef = useRef(transactionType);
  const pendingOutRef = useRef(pendingOut);

  const { tally, recordScan, recordStockIn, resetTally, replaceTallyFromBags } = useScanTally();
  qtyPresetRef.current = qtyPreset;
  customQtyRef.current = customQty;
  transactionTypeRef.current = transactionType;
  pendingOutRef.current = pendingOut;

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
      if (result.isUnitScan === false) return;
      if (transactionTypeRef.current === "STOCK_IN") {
        recordStockIn(result);
        return;
      }
      recordScan(result);
    },
  });

  useEffect(() => {
    selectedGodownIdRef.current = selectedGodownId;
  }, [selectedGodownId]);

  useEffect(() => {
    if (isStockIn) return;
    resetTally();
    dismissAlert();
    clearApproveFlash();
    setPendingOut(null);
  }, [isStockIn, selectedGodownId, transactionType, resetTally, dismissAlert, clearApproveFlash]);

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
      if (transactionTypeRef.current === "STOCK_IN" && !godownId) {
        setScanHint("Pick a warehouse first.");
        return;
      }

      if (qtyPresetRef.current === "custom") {
        const n = Math.floor(Number(customQtyRef.current));
        if (!Number.isFinite(n) || n < 1) {
          setScanHint("Enter bag count first.");
          return;
        }
      }

      setScanHint(null);

      const bagsQty = resolvePresetBagsQty(
        qtyPresetRef.current,
        customQtyRef.current
      );

      if (transactionTypeRef.current === "STOCK_IN") {
        processingRef.current = true;
        setCheckingLabel(true);
        try {
          const unit = await fetchStockUnitByBarcode(barcode);
          if (!unit) {
            setQueueNotice({ type: "error", message: "Unknown barcode." });
            setAcceptFlash("error");
            playScanReject();
            return;
          }
          if (stockInQueue.containsBarcode(unit.unit_barcode)) {
            setQueueNotice({
              type: "error",
              message: "This label is already in the list on this phone.",
            });
            setAcceptFlash("error");
            playScanReject();
            return;
          }
          if (unit.status !== "LABELLED") {
            const state = unit.status.toLowerCase().replace(/_/g, " ");
            setQueueNotice({ type: "error", message: `Unit already ${state}.` });
            setAcceptFlash("error");
            playScanReject();
            return;
          }
          const meta = productFromUnit(unit);
          const added = stockInQueue.enqueue(godownId, {
            barcode: unit.unit_barcode,
            bagsQty: bagsQty ?? BAGS_PER_BALE,
            ...meta,
            unitNumber: unit.unit_number,
          });
          if (!added) {
            setQueueNotice({
              type: "error",
              message: "This label is already in the list on this phone.",
            });
            setAcceptFlash("error");
            playScanReject();
            return;
          }
          setQueueNotice({
            type: "success",
            message: `Accepted on this phone · bale #${unit.unit_number}. Sending to the warehouse.`,
          });
          setAcceptFlash("success");
          playScanOkay();
        } catch (err) {
          setQueueNotice({
            type: "error",
            message: err instanceof Error ? err.message : "Could not check this label.",
          });
          setAcceptFlash("error");
          playScanReject();
        } finally {
          processingRef.current = false;
          setCheckingLabel(false);
        }
        return;
      }

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
    [runScan, stockInQueue]
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

  useEffect(() => {
    if (!acceptFlash) return;
    const timer = window.setTimeout(() => setAcceptFlash(null), 900);
    return () => window.clearTimeout(timer);
  }, [acceptFlash, queueNotice]);

  const stockInItems = isStockIn ? stockInQueue.itemsFor(selectedGodownId) : [];
  const stockInProgress = isStockIn ? stockInQueue.countsFor(selectedGodownId) : null;

  useEffect(() => {
    if (!isStockIn) return;
    replaceTallyFromBags(
      stockInItems
        .filter((item) => item.status !== "failed")
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          size: item.size,
          bags: item.bagsQty,
        }))
    );
  }, [isStockIn, stockInItems, replaceTallyFromBags]);

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
      {isStockIn && isMobile && (
        <WarehouseSelectModal
          open={!selectedGodownId}
          godowns={godowns}
          selectedId={selectedGodownId}
          onChange={setSelectedGodownId}
          disabled={processing || confirmLoading}
        />
      )}

      {isStockIn && !isMobile && !selectedGodownId && <WarehouseSelectPrompt />}

      {isStockIn && (!isMobile || selectedGodownId) && (
        <GodownSelector
          godowns={godowns}
          selectedId={selectedGodownId}
          onChange={setSelectedGodownId}
          disabled={processing || confirmLoading}
        />
      )}

      {scanHint && (
        <AlertBanner
          alert={{ type: "error", message: scanHint }}
          onDismiss={() => setScanHint(null)}
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
            processing: isStockIn ? checkingLabel : processing || confirmLoading,
            flash: isStockIn
              ? acceptFlash
              : approveFlash
                ? "success"
                : errorFlash
                  ? "error"
                  : null,
            message: isStockIn
              ? queueNotice?.message ?? null
              : alert?.message ?? lastResult?.message ?? null,
            detail: isStockIn ? null : overlayDetail,
          }}
        />
      </div>

      {isStockIn ? (
        queueNotice && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              queueNotice.type === "error"
                ? "border-danger/30 bg-danger/5 text-zinc-200"
                : "border-success/30 bg-success/5 text-zinc-100"
            }`}
          >
            {queueNotice.message}
          </div>
        )
      ) : (
        <ScanResultStrip
          alert={alert}
          lastResult={lastResult}
          mode={transactionType}
          onDismissAlert={dismissAlert}
        />
      )}

      <ScanTallyPanel
        tally={tally}
        mode={transactionType}
        progressLabel={
          stockInProgress
            ? `${stockInProgress.scanned} scanned · ${stockInProgress.inWarehouse} in warehouse · ${stockInProgress.sending} sending`
            : null
        }
        onReset={() => {
          if (isStockIn) {
            stockInQueue.clearSaved(selectedGodownId);
            return;
          }
          resetTally();
        }}
      />

      {isStockIn && stockInItems.some((item) => item.status === "failed") && (
        <ul className="space-y-2 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm">
          {stockInItems
            .filter((item) => item.status === "failed")
            .map((item) => (
              <li key={item.barcode} className="text-zinc-200">
                <span className="font-mono text-xs">{item.barcode}</span>
                <span className="mt-0.5 block text-xs text-danger">
                  {item.error ?? "Could not stock in this label."}
                </span>
              </li>
            ))}
        </ul>
      )}

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
