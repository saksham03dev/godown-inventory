"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ScannerWindow,
} from "@/components/scan/ScannerWindow";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { StockUnit } from "@/lib/types/database";

export default function ViewLabelPage() {
  const { can, loading: authLoading } = useAuth();
  const [labelUnit, setLabelUnit] = useState<StockUnit | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const processingRef = useRef(false);

  const lookupLabel = useCallback(async (barcode: string) => {
    setLabelLoading(true);
    setLabelError(null);
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
      processingRef.current = true;
      try {
        await lookupLabel(barcode);
      } finally {
        processingRef.current = false;
      }
    },
    [lookupLabel]
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
    enabled: true,
  });

  if (authLoading) {
    return (
      <DashboardLayout title="View Label" subtitle="Bale barcode lookup">
        <LoadingSpinner label="Loading…" />
      </DashboardLayout>
    );
  }

  if (!can("scan.viewLabel")) {
    return (
      <DashboardLayout title="View Label" subtitle="Bale barcode lookup">
        <AlertBanner
          alert={{
            type: "error",
            message: "Only admins can look up label details.",
          }}
        />
      </DashboardLayout>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="View Label" subtitle="Bale barcode lookup">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local before looking up labels.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="View Label"
      subtitle="Scan any bale — in stock or sold"
    >
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-zinc-400">
          Scan or type a unit barcode (87…) to see product, source, purchase no.,
          location, and sold-to history.
        </p>

        <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
          <ScannerWindow
            scannerElementId={scannerElementId}
            isScanning={isScanning}
            cameraError={cameraError}
            onStart={startScanning}
            onStop={stopScanning}
            disabled={labelLoading}
            contextLabel="View Label · any bale barcode"
            hardwareListening={hardwareListening}
            onManualSubmit={onBarcodeDetected}
            overlay={{
              processing: labelLoading,
              flash: labelError ? "error" : null,
              message: labelError,
            }}
          />
        </div>

        <div className="min-h-[6rem]">
          {labelError && !labelLoading && (
            <AlertBanner alert={{ type: "error", message: labelError }} />
          )}
          {labelUnit && (
            <LabelDetailCard unit={labelUnit} showBatchInboundMeta />
          )}
          {!labelUnit && !labelError && !labelLoading && (
            <div className="rounded-xl border border-dashed border-surface-border px-4 py-6 text-center text-xs text-zinc-600">
              Scan a unit barcode to view full label details
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
