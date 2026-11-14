"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import {
  RetailCutDialog,
  RetailStockOutApproval,
} from "@/components/scan/RetailCutDialog";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { ScanTallyPanel } from "@/components/scan/ScanTallyPanel";
import { StockOutModeSwitch } from "@/components/scan/StockOutModeSwitch";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { OnScreenTextPad } from "@/components/scan/OnScreenTextPad";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { useBarcodeInput } from "@/hooks/useBarcodeInput";
import { useScanTally } from "@/hooks/useScanTally";
import {
  clubStockOutByCode,
  useStockOutQueue,
  type StockOutQueueItem,
  type StockOutSession,
} from "@/hooks/useStockOutQueue";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  STOCK_OUT_EMPTY_BILL_INACTIVITY_MS,
  STOCK_OUT_MODE_STORAGE_KEY,
  type StockOutSaleMode,
} from "@/lib/constants/stockOut";
import { refreshSessionCookies } from "@/lib/auth/ensureSession";
import { ACTIVITY_PING_INTERVAL_MS } from "@/lib/auth/idle-timeout";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import type { AlertState, StockUnit } from "@/lib/types/database";

function readStoredMode(): StockOutSaleMode {
  if (typeof window === "undefined") return "wholesale";
  const stored = localStorage.getItem(STOCK_OUT_MODE_STORAGE_KEY);
  return stored === "retail" ? "retail" : "wholesale";
}

function productFromUnit(unit: StockUnit) {
  const p = unit.products;
  if (p && typeof p === "object" && !Array.isArray(p) && "name" in p) {
    return {
      productId: unit.product_id,
      productName: String(p.name ?? "Product"),
      productCode:
        "product_code" in p ? String(p.product_code ?? "") : unit.unit_barcode,
      size: "size" in p && p.size ? String(p.size) : null,
    };
  }
  return {
    productId: unit.product_id,
    productName: "Product",
    productCode: unit.unit_barcode,
    size: null as string | null,
  };
}

