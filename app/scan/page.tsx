"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ModeToggle } from "@/components/scan/ModeToggle";
import { GodownSelector } from "@/components/scan/GodownSelector";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { ScanFeedback } from "@/components/scan/ScanFeedback";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useInventory } from "@/hooks/useInventory";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { TransactionType } from "@/lib/types/database";

export default function ScanPage() {
  const [mode, setMode] = useState<TransactionType>("STOCK_IN");
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const processingRef = useRef(false);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const modeRef = useRef(mode);

  const { godowns, loading, error } = useInventory();

  const {
    processing,
    alert,
    lastResult,
    quantity,
    setQuantity,
    handleScan,
    dismissAlert,
  } = useScanTransaction();

  useEffect(() => {
    selectedGodownIdRef.current = selectedGodownId;
  }, [selectedGodownId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      const godownId = selectedGodownIdRef.current;
      const transactionType = modeRef.current;
      if (processingRef.current || !godownId) return;
      processingRef.current = true;
      try {
        await handleScan(barcode, godownId, transactionType);
      } finally {
        processingRef.current = false;
      }
    },
    [handleScan]
  );

  const { isScanning, cameraError, startScanning, stopScanning, resetDebounce, scannerElementId } =
    useBarcodeScan({
      onScan: onBarcodeDetected,
      enabled: Boolean(selectedGodownId),
    });

  // Keep scanner state in sync when godown or mode changes mid-session
  useEffect(() => {
    resetDebounce();
    dismissAlert();
  }, [selectedGodownId, mode, resetDebounce, dismissAlert]);

  useEffect(() => {
    if (godowns.length > 0 && !selectedGodownId) {
      setSelectedGodownId(godowns[0].id);
    }
  }, [godowns, selectedGodownId]);

  const selectedGodown = godowns.find((g) => g.id === selectedGodownId);

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
      subtitle="Mobile-optimized stock in / stock out operations"
    >
      {loading ? (
        <LoadingSpinner label="Loading scan station…" />
      ) : error ? (
        <AlertBanner alert={{ type: "error", message: error }} />
      ) : (
        <div className="mx-auto max-w-lg space-y-5 animate-fade-in">
          <ModeToggle
            mode={mode}
            onChange={setMode}
            disabled={processing}
          />

          <GodownSelector
            godowns={godowns}
            selectedId={selectedGodownId}
            onChange={setSelectedGodownId}
            disabled={processing}
          />

          {!selectedGodownId && (
            <AlertBanner
              alert={{
                type: "info",
                message: "Select a godown to enable scanning.",
              }}
            />
          )}

          <ScannerWindow
            scannerElementId={scannerElementId}
            isScanning={isScanning}
            cameraError={cameraError}
            onStart={startScanning}
            onStop={stopScanning}
            disabled={processing || !selectedGodownId}
            contextLabel={
              selectedGodown
                ? `${mode === "STOCK_IN" ? "Stock In" : "Stock Out"} · ${selectedGodown.location_name}`
                : undefined
            }
          />

          <ScanFeedback
            alert={alert}
            lastResult={lastResult}
            processing={processing}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onDismissAlert={dismissAlert}
          />

          <p className="text-center text-xs text-zinc-600">
            Unit barcodes (87…) scan one item at a time. Product barcodes (89…) use bulk quantity.
            Requires HTTPS or localhost for camera.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
