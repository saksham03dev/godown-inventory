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
import { Dropdown } from "@/components/ui/Dropdown";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import { useScanTransaction } from "@/hooks/useScanTransaction";
import { RETURN_REASONS } from "@/lib/constants/stockOut";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import {
  processReturnTransaction,
  processTransferTransaction,
} from "@/lib/services/unitScanService";
import { formatBagCount } from "@/lib/utils/inventory";
import type { Godown, StockUnit } from "@/lib/types/database";

interface TransferScanPanelProps {
  godowns: Godown[];
}

export function TransferScanPanel({ godowns }: TransferScanPanelProps) {
  const [fromGodownId, setFromGodownId] = useState("");
  const [toGodownId, setToGodownId] = useState("");
  const processingRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const { tally, recordScan, resetTally } = useScanTally();

  useEffect(() => {
    if (godowns.length > 0 && !fromGodownId) {
      setFromGodownId(godowns[0].id);
    }
    if (godowns.length > 1 && !toGodownId) {
      setToGodownId(godowns[1].id);
    }
  }, [godowns, fromGodownId, toGodownId]);

  const {
    processing,
    alert,
    lastResult,
    approveFlash,
    errorFlash,
    runAction,
    dismissAlert,
  } = useScanTransaction({
    onSuccess: (result) => {
      if (result.isUnitScan !== false) recordScan(result);
    },
  });

  const ready =
    Boolean(fromGodownId) &&
    Boolean(toGodownId) &&
    fromGodownId !== toGodownId;

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || !ready) return;
      processingRef.current = true;
      try {
        await runAction(() =>
          processTransferTransaction({
            barcodeId: barcode,
            fromGodownId,
            toGodownId,
          })
        );
      } finally {
        processingRef.current = false;
        manualInputRef.current?.focus();
      }
    },
    [ready, fromGodownId, toGodownId, runAction]
  );

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId, hardwareListening } =
    useBarcodeInput({ onScan: onBarcodeDetected, enabled: ready && !processing });

  const fromGodown = godowns.find((g) => g.id === fromGodownId);
  const toGodown = godowns.find((g) => g.id === toGodownId);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <GodownSelector
          godowns={godowns}
          selectedId={fromGodownId}
          onChange={setFromGodownId}
          disabled={processing}
        />
        <Dropdown
          label="To godown"
          options={godowns.map((g) => ({
            value: g.id,
            label: g.location_name,
          }))}
          value={toGodownId}
          onChange={setToGodownId}
          placeholder="Destination"
          disabled={processing}
        />
      </div>

      {fromGodownId && toGodownId && fromGodownId === toGodownId && (
        <AlertBanner
          alert={{
            type: "error",
            message: "Source and destination godowns must differ.",
          }}
        />
      )}

      {!ready && fromGodownId !== toGodownId && (
        <AlertBanner
          alert={{ type: "info", message: "Select both godowns to enable scanning." }}
        />
      )}

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 text-sm text-zinc-400">
        Sealed full bales only (1,000 bags, unopened). Scan once to move from{" "}
        {fromGodown?.location_name ?? "source"} to{" "}
        {toGodown?.location_name ?? "destination"}.
      </div>

      <ScannerWindow
        scannerElementId={scannerElementId}
        isScanning={isScanning}
        cameraError={cameraError}
        onStart={startScanning}
        onStop={stopScanning}
        disabled={!ready || processing}
        contextLabel="Transfer sealed bale"
        hardwareListening={hardwareListening && ready}
        onManualSubmit={onBarcodeDetected}
        manualInputRef={manualInputRef}
        manualInputMode="none"
        overlay={{
          processing,
          flash: approveFlash ? "success" : errorFlash ? "error" : null,
          message: alert?.message ?? lastResult?.message ?? null,
          detail: lastResult?.stockUnit
            ? `Bale #${lastResult.stockUnit.unit_number}`
            : null,
        }}
      />

      <ScanResultStrip
        alert={alert}
        lastResult={lastResult}
        mode="STOCK_OUT"
        onDismissAlert={dismissAlert}
      />

      <ScanTallyPanel tally={tally} mode="STOCK_OUT" onReset={resetTally} />
    </div>
  );
}

interface ReturnScanPanelProps {
  godowns: Godown[];
}

interface PendingReturnConfirm {
  barcode: string;
  unit: StockUnit;
  bagsQty: number;
}