function billDate(openedAt: string): string {
  const date = new Date(openedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StockOutScanPanel() {
  const queue = useStockOutQueue();
  const { tally, replaceTallyFromBags, resetTally } = useScanTally();
  const [saleMode, setSaleMode] = useState<StockOutSaleMode>("wholesale");
  const [notice, setNotice] = useState<AlertState | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [approveFlash, setApproveFlash] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [billerName, setBillerName] = useState("");
  const [billNo, setBillNo] = useState("");
  const [padTarget, setPadTarget] = useState<"biller" | "billNo">("billNo");
  const [billPromptOpen, setBillPromptOpen] = useState(true);
  const [billOpen, setBillOpen] = useState(false);
  const [finalBill, setFinalBill] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [retailUnit, setRetailUnit] = useState<StockUnit | null>(null);
  const [checkingLabel, setCheckingLabel] = useState(false);
  const [retailLoading, setRetailLoading] = useState(false);
  const [retailDialogError, setRetailDialogError] = useState<string | null>(null);
  const [retailApproval, setRetailApproval] = useState<{
    productCode: string | null;
    size: string | null;
    bagsRemaining: number;
    baleNumber?: number;
  } | null>(null);

  const processingRef = useRef(false);
  const saleModeRef = useRef(saleMode);
  const retailOpenRef = useRef(false);
  const billOpenRef = useRef(false);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const lastStockOutActivityRef = useRef(Date.now());
  const autoAbandonBusyRef = useRef(false);

  const session = queue.active;
  const ready = queue.ready;
  const items = queue.items;

  useEffect(() => {
    setSaleMode(readStoredMode());
  }, []);

  useEffect(() => {
    if (!session) return;
    setSaleMode(session.saleMode);
    if (!ready) {
      setBillerName(session.billerName);
      setBillNo(session.billNo);
    }
  }, [session, ready]);

  useEffect(() => {
    saleModeRef.current = saleMode;
    if (!session) localStorage.setItem(STOCK_OUT_MODE_STORAGE_KEY, saleMode);
  }, [saleMode, session]);

  useEffect(() => {
    retailOpenRef.current = Boolean(retailUnit);
  }, [retailUnit]);

  useEffect(() => {
    billOpenRef.current = billOpen;
  }, [billOpen]);

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!ready && queue.recovery.length === 0) return;
    void refreshSessionCookies();
    const timer = window.setInterval(() => {
      void refreshSessionCookies();
    }, ACTIVITY_PING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [ready, queue.recovery.length]);

  useEffect(() => {
    replaceTallyFromBags(
      items
        .filter((item) => item.status !== "failed")
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          size: item.size,
          bags: item.bagsQty,
        }))
    );
  }, [items, replaceTallyFromBags]);

  const focusScanner = useCallback(() => {
    setTimeout(() => manualInputRef.current?.focus(), 50);
  }, []);

  const flashSuccess = useCallback((message: string) => {
    setApproveFlash(true);
    setErrorFlash(false);
    setLastMessage(message);
    setNotice({ type: "success", message });
    playScanOkay();
    setTimeout(() => setApproveFlash(false), 900);
  }, []);

  const flashError = useCallback((message: string) => {
    setErrorFlash(true);
    setApproveFlash(false);
    setLastMessage(message);
    setNotice({ type: "error", message });
    playScanReject();
    setTimeout(() => setErrorFlash(false), 900);
  }, []);

  const acceptItem = useCallback(
    (unit: StockUnit, bagsQty: number) => {
      if (queueRef.current.containsBarcode(unit.unit_barcode)) {
        flashError("This bale is already in the list on this phone.");
        return false;
      }
      if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
        flashError("Bale is not available for stock out.");
        return false;
      }
      if (bagsQty < 1 || bagsQty > unit.remaining_bags) {
        flashError(`Cannot stage ${bagsQty} bags — only ${unit.remaining_bags} remaining.`);
        return false;
      }
      const added = queueRef.current.enqueue({
        barcode: unit.unit_barcode,
        bagsQty,
        ...productFromUnit(unit),
        unitNumber: unit.unit_number,
      });
      if (!added) {
        flashError("This bale is already in the list on this phone.");
        return false;
      }
      const left = unit.remaining_bags - bagsQty;
      if (saleModeRef.current === "retail" && left > 0) {
        const meta = productFromUnit(unit);
        setRetailApproval({
          productCode: meta.productCode,
          size: meta.size,
          bagsRemaining: left,
          baleNumber: unit.unit_number,
        });
      }
      flashSuccess(`Accepted on this phone · bale #${unit.unit_number}. Sending to the slip.`);
      return true;
    },
    [flashError, flashSuccess]
  );

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      if (
        processingRef.current ||
        retailOpenRef.current ||
        billOpenRef.current ||
        confirmLoading
      ) {
        return;
      }
      if (!queueRef.current.ready) {
        setBillPromptOpen(true);
        flashError("Enter the bill number before scanning.");
        return;
      }

      processingRef.current = true;
      setCheckingLabel(true);
      if (saleModeRef.current === "retail") setRetailLoading(true);
      try {
        const unit = await fetchStockUnitByBarcode(barcode);
        if (!unit) {
          flashError("Unknown barcode.");
          return;
        }
        if (queueRef.current.containsBarcode(unit.unit_barcode)) {
          flashError("This bale is already in the list on this phone.");
          return;
        }
        if (unit.status !== "STOCKED_IN" || unit.remaining_bags < 1) {
          flashError("Bale is not available for stock out.");
          return;
        }
        if (saleModeRef.current === "retail") {
          setRetailUnit(unit);
          setRetailDialogError(null);
          return;
        }
        const bags = unit.remaining_bags > 0 ? unit.remaining_bags : BAGS_PER_BALE;
        acceptItem(unit, bags);
      } catch (err) {
        flashError(err instanceof Error ? err.message : "Could not look up bale.");
      } finally {
        processingRef.current = false;
        setCheckingLabel(false);
        setRetailLoading(false);
        focusScanner();
      }
    },
    [acceptItem, confirmLoading, flashError, focusScanner]
  );

  const closeRetailDialog = useCallback(() => {
    if (retailLoading) return;
    setRetailUnit(null);
    setRetailDialogError(null);
    focusScanner();
  }, [retailLoading, focusScanner]);

  const confirmRetailCut = useCallback(
    (bagsQty: number) => {
      if (!retailUnit || retailLoading) return;
      if (bagsQty > retailUnit.remaining_bags) {
        setRetailDialogError(
          `Cannot stock out ${bagsQty.toLocaleString()} bags — only ${retailUnit.remaining_bags.toLocaleString()} remaining.`
        );
        return;
      }
      const ok = acceptItem(retailUnit, bagsQty);
      if (!ok) return;
      setRetailUnit(null);
      setRetailDialogError(null);
      focusScanner();
    },
    [retailUnit, retailLoading, acceptItem, focusScanner]
  );

  const bumpStockOutActivity = useCallback(() => {
    lastStockOutActivityRef.current = Date.now();
  }, []);

  const resetStockOutEntry = useCallback(() => {
    setSaleMode("wholesale");
    localStorage.setItem(STOCK_OUT_MODE_STORAGE_KEY, "wholesale");
    setBillerName("");
    setBillNo("");
    setBillPromptOpen(true);
    setBillOpen(false);
    setFinalBill(false);
    setRetailUnit(null);
    setRetailApproval(null);
    setLastMessage(null);
    resetTally();
  }, [resetTally]);

  const startBill = useCallback(() => {
    const ok = queue.startSession({ billerName, billNo, saleMode });
    if (!ok) {
      flashError("Bill number is required.");
      return;
    }
    bumpStockOutActivity();
    setBillPromptOpen(false);
    const biller = billerName.trim();
    setNotice({
      type: "info",
      message: biller
        ? `Bill ${billNo.trim()} · ${biller}. Scans upload while you continue.`
        : `Bill ${billNo.trim()}. Scans upload while you continue.`,
    });
    focusScanner();
  }, [queue, billerName, billNo, saleMode, flashError, focusScanner, bumpStockOutActivity]);

  const finishBill = useCallback(() => {
    queue.closeActive();
    setBillOpen(false);
    setFinalBill(false);
    setBillerName("");
    setBillNo("");
    setBillPromptOpen(true);
    setLastMessage(null);
    setNotice(null);
    setRetailApproval(null);
    resetTally();
  }, [queue, resetTally]);

  const confirmBill = useCallback(async () => {
    if (confirmLoading || !ready) return;
    setConfirmLoading(true);
    setNotice(null);
    try {
      const result = await queue.finalizeActiveBill();
      if (!result.success) {
        setBillOpen(false);
        setFinalBill(false);
        flashError(result.message);
        return;
      }
      setFinalBill(true);
      setBillOpen(true);
      setNotice({ type: "success", message: result.message });
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmLoading, ready, queue, flashError]);

  useEffect(() => {
    if (!billOpen || !finalBill) return;
    const timer = window.setTimeout(() => finishBill(), 3200);
    return () => window.clearTimeout(timer);
  }, [billOpen, finalBill, finishBill]);

  const runCancelBill = useCallback(async () => {
    if (cancelLoading) return;
    setCancelLoading(true);
    setNotice(null);
    try {
      const result = await queue.cancelActiveBill();
      if (!result.success) {
        flashError(result.message);
        return;
      }
      setNotice({ type: "info", message: result.message });
      resetStockOutEntry();
      setResetOpen(false);
    } finally {
      setCancelLoading(false);
    }
  }, [cancelLoading, queue, flashError, resetStockOutEntry]);

  const abandonIdleEmptyBill = useCallback(async () => {
    if (autoAbandonBusyRef.current) return;
    const live = queueRef.current;
    if (!live.ready || live.items.length > 0) return;
    autoAbandonBusyRef.current = true;
    try {
      if (live.active?.slipId) {
        await live.cancelActiveBill();
      } else {
        live.discardEmptyActive();
      }
      resetStockOutEntry();
      setNotice({
        type: "info",
        message: "Empty bill cleared after no scans. Enter bill number to start again.",
      });
    } finally {
      autoAbandonBusyRef.current = false;
    }
  }, [resetStockOutEntry]);

  useEffect(() => {
    if (!ready || items.length > 0 || !session?.openedAt) return;
    const openedAt = Date.parse(session.openedAt);
    if (!Number.isNaN(openedAt)) {
      lastStockOutActivityRef.current = Math.max(
        lastStockOutActivityRef.current,
        openedAt
      );
    }
  }, [ready, items.length, session?.id, session?.openedAt]);

  useEffect(() => {
    const markActive = () => {
      lastStockOutActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
    };
  }, []);

  useEffect(() => {
    const idleEmptyBill =
      queue.hydrated &&
      ready &&
      items.length === 0 &&
      !confirmLoading &&
      !cancelLoading &&
      !billOpen &&
      !retailUnit &&
      !resetOpen;

    if (!idleEmptyBill) return;

    const check = () => {
      const idleFor = Date.now() - lastStockOutActivityRef.current;
      if (idleFor >= STOCK_OUT_EMPTY_BILL_INACTIVITY_MS) {
        void abandonIdleEmptyBill();
      }
    };

    check();
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [
    queue.hydrated,
    ready,
    items.length,
    confirmLoading,
    cancelLoading,
    billOpen,
    retailUnit,
    resetOpen,
    abandonIdleEmptyBill,
  ]);

  const scannerEnabled =
    ready && !retailUnit && !retailLoading && !billOpen && !confirmLoading && !cancelLoading;
  const failed = items.filter((item) => item.status === "failed");
  const lines = clubStockOutByCode(items);
  const totalBags = lines.reduce((sum, line) => sum + line.bags, 0);
  const totalBales = lines.reduce((sum, line) => sum + line.bales, 0);
  const waitingForBill = Boolean(session && !ready && session.items.length > 0);

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

  return (
    <div className="space-y-4">
      {queue.hydrated && ready ? (
        <div className="rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Current bill</p>
          <p className="mt-1 font-medium text-zinc-100">
            {session?.billNo}
            {session?.billerName ? ` · ${session.billerName}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            One bill. Switch wholesale or retail while scanning; both stay on this bill.
          </p>
        </div>
      ) : queue.hydrated && !billPromptOpen ? (
        <button
          type="button"
          onClick={() => setBillPromptOpen(true)}
          className="w-full rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-left text-sm text-zinc-100"
        >
          Enter bill number to start scanning
        </button>
      ) : null}

      {ready && (
        <div className="hidden sm:block">
          <StockOutModeSwitch
            mode={saleMode}
            onChange={(mode) => {
              bumpStockOutActivity();
              setSaleMode(mode);
              queue.setScanMode(mode);
            }}
          />
        </div>
      )}

      {offline && (
        <AlertBanner
          alert={{
            type: "warning",
            message:
              "No network. Keep scanning — this bill stays on the phone and uploads when the page is open again.",
          }}
          onDismiss={() => setOffline(false)}
        />
      )}

      {notice && <AlertBanner alert={notice} onDismiss={() => setNotice(null)} />}

      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-2 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <ScannerWindow
          scannerElementId={scannerElementId}
          isScanning={isScanning}
          cameraError={cameraError}
          onStart={startScanning}
          onStop={stopScanning}
          disabled={!scannerEnabled || confirmLoading || cancelLoading}
          contextLabel={saleMode === "wholesale" ? "Wholesale stock out" : "Scan bale · retail"}
          hardwareListening={hardwareListening && scannerEnabled}
          onManualSubmit={onBarcodeDetected}
          manualInputRef={manualInputRef}
          manualInputMode="none"
          overlay={{
            processing: checkingLabel,
            flash: approveFlash ? "success" : errorFlash ? "error" : null,
            message: lastMessage,
            detail: null,
          }}
          saleMode={ready ? saleMode : undefined}
          onSaleModeChange={
            ready
              ? (mode) => {
                  bumpStockOutActivity();
                  setSaleMode(mode);
                  queue.setScanMode(mode);
                }
              : undefined
          }
        />
      </div>

      {retailApproval && (
        <RetailStockOutApproval
          productCode={retailApproval.productCode}
          size={retailApproval.size}
          bagsRemaining={retailApproval.bagsRemaining}
          baleNumber={retailApproval.baleNumber}
          onDismiss={() => setRetailApproval(null)}
        />
      )}

      <ScanTallyPanel
        tally={tally}
        mode="STOCK_OUT"
        stockOutSaleMode={saleMode}
        progressLabel={
          ready
            ? `${queue.counts.scanned} scanned · ${queue.counts.stockedOut} stocked out · ${queue.counts.sending} sending`
            : null
        }
      />

      {failed.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm">
          <p className="text-xs font-medium text-danger">
            This bill is still open. Fix these labels or remove them, then tap CONFIRM again.
          </p>
          <ul className="space-y-2">
            {failed.map((item) => (
              <li
                key={item.barcode}
                className="flex items-start justify-between gap-3 text-zinc-200"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs">{item.barcode}</span>
                  <span className="mt-0.5 block text-xs text-danger">
                    {item.error ?? "Could not stock out this label."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => queue.removeFailedItem(item.barcode)}
                  className="shrink-0 rounded-lg border border-surface-border px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {queue.recovery.length > 0 && (
        <RecoveryList sessions={queue.recovery} />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (items.length > 0) setResetOpen(true);
            else void runCancelBill();
          }}
          disabled={!ready || cancelLoading || confirmLoading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-border px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {cancelLoading ? "Cancelling…" : "Cancel bill"}
        </button>
        <button
          type="button"
          onClick={() => void confirmBill()}
          disabled={!ready || items.length === 0 || confirmLoading || cancelLoading}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl border-2 border-accent/80 bg-accent px-5 py-4 text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-accent/25 transition hover:bg-accent-muted disabled:border-surface-border disabled:bg-surface-overlay disabled:text-zinc-500 disabled:shadow-none"
        >
          {confirmLoading ? "Finishing…" : "CONFIRM"}
          {queue.counts.scanned > 0 && !confirmLoading ? (
            <span className="rounded-lg bg-white/20 px-2 py-0.5 text-sm tabular-nums">
              {queue.counts.scanned}
              {queue.counts.sending > 0 ? ` · ${queue.counts.sending} sending` : ""}
            </span>
          ) : null}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600">
        {ready
          ? "Scans upload in the background. CONFIRM waits for pending uploads, shows the summary, then starts the next bill."
          : "Enter the bill number first. Scanning stays off until this bill is open."}
      </p>

      <Modal
        open={queue.hydrated && !ready && billPromptOpen}
        onClose={() => setBillPromptOpen(false)}
        title="STOCKOUT"
        titleClassName="text-2xl font-bold uppercase tracking-wide text-zinc-100 sm:text-3xl"
        size="md"
        preserveNav
      >
        <BillStartForm
          billerName={billerName}
          billNo={billNo}
          padTarget={padTarget}
          waitingCount={waitingForBill ? session?.items.length ?? 0 : 0}
          onPadTarget={setPadTarget}
          onBiller={setBillerName}
          onBillNo={setBillNo}
          onStart={startBill}
        />
      </Modal>

      <RetailCutDialog
        open={Boolean(retailUnit)}
        unit={retailUnit}
        loading={retailLoading}
        onClose={closeRetailDialog}
        onConfirm={(qty) => confirmRetailCut(qty)}
        errorMessage={retailDialogError}
      />

      <Modal
        open={billOpen && Boolean(session)}
        onClose={() => {}}
        title="Bill confirmed"
        description="Final summary for this stock-out bill. Starting the next bill shortly."
        size="lg"
        preserveNav
        dismissible={false}
      >
        {session && (
          <BillPreview
            session={session}
            lines={lines}
            totalBags={totalBags}
            totalBales={totalBales}
            sending={0}
            failedCount={0}
            finalizing={finalBill}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void runCancelBill()}
        title="Cancel this bill?"
        message="This clears the bill on the phone. Any bales already stocked out on the slip are put back into warehouse stock."
        confirmLabel="Cancel bill"
        loading={cancelLoading}
        destructive
      />

      {session?.slipId && (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Slip updating.{" "}
          <Link href="/stock-out-slips" className="font-medium underline underline-offset-2">
            View stock-out slips
          </Link>
        </div>
      )}
    </div>
  );
}

function BillStartForm({
  billerName,
  billNo,
  padTarget,
  waitingCount,
  onPadTarget,
  onBiller,
  onBillNo,
  onStart,
}: {
  billerName: string;
  billNo: string;
  padTarget: "biller" | "billNo";
  waitingCount: number;
  onPadTarget: (target: "biller" | "billNo") => void;
  onBiller: (value: string) => void;
  onBillNo: (value: string) => void;
  onStart: () => void;
}) {
  const canStart = Boolean(billNo.trim());
  return (
    <div className="space-y-4">
      {waitingCount > 0 && (
        <p className="text-sm text-amber-300">
          {waitingCount} bale{waitingCount === 1 ? "" : "s"} stayed on this phone. Enter the bill number to send them.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPadTarget("biller")}
          className={`rounded-xl border px-3 py-2.5 text-left transition ${
            padTarget === "biller"
              ? "border-accent/50 bg-accent/10"
              : "border-surface-border bg-surface-overlay"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Name</p>
          <p className="mt-0.5 truncate text-sm text-zinc-100">
            {billerName || <span className="text-zinc-600">—</span>}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPadTarget("billNo")}
          className={`rounded-xl border border-l-[3px] border-l-accent px-3 py-2.5 text-left transition ${
            padTarget === "billNo"
              ? "border-accent/50 bg-accent/10"
              : "border-surface-border bg-surface-overlay"
          } ${!billNo.trim() ? "ring-1 ring-accent/25" : ""}`}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
            <FieldLabel required>Bill No</FieldLabel>
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-zinc-100">
            {billNo || <span className="font-normal text-zinc-600">—</span>}
          </p>
        </button>
      </div>
      <div
        className={
          padTarget === "billNo" && !billNo.trim()
            ? "rounded-2xl ring-1 ring-accent/30"
            : ""
        }
      >
        <OnScreenTextPad
          key={padTarget}
          label={padTarget === "biller" ? "Name" : "Bill No"}
          value={padTarget === "biller" ? billerName : billNo}
          onChange={padTarget === "biller" ? onBiller : onBillNo}
          placeholder={padTarget === "biller" ? "Customer or party" : "Bill / purchase no"}
          defaultMode={padTarget === "billNo" ? "digits" : "letters"}
          required={padTarget === "billNo"}
        />
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        Start scanning
      </button>
    </div>
  );
}

function BillPreview({
  session,
  lines,
  totalBags,
  totalBales,
  sending,
  failedCount,
  finalizing,
}: {
  session: StockOutSession;
  lines: ReturnType<typeof clubStockOutByCode>;
  totalBags: number;
  totalBales: number;
  sending: number;
  failedCount: number;
  finalizing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-border bg-white px-4 py-4 text-black">
        <p className="text-lg font-bold">STOCK OUT BILL</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Name</p>
            <p className="font-medium">{session.billerName.trim() || "—"}</p>
            <p className="mt-2 text-xs uppercase tracking-wider text-zinc-500">Bill No</p>
            <p className="font-medium">{session.billNo}</p>
          </div>
          <div className="text-right">
            <p>
              <span className="text-zinc-500">Channel: </span>
              {session.saleMode === "retail" ? "Retail" : "Wholesale"}
            </p>
            <p>
              <span className="text-zinc-500">Opened: </span>
              {billDate(session.openedAt)}
            </p>
          </div>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-2">Code</th>
              <th className="py-2">Product</th>
              <th className="py-2 text-right">Bales</th>
              <th className="py-2 text-right">Bags</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.productCode} className="border-b border-zinc-200">
                <td className="py-2 font-mono text-xs">{line.productCode}</td>
                <td className="py-2">
                  {line.productName}
                  {line.size ? <span className="block text-xs text-zinc-500">Size {line.size}</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{line.bales}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{Math.round(line.bags)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end gap-4 text-sm font-semibold">
          <span>Bales {totalBales}</span>
          <span>Bags {Math.round(totalBags)}</span>
        </div>
      </div>
      {sending > 0 && (
        <p className="text-sm text-amber-300">
          {sending} bale{sending === 1 ? "" : "s"} still sending. They stay on this phone until the slip has them.
        </p>
      )}
      {failedCount > 0 && (
        <p className="text-sm text-danger">
          {failedCount} label{failedCount === 1 ? "" : "s"} could not be added and are not on this bill.
        </p>
      )}
      {finalizing ? (
        <p className="text-center text-sm text-zinc-400">
          Bill saved on this phone. Next bill opens automatically…
        </p>
      ) : null}
    </div>
  );
}

function RecoveryList({ sessions }: { sessions: StockOutSession[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-amber-300">
          Recovery list
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          These bills stayed on the phone after a close, a power loss, or a failed send. They upload when this page is open.
        </p>
      </div>
      {sessions.map((session) => {
        const pending = session.items.filter((item) => item.status === "pending");
        const failed = session.items.filter((item) => item.status === "failed");
        return (
          <div key={session.id} className="rounded-xl border border-surface-border bg-surface-overlay/40 px-3 py-3 text-sm">
            <p className="font-medium text-zinc-100">
              {session.billNo || "No bill no"} · {session.billerName || "No name"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {pending.length} sending · {failed.length} not accepted
            </p>
            {failed.map((item: StockOutQueueItem) => (
              <p key={item.barcode} className="mt-1 text-xs text-danger">
                <span className="font-mono">{item.barcode}</span> {item.error ?? "Could not stock out this label."}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
