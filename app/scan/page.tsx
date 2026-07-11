"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ScanModeToggle } from "@/components/scan/ScanModeToggle";
import { GodownSelector } from "@/components/scan/GodownSelector";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { ScanFeedback } from "@/components/scan/ScanFeedback";
import { StockInTallyPanel } from "@/components/scan/StockInTallyPanel";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useInventory } from "@/hooks/useInventory";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { useStockInTally } from "@/hooks/useStockInTally";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { ScanMode } from "@/lib/types/scan";
import type { StockUnit, TransactionType } from "@/lib/types/database";

export default function ScanPage() {
  const { can, role } = useAuth();
  const canViewLabel = can("scan.viewLabel");
  const isEmployee = role === "employee";

  const [mode, setMode] = useState<ScanMode>("STOCK_IN");
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [labelUnit, setLabelUnit] = useState<StockUnit | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const modeRef = useRef(mode);

  const { godowns, loading, error } = useInventory();
  const { tally, recordStockIn, resetTally } = useStockInTally();

  const {
    processing,
    alert,
    lastResult,
    approveFlash,
    handleScan,
    dismissAlert,
    clearApproveFlash,
  } = useScanTransaction({
    onSuccess: (result) => {
      if (modeRef.current === "STOCK_IN" && result.isUnitScan) {
        recordStockIn(result);
      }
    },
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
    setLabelUnit(null);
    try {
      const unit = await fetchStockUnitByBarcode(barcode);
      if (!unit) {
        setLabelError(`No label found for barcode: ${barcode}`);
        return;
      }
      setLabelUnit(unit);
    } catch (err) {
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

  const { isScanning, cameraError, startScanning, stopScanning, resetDebounce, scannerElementId } =
    useBarcodeScan({
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
    if (mode === "STOCK_IN") {
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
    ? "View Label · scan any unit barcode"
    : selectedGodown
      ? `${mode === "STOCK_IN" ? "Stock In" : "Stock Out"} · ${selectedGodown.location_name}`
      : undefined;

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
      subtitle={
        isEmployee
          ? "Scan labels to stock in or stock out inventory"
          : "Stock in, stock out, and view label details"
      }
    >
      {loading ? (
        <LoadingSpinner label="Loading scan station…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
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

          {mode === "STOCK_IN" && (
            <StockInTallyPanel tally={tally} onReset={resetTally} />
          )}

          <ScannerWindow
            scannerElementId={scannerElementId}
            isScanning={isScanning}
            cameraError={cameraError}
            onStart={startScanning}
            onStop={stopScanning}
            disabled={processing || labelLoading || !scannerEnabled}
            contextLabel={contextLabel}
          />

          {isViewLabel && (
            <>
              {labelLoading && (
                <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm text-accent">
                  Looking up label…
                </div>
              )}
              {labelError && (
                <AlertBanner alert={{ type: "error", message: labelError }} />
              )}
              {labelUnit && <LabelDetailCard unit={labelUnit} />}
            </>
          )}

          {!isViewLabel && (
            <ScanFeedback
              alert={alert}
              lastResult={lastResult}
              processing={processing}
              mode={transactionMode}
              onDismissAlert={dismissAlert}
              showApproveFlash={approveFlash}
            />
          )}

          <p className="text-center text-xs text-zinc-600">
            Scan unit label barcodes (87…) one at a time. Camera requires HTTPS
            or localhost.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
