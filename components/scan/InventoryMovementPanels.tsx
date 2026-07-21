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
import {
  TRANSFER_PHASE_STORAGE_KEY,
  type TransferPhase,
} from "@/lib/constants/transfer";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import {
  processReturnTransaction,
  processTransferTransaction,
} from "@/lib/services/unitScanService";
import { formatBagCount } from "@/lib/utils/inventory";
import { TransferPhaseSwitch } from "@/components/scan/TransferPhaseSwitch";
import type { Godown, StockUnit } from "@/lib/types/database";

function readStoredTransferPhase(): TransferPhase {
  if (typeof window === "undefined") return "dispatch";
  return localStorage.getItem(TRANSFER_PHASE_STORAGE_KEY) === "receive"
    ? "receive"
    : "dispatch";
}

interface TransferScanPanelProps {
  godowns: Godown[];
}

export function TransferScanPanel({ godowns }: TransferScanPanelProps) {
  const [phase, setPhase] = useState<TransferPhase>("dispatch");
  const [fromGodownId, setFromGodownId] = useState("");
  const [toGodownId, setToGodownId] = useState("");
  const processingRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef(phase);
  const fromGodownIdRef = useRef(fromGodownId);
  const toGodownIdRef = useRef(toGodownId);

  const { tally, recordScan, resetTally } = useScanTally();

  phaseRef.current = phase;
  fromGodownIdRef.current = fromGodownId;
  toGodownIdRef.current = toGodownId;

  useEffect(() => {
    setPhase(readStoredTransferPhase());
  }, []);

  useEffect(() => {
    localStorage.setItem(TRANSFER_PHASE_STORAGE_KEY, phase);
    resetTally();
  }, [phase, resetTally]);

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

  const isDispatch = phase === "dispatch";
  const ready = isDispatch
    ? Boolean(fromGodownId) &&
      Boolean(toGodownId) &&
      fromGodownId !== toGodownId
    : Boolean(toGodownId);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (processingRef.current || !ready) return;
      processingRef.current = true;
      try {
        const currentPhase = phaseRef.current;
        await runAction(() =>
          processTransferTransaction({
            barcodeId: barcode,
            phase: currentPhase,
            fromGodownId: fromGodownIdRef.current || undefined,
            toGodownId: toGodownIdRef.current,
          })
        );
      } finally {
        processingRef.current = false;
        manualInputRef.current?.focus();
      }
    },
    [ready, runAction]
  );

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId, hardwareListening } =
    useBarcodeInput({ onScan: onBarcodeDetected, enabled: ready && !processing });

  const fromGodown = godowns.find((g) => g.id === fromGodownId);
  const toGodown = godowns.find((g) => g.id === toGodownId);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <TransferPhaseSwitch
        phase={phase}
        onChange={setPhase}
        disabled={processing}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {isDispatch ? (
          <GodownSelector
            godowns={godowns}
            selectedId={fromGodownId}
            onChange={setFromGodownId}
            disabled={processing}
          />
        ) : null}
        <Dropdown
          label={isDispatch ? "To warehouse" : "Receiving at"}
          options={godowns.map((g) => ({
            value: g.id,
            label: g.location_name,
          }))}
          value={toGodownId}
          onChange={setToGodownId}
          placeholder="Destination"
          disabled={processing}
          className={isDispatch ? undefined : "sm:col-span-2"}
        />
      </div>

      {isDispatch && fromGodownId && toGodownId && fromGodownId === toGodownId && (
        <AlertBanner
          alert={{
            type: "error",
            message: "Source and destination godowns must differ.",
          }}
        />
      )}

      {!ready && (!isDispatch || fromGodownId !== toGodownId) && (
        <AlertBanner
          alert={{
            type: "info",
            message: isDispatch
              ? "Pick source and destination warehouses."
              : "Pick destination warehouse.",
          }}
        />
      )}

      <div
        className={`rounded-2xl border p-4 text-sm ${
          isDispatch
            ? "border-danger/30 bg-danger/5 text-zinc-400"
            : "border-success/30 bg-success/5 text-zinc-400"
        }`}
      >
        {isDispatch ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-danger">
              Step 1 · Dispatch from {fromGodown?.location_name ?? "source"}
            </p>
            <p className="mt-1 text-zinc-300">
              Scan sealed full bales (1,000 bags) leaving{" "}
              <span className="font-medium text-zinc-100">
                {fromGodown?.location_name ?? "source"}
              </span>
              . They go in transit to{" "}
              <span className="font-medium text-zinc-100">
                {toGodown?.location_name ?? "destination"}
              </span>
              .
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-success">
              Step 2 · Receive at {toGodown?.location_name ?? "destination"}
            </p>
            <p className="mt-1 text-zinc-300">
              Scan the same bale again when it arrives at{" "}
              <span className="font-medium text-zinc-100">
                {toGodown?.location_name ?? "destination"}
              </span>
              . Only bales dispatched to this godown can be received.
            </p>
          </>
        )}
      </div>

      <ScannerWindow
        scannerElementId={scannerElementId}
        isScanning={isScanning}
        cameraError={cameraError}
        onStart={startScanning}
        onStop={stopScanning}
        disabled={!ready || processing}
        contextLabel={
          isDispatch
            ? `Dispatch from ${fromGodown?.location_name ?? "source"}`
            : `Receive at ${toGodown?.location_name ?? "destination"}`
        }
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
        mode={isDispatch ? "STOCK_OUT" : "STOCK_IN"}
        onDismissAlert={dismissAlert}
      />

      <ScanTallyPanel
        tally={tally}
        mode={isDispatch ? "STOCK_OUT" : "STOCK_IN"}
        onReset={resetTally}
      />
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
  const [scanHint, setScanHint] = useState<string | null>(null);

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
      if (!godownId) {
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
            message: "Pick a warehouse for returned stock.",
          }}
        />
      )}

      {scanHint && (
        <AlertBanner
          alert={{ type: "error", message: scanHint }}
          onDismiss={() => setScanHint(null)}
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