export function ReturnScanPanel({ godowns }: ReturnScanPanelProps) {
  const [selectedGodownId, setSelectedGodownId] = useState("");
  const [qtyPreset, setQtyPreset] = useState<QtyPresetMode>("full");
  const [customQty, setCustomQty] = useState("");
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [pending, setPending] = useState<PendingReturnConfirm | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const processingRef = useRef(false);
  const qtyPresetRef = useRef(qtyPreset);
  const customQtyRef = useRef(customQty);
  const selectedGodownIdRef = useRef(selectedGodownId);
  const reasonRef = useRef(reason);
  const pendingRef = useRef(pending);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const { tally, recordScan, resetTally } = useScanTally();

  qtyPresetRef.current = qtyPreset;
  customQtyRef.current = customQty;
  selectedGodownIdRef.current = selectedGodownId;
  reasonRef.current = reason;
  pendingRef.current = pending;

  useEffect(() => {
    if (godowns.length > 0 && !selectedGodownId) {
      setSelectedGodownId(godowns[0].id);
    }
  }, [godowns, selectedGodownId]);

  const {
    processing,
    alert,
    lastResult,
    approveFlash,
    errorFlash,
    runAction,
    dismissAlert,
  } = useScanTransaction({
    onSuccess: (result) => {
      if (result.isUnitScan !== false) recordScan(result);
    },
  });

  const executeReturn = useCallback(
    async (barcode: string, bagsQty: number | null) => {
      const godownId = selectedGodownIdRef.current;
      if (!godownId) return;
      await runAction(() =>
        processReturnTransaction({
          barcodeId: barcode,
          godownId,
          bagsQty,
          reason: reasonRef.current,
        })
      );
    },
    [runAction]
  );

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || pendingRef.current) return;
      const godownId = selectedGodownIdRef.current;
      if (!godownId) return;

      if (qtyPresetRef.current === "custom") {
        const n = Math.floor(Number(customQtyRef.current));
        if (!Number.isFinite(n) || n < 1) return;
      }

      const bagsQty = resolvePresetBagsQty(
        qtyPresetRef.current,
        customQtyRef.current
      );

      if (qtyPresetRef.current === "custom" && bagsQty != null) {
        processingRef.current = true;
        try {
          const unit = await fetchStockUnitByBarcode(barcode);
          if (!unit) {
            await executeReturn(barcode, bagsQty);
            return;
          }
          if (unit.status === "LABELLED") {
            await executeReturn(barcode, bagsQty);
            return;
          }
          const maxReturn =
            unit.status === "STOCKED_OUT"
              ? 1000
              : Math.max(0, 1000 - unit.remaining_bags);
          const returnQty = Math.min(bagsQty, maxReturn || bagsQty);
          setPending({
            barcode,
            unit,
            bagsQty: returnQty,
          });
        } catch {
          await executeReturn(barcode, bagsQty);
        } finally {
          processingRef.current = false;
        }
        return;
      }

      processingRef.current = true;
      try {
        await executeReturn(barcode, bagsQty);
      } finally {
        processingRef.current = false;
        manualInputRef.current?.focus();
      }
    },
    [executeReturn]
  );

  const pendingProduct =
    pending?.unit.products &&
    typeof pending.unit.products === "object" &&
    "name" in pending.unit.products
      ? String(pending.unit.products.name)
      : "Product";

  const pendingMessage = pending
    ? [
        `Bale #${pending.unit.unit_number} (${pendingProduct}).`,
        pending.unit.status === "STOCKED_OUT"
          ? `Restoring ${formatBagCount(pending.bagsQty)} bags into inventory.`
          : `Adding ${formatBagCount(pending.bagsQty)} bags back (currently ${formatBagCount(pending.unit.remaining_bags)} in bale).`,
      ].join("\n\n")
    : "";

  const scannerEnabled = Boolean(selectedGodownId) && !pending;

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId, hardwareListening } =
    useBarcodeInput({
      onScan: onBarcodeDetected,
      enabled: scannerEnabled && !processing && !confirmLoading,
    });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <GodownSelector
        godowns={godowns}
        selectedId={selectedGodownId}
        onChange={setSelectedGodownId}
        disabled={processing || confirmLoading}
      />

      <Dropdown
        label="Return reason (optional)"
        options={RETURN_REASONS.map((r) => ({ value: r, label: r }))}
        value={reason}
        onChange={setReason}
        disabled={processing || confirmLoading}
      />

      <StockQtyPreset
        transactionType="STOCK_IN"
        preset={qtyPreset}
        customQty={customQty}
        onPresetChange={setQtyPreset}
        onCustomQtyChange={setCustomQty}
        disabled={processing || confirmLoading || Boolean(pending)}
      />

      {!selectedGodownId && (
        <AlertBanner
          alert={{
            type: "info",
            message: "Select a godown where returned stock will be placed.",
          }}
        />
      )}

      <ScannerWindow
        scannerElementId={scannerElementId}
        isScanning={isScanning}
        cameraError={cameraError}
        onStart={startScanning}
        onStop={stopScanning}
        disabled={
          !selectedGodownId ||
          processing ||
          confirmLoading ||
          Boolean(pending)
        }
        contextLabel="Return stock"
        hardwareListening={hardwareListening && scannerEnabled}
        onManualSubmit={onBarcodeDetected}
        manualInputRef={manualInputRef}
        manualInputMode="none"
        overlay={{
          processing: processing || confirmLoading,
          flash: approveFlash ? "success" : errorFlash ? "error" : null,
          message: alert?.message ?? lastResult?.message ?? null,
          detail: lastResult?.stockUnit
            ? `Bale #${lastResult.stockUnit.unit_number}`
            : null,
        }}
      />

      <ScanResultStrip
        alert={alert}
        lastResult={lastResult}
        mode="STOCK_IN"
        onDismissAlert={dismissAlert}
      />

      <ScanTallyPanel tally={tally} mode="STOCK_IN" onReset={resetTally} />

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => {
          if (!confirmLoading) setPending(null);
        }}
        onConfirm={async () => {
          if (!pending || confirmLoading) return;
          setConfirmLoading(true);
          processingRef.current = true;
          try {
            await executeReturn(pending.barcode, pending.bagsQty);
            setPending(null);
          } finally {
            processingRef.current = false;
            setConfirmLoading(false);
            manualInputRef.current?.focus();
          }
        }}
        title="Confirm return stock"
        message={pendingMessage}
        confirmLabel="Return Stock"
        loading={confirmLoading}
        destructive={false}
      />
    </div>
  );
}
