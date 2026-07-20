"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScanModeToggle } from "@/components/scan/ScanModeToggle";
import { GodownSelector } from "@/components/scan/GodownSelector";
import {
  ScannerWindow,
  ScanResultStrip,
} from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { useScanTally } from "@/hooks/useScanTally";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScanMode } from "@/lib/types/scan";
import type {
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

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const modeRef = useRef(mode);
  const onSuccessRef = useRef<(result: ScanTransactionResult) => void>(() => {});

  const { godowns, loading, error } = useInventory();
  const { tally, recordScan, resetTally } = useScanTally();

  onSuccessRef.current = (result) => {
    if (
      (modeRef.current === "STOCK_IN" || modeRef.current === "STOCK_OUT") &&
      result.isUnitScan
    ) {
      recordScan(result);
    }
  };

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

      processingRef.current = true;
      try {
        await handleScan(barcode, godownId, currentMode as TransactionType);
      } finally {
        processingRef.current = false;
      }
    },
    [handleScan, lookupLabel]
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
    dismissWarningAlert();
    clearApproveFlash();
    setLabelUnit(null);
    setLabelError(null);
  }, [selectedGodownId, mode, resetDebounce, dismissAlert, dismissWarningAlert, clearApproveFlash]);

  useEffect(() => {
    if (mode === "STOCK_IN" || mode === "STOCK_OUT") {
      resetTally();
    }
  }, [selectedGodownId, mode, resetTally]);

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
              {labelUnit && <LabelDetailCard unit={labelUnit} />}
              {!labelUnit && !labelError && !labelLoading && (
                <div className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-zinc-600">
                  Scan a unit barcode to view label details
                </div>
              )}
            </div>
          ) : (
            <ScanResultStrip
              alert={alert}
              warningAlert={warningAlert}
              lastResult={lastResult}
              mode={transactionMode}
              onDismissAlert={dismissAlert}
              onDismissWarning={dismissWarningAlert}
            />
          )}

          {/* Tally below camera — growth no longer shifts the viewfinder */}
          {(mode === "STOCK_IN" || mode === "STOCK_OUT") && (
            <ScanTallyPanel
              tally={tally}
              mode={transactionMode}
              onReset={resetTally}
            />
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
