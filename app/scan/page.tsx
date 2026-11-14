"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScanModeToggle } from "@/components/scan/ScanModeToggle";
import { ScanSoundToggle } from "@/components/scan/ScanSoundToggle";
import { GodownSelector } from "@/components/scan/GodownSelector";
import {
  ScannerWindow,
  ScanResultStrip,
} from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import { StockInTruckUnloadButton } from "@/components/scan/StockInTruckUnloadButton";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { useScanTally } from "@/hooks/useScanTally";
import { useStockInQueue } from "@/hooks/useStockInQueue";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScanMode } from "@/lib/types/scan";
import type {
  AlertState,
  ScanTransactionResult,
  StockUnit,
  TransactionType,
} from "@/lib/types/database";

export default function ScanPage() {
  const { can } = useAuth();
  const canViewLabel = can("scan.viewLabel");

  const [mode, setMode] = useState<ScanMode>("STOCK_IN");
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [labelUnit, setLabelUnit] = useState<StockUnit | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [queueNotice, setQueueNotice] = useState<AlertState | null>(null);
  const [acceptFlash, setAcceptFlash] = useState<"success" | "error" | null>(null);
  const [checkingLabel, setCheckingLabel] = useState(false);
  const [truckUnloadLoading, setTruckUnloadLoading] = useState(false);
  const stockInQueue = useStockInQueue();

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const modeRef = useRef(mode);
  const onSuccessRef = useRef<(result: ScanTransactionResult) => void>(() => {});

  const { godowns, loading, error } = useInventory();
  const { tally, recordScan, recordStockIn, resetTally, replaceTallyFromBags } = useScanTally();

  onSuccessRef.current = (result) => {
    if (result.isUnitScan === false) return;
    if (modeRef.current === "STOCK_IN") {
      recordStockIn(result);
      return;
    }
    if (modeRef.current === "STOCK_OUT") {
      recordScan(result);
    }
  };

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
    onSuccess: (result) => onSuccessRef.current(result),
  });

  useEffect(() => {
    selectedGodownIdRef.current = selectedGodownId;
  }, [selectedGodownId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const isViewLabel = mode === "VIEW_LABEL";
  const transactionMode = mode as TransactionType;
  const scannerEnabled = isViewLabel || Boolean(selectedGodownId);

  const lookupLabel = useCallback(async (barcode: string) => {
    setLabelLoading(true);
    setLabelError(null);
    // Keep previous label visible until new one loads — avoids layout jump
    try {
      const unit = await fetchStockUnitByBarcode(barcode);
      if (!unit) {
        setLabelUnit(null);
        setLabelError(`No label found for barcode: ${barcode}`);
        return;
      }
      setLabelUnit(unit);
    } catch (err) {
      setLabelUnit(null);
      setLabelError(
        err instanceof Error ? err.message : "Failed to look up label."
      );
    } finally {
      setLabelLoading(false);
    }
  }, []);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current) return;

      const currentMode = modeRef.current;

      if (currentMode === "VIEW_LABEL") {
        processingRef.current = true;
        try {
          await lookupLabel(barcode);
        } finally {
          processingRef.current = false;
        }
        return;
      }

      const godownId = selectedGodownIdRef.current;
      if (!godownId) return;

      if (currentMode === "STOCK_IN") {
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
            setQueueNotice({
              type: "error",
              message: `Unit already ${unit.status.toLowerCase().replace(/_/g, " ")}.`,
            });
            setAcceptFlash("error");
            playScanReject();
            return;
          }
          const product = unit.products;
          const named =
            product && typeof product === "object" && !Array.isArray(product) && "name" in product
              ? product
              : null;
          const added = stockInQueue.enqueue(godownId, {
            barcode: unit.unit_barcode,
            bagsQty: BAGS_PER_BALE,
            productId: unit.product_id,
            productName: named ? String(named.name ?? "Product") : "Product",
            productCode:
              named && "product_code" in named ? String(named.product_code ?? "") : unit.unit_barcode,
            size: named && "size" in named && named.size ? String(named.size) : null,
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

      processingRef.current = true;
      try {
        await handleScan(barcode, godownId, currentMode as TransactionType);
      } finally {
        processingRef.current = false;
      }
    },
    [handleScan, lookupLabel, stockInQueue]
  );

  const {
    isScanning,
    cameraError,
    startScanning,
    stopScanning,
    resetDebounce,
    scannerElementId,
    hardwareListening,
  } = useBarcodeInput({
    onScan: onBarcodeDetected,
    enabled: scannerEnabled,
  });

  useEffect(() => {
    resetDebounce();
    dismissAlert();
    clearApproveFlash();
    setLabelUnit(null);
    setLabelError(null);
  }, [selectedGodownId, mode, resetDebounce, dismissAlert, clearApproveFlash]);

  useEffect(() => {
    if (mode === "STOCK_OUT") resetTally();
  }, [selectedGodownId, mode, resetTally]);

  const stockInItems = mode === "STOCK_IN" ? stockInQueue.itemsFor(selectedGodownId) : [];
  const stockInProgress = mode === "STOCK_IN" ? stockInQueue.countsFor(selectedGodownId) : null;

  useEffect(() => {
    if (mode !== "STOCK_IN") return;
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
  }, [mode, stockInItems, replaceTallyFromBags]);

  useEffect(() => {
    if (!acceptFlash) return;
    const timer = window.setTimeout(() => setAcceptFlash(null), 900);
    return () => window.clearTimeout(timer);
  }, [acceptFlash, queueNotice]);

  useEffect(() => {
    if (godowns.length > 0 && !selectedGodownId) {
      setSelectedGodownId(godowns[0].id);
    }
  }, [godowns, selectedGodownId]);

  const selectedGodown = godowns.find((g) => g.id === selectedGodownId);

  const contextLabel = isViewLabel
    ? "View Label · scan any bale barcode"
    : selectedGodown
      ? `${mode === "STOCK_IN" ? "Stock In" : "Wholesale Out"} · ${selectedGodown.location_name}`
      : undefined;

  const handleTruckUnloaded = useCallback(async () => {
    if (mode !== "STOCK_IN" || !selectedGodownId || truckUnloadLoading) return;
    setTruckUnloadLoading(true);
    setQueueNotice(null);
    try {
      const result = await stockInQueue.completeTruckUnload(selectedGodownId);
      if (!result.success) {
        setQueueNotice({ type: "error", message: result.message });
        setAcceptFlash("error");
        playScanReject();
        return;
      }
      resetTally();
      setQueueNotice({ type: "success", message: result.message });
      setAcceptFlash("success");
      playScanOkay();
    } finally {
      setTruckUnloadLoading(false);
    }
  }, [mode, selectedGodownId, truckUnloadLoading, stockInQueue, resetTally]);

  const overlayDetail = lastResult?.stockUnit
    ? `Bale #${lastResult.stockUnit.unit_number} · ${lastResult.stockUnit.unit_barcode}`
    : lastResult?.product?.name ?? null;

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Scan Station" subtitle="Barcode operations">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local before using the scan station.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Scan Station"
      subtitle="Barcode operations"
    >
      {loading ? (
        <LoadingSpinner label="Loading scan station…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          <ScanModeToggle
            mode={mode}
            onChange={setMode}
            disabled={processing || labelLoading}
            showViewLabel={canViewLabel}
          />

          {!isViewLabel && (
            <GodownSelector
              godowns={godowns}
              selectedId={selectedGodownId}
              onChange={setSelectedGodownId}
              disabled={processing}
            />
          )}

          {mode === "STOCK_IN" && <ScanSoundToggle variant="full" />}

          {!isViewLabel && !selectedGodownId && (
            <AlertBanner
              alert={{
                type: "info",
                message: "Select a godown to enable scanning.",
              }}
            />
          )}

          {/* Camera stays above growing content so scans don't push the frame */}
          <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <ScannerWindow
              scannerElementId={scannerElementId}
              isScanning={isScanning}
              cameraError={cameraError}
              onStart={startScanning}
              onStop={stopScanning}
              disabled={processing || labelLoading || !scannerEnabled}
              contextLabel={contextLabel}
              hardwareListening={hardwareListening && scannerEnabled}
              onManualSubmit={onBarcodeDetected}
              overlay={
                isViewLabel
                  ? {
                      processing: labelLoading,
                      flash: labelError ? "error" : null,
                      message: labelError,
                    }
                  : mode === "STOCK_IN"
                    ? {
                        processing: checkingLabel,
                        flash: acceptFlash,
                        message: queueNotice?.message ?? null,
                      }
                    : {
                        processing,
                        flash: approveFlash
                          ? "success"
                          : errorFlash
                            ? "error"
                            : null,
                        message: alert?.message ?? lastResult?.message ?? null,
                        detail: overlayDetail,
                      }
              }
            />
          </div>

          {isViewLabel ? (
            <div className="min-h-[6rem] [overflow-anchor:none]">
              {labelError && !labelLoading && (
                <AlertBanner alert={{ type: "error", message: labelError }} />
              )}
              {labelUnit && (
                <LabelDetailCard unit={labelUnit} showBatchInboundMeta />
              )}
              {!labelUnit && !labelError && !labelLoading && (
                <div className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-zinc-600">
                  Scan a unit barcode to view label details
                </div>
              )}
            </div>
          ) : mode === "STOCK_IN" ? (
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
              mode={transactionMode}
              onDismissAlert={dismissAlert}
            />
          )}

          {(mode === "STOCK_IN" || mode === "STOCK_OUT") && (
            <ScanTallyPanel
              tally={tally}
              mode={transactionMode}
              progressLabel={
                stockInProgress
                  ? `${stockInProgress.scanned} scanned · ${stockInProgress.inWarehouse} in warehouse · ${stockInProgress.sending} sending`
                  : null
              }
              onReset={mode === "STOCK_OUT" ? resetTally : undefined}
            />
          )}

          {mode === "STOCK_IN" && (
            <StockInTruckUnloadButton
              baleCount={tally.sessionBales}
              loading={truckUnloadLoading}
              disabled={!selectedGodownId || checkingLabel || processing}
              onClick={() => void handleTruckUnloaded()}
            />
          )}

          {mode === "STOCK_IN" && stockInItems.some((item) => item.status === "failed") && (
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
            Scan unit label barcodes (87…) one at a time — camera, 2D scanner, or
            typed entry. Camera needs HTTPS or localhost.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
