"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BillDetailsForm } from "@/components/billing/BillDetailsForm";
import { BillItemsTable } from "@/components/billing/BillItemsTable";
import { BillTotals } from "@/components/billing/BillTotals";
import { BillPrintView } from "@/components/billing/BillPrintView";
import { RetailBillingPanel } from "@/components/billing/RetailBillingPanel";
import { ScannerWindow } from "@/components/scan/ScannerWindow";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useSaleMode } from "@/contexts/SaleModeContext";
import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { useBilling } from "@/hooks/useBilling";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { BillInput } from "@/lib/types/database";

type ScanFlash = "success" | "error" | null;

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Billing" subtitle="Stock-out invoices">
          <LoadingSpinner label="Loading bills…" />
        </DashboardLayout>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const { can } = useAuth();
  const { mode: saleMode } = useSaleMode();
  const isRetail = saleMode === "retail";
  const canCreateBill = can("billing.create");
  const canEditPrice = can("billing.editPrice");
  const searchParams = useSearchParams();
  const billIdFromQuery = searchParams.get("billId");

  const {
    bills,
    activeBill,
    loading,
    mutating,
    error,
    alert,
    startNewBill,
    loadBill,
    saveBill,
    scanToBill,
    retailLineToBill,
    editItem,
    removeItem,
    finalize,
    removeBill,
    dismissAlert,
  } = useBilling();

  const [priceOverride, setPriceOverride] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [scanFlash, setScanFlash] = useState<ScanFlash>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const processingRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedQueryBillRef = useRef<string | null>(null);
  const activeBillIdRef = useRef<string | null>(null);
  const priceOverrideRef = useRef(priceOverride);

  activeBillIdRef.current = activeBill?.id ?? null;
  priceOverrideRef.current = priceOverride;

  useEffect(() => {
    if (!billIdFromQuery || loading) return;
    if (loadedQueryBillRef.current === billIdFromQuery) return;
    if (activeBill?.id === billIdFromQuery) {
      loadedQueryBillRef.current = billIdFromQuery;
      return;
    }
    loadedQueryBillRef.current = billIdFromQuery;
    loadBill(billIdFromQuery);
  }, [billIdFromQuery, loading, activeBill?.id, loadBill]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const isDraft = activeBill?.status === "DRAFT";
  const isReadonly = !canCreateBill || !isDraft;

  const showScanFlash = useCallback((flash: ScanFlash, message: string) => {
    setScanFlash(flash);
    setScanMessage(message);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setScanFlash(null);
      flashTimerRef.current = null;
    }, 1400);
  }, []);

  const onBarcodeDetected = useCallback(
    async (barcode: string) => {
      const billId = activeBillIdRef.current;
      if (!billId || !isDraft || !canCreateBill || processingRef.current) return;

      processingRef.current = true;
      setScanProcessing(true);
      setScanFlash(null);

      try {
        const raw = priceOverrideRef.current.trim();
        const parsed = Number(raw);
        const override =
          canEditPrice && raw !== "" && Number.isFinite(parsed) && parsed > 0
            ? parsed
            : 0;
        const result = await scanToBill(billId, barcode, override);
        showScanFlash(
          result.success ? "success" : "error",
          result.message
        );
      } finally {
        processingRef.current = false;
        setScanProcessing(false);
      }
    },
    [isDraft, canCreateBill, canEditPrice, scanToBill, showScanFlash]
  );

  const { isScanning, cameraError, startScanning, stopScanning, scannerElementId } =
    useBarcodeScan({
      onScan: onBarcodeDetected,
      enabled: Boolean(activeBill && isDraft && canCreateBill),
    });

  const handleDetailsChange = useCallback(
    (input: BillInput) => {
      if (!activeBill || isReadonly) return;
      void saveBill(activeBill.id, input, { silent: true });
    },
    [activeBill, isReadonly, saveBill]
  );

  const handleEditPrice = useCallback(
    (item: { id: string }, price: number) => {
      if (!canEditPrice) return;
      editItem(item.id, { unit_price: price });
    },
    [editItem, canEditPrice]
  );

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 300);
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Billing" subtitle="Stock-out invoices">
        <AlertBanner
          alert={{
            type: "info",
            message: "Configure Supabase in .env.local to use billing.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Billing"
      subtitle={
        canCreateBill
          ? isRetail
            ? "Retail billing — scan bale, enter bag qty"
            : "Wholesale billing — scan stocked-out bales (1,000 bags each)"
          : "View finalized wholesale bills"
      }
      actions={
        <div className="flex items-center gap-2">
          {activeBill && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          )}
          {canCreateBill && (
            <button
              onClick={() => startNewBill()}
              disabled={mutating}
              className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Bill</span>
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {/* Non-scan alerts only (finalize/delete/etc.) — scans use camera overlay */}
        {alert && !scanFlash && (
          <AlertBanner alert={alert} onDismiss={dismissAlert} />
        )}

        {loading ? (
          <LoadingSpinner label="Loading bills…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-4 lg:gap-6">
            {/* Recent bills — horizontal on mobile, sidebar on desktop */}
            <div className="space-y-2 lg:col-span-1">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Recent Bills
              </h3>
              {bills.length === 0 ? (
                <p className="text-sm text-zinc-500">No bills yet</p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
                  {bills.map((b) => (
                    <li key={b.id} className="flex shrink-0 gap-1 lg:shrink">
                      <button
                        onClick={() => loadBill(b.id)}
                        className={`min-w-[9.5rem] flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition lg:min-w-0 ${
                          activeBill?.id === b.id
                            ? "bg-accent/15 text-accent"
                            : "bg-surface-raised text-zinc-400 hover:bg-white/5 lg:bg-transparent"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{b.bill_number}</span>
                        </span>
                        <span className="text-xs text-zinc-600">
                          ₹{Number(b.total).toFixed(2)} · {b.status}
                        </span>
                      </button>
                      {canCreateBill && b.status === "DRAFT" && (
                        <button
                          onClick={() => setDeleteTarget(b.id)}
                          className="rounded-xl p-2 text-zinc-500 hover:bg-white/5 hover:text-danger"
                          aria-label="Delete bill"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0 space-y-4 lg:col-span-3">
              {!activeBill ? (
                <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-8 text-center sm:p-12">
                  <p className="text-sm text-zinc-400">
                    {canCreateBill
                      ? "Create a new bill or select one from the list"
                      : "Select a bill from the list to view details"}
                  </p>
                  {canCreateBill && (
                    <p className="mt-2 text-xs text-zinc-600">
                      {isRetail
                        ? "Scan a stocked-in bale, enter bags, and add lines to the bill"
                        : "Flow: Wholesale Out → Pending Sales (or scan bales here)"}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-zinc-100">
                        {activeBill.bill_number}
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Status: {activeBill.status}
                        {activeBill.bill_items.length > 0
                          ? ` · ${activeBill.bill_items.length} item(s)`
                          : ""}
                      </p>
                    </div>
                    {canCreateBill && isDraft && (
                      <button
                        onClick={() => finalize(activeBill.id)}
                        disabled={
                          mutating || activeBill.bill_items.length === 0
                        }
                        className="rounded-xl bg-success px-3 py-2 text-sm font-medium text-white hover:bg-success-muted disabled:opacity-50"
                      >
                        Finalize
                      </button>
                    )}
                  </div>

                  <BillDetailsForm
                    key={activeBill.id}
                    bill={activeBill}
                    onChange={handleDetailsChange}
                    readonly={isReadonly}
                  />

                  {canCreateBill && isDraft && !isRetail && (
                    <div className="space-y-3">
                      {canEditPrice && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Price Override (₹) — optional
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={priceOverride}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^\d*\.?\d*$/.test(v)) {
                                setPriceOverride(v);
                              }
                            }}
                            placeholder="Auto from product price"
                            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-base text-zinc-100 outline-none focus:border-accent sm:max-w-xs sm:text-sm"
                          />
                          <p className="mt-1 text-xs text-zinc-600">
                            Leave empty to use each product&apos;s retail price.
                          </p>
                        </div>
                      )}

                      <div className="sticky top-0 z-10 -mx-1 bg-surface px-1 pb-1 pt-1 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
                        <ScannerWindow
                          scannerElementId={scannerElementId}
                          isScanning={isScanning}
                          cameraError={cameraError}
                          onStart={startScanning}
                          onStop={stopScanning}
                          disabled={scanProcessing}
                          contextLabel={`Billing · ${activeBill.bill_number}`}
                          overlay={{
                            processing: scanProcessing,
                            flash: scanFlash,
                            message: scanMessage,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {canCreateBill && isDraft && isRetail && activeBill && (
                    <RetailBillingPanel
                      billId={activeBill.id}
                      billNumber={activeBill.bill_number}
                      disabled={mutating || scanProcessing}
                      canEditPrice={canEditPrice}
                      onAddLine={retailLineToBill}
                    />
                  )}

                  <BillItemsTable
                    bill={activeBill}
                    onEditPrice={handleEditPrice}
                    onRemove={removeItem}
                    readonly={isReadonly}
                    canEditPrice={canEditPrice}
                    isRetail={isRetail}
                  />

                  <BillTotals bill={activeBill} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showPrint && activeBill && (
        <div className="fixed inset-0 z-50 overflow-auto bg-white">
          <BillPrintView bill={activeBill} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await removeBill(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Delete Bill"
        message="Delete this draft bill? Wholesale bales will be unlinked and retail bag deductions restored."
        loading={mutating}
      />
    </DashboardLayout>
  );
}
