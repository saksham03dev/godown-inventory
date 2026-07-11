"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { AlertBanner } from "@/components/ui/AlertBanner";
import type { AlertState, ScanTransactionResult, TransactionType } from "@/lib/types/database";

interface ScanFeedbackProps {
  alert: AlertState | null;
  lastResult: ScanTransactionResult | null;
  processing: boolean;
  mode: TransactionType;
  onDismissAlert: () => void;
  showApproveFlash?: boolean;
}

export function ScanFeedback({
  alert,
  lastResult,
  processing,
  mode,
  onDismissAlert,
  showApproveFlash = false,
}: ScanFeedbackProps) {
  const isSuccess = lastResult?.success && showApproveFlash;

  return (
    <div className="space-y-4">
      {processing && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-center text-sm text-accent animate-pulse-soft">
          Processing scan…
        </div>
      )}

      {isSuccess && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-success bg-success/10 px-6 py-8 animate-slide-up">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
            <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={2.5} />
          </div>
          <p className="text-lg font-semibold text-success">Approved</p>
          <p className="text-center text-sm text-zinc-300">
            {mode === "STOCK_IN" ? "Stock In" : "Stock Out"} successful
          </p>
          {lastResult?.product && (
            <p className="text-center font-medium text-zinc-100">
              {lastResult.product.name}
            </p>
          )}
          {lastResult?.stockUnit && (
            <p className="font-mono text-xs text-zinc-500">
              Unit #{lastResult.stockUnit.unit_number} ·{" "}
              {lastResult.stockUnit.unit_barcode}
            </p>
          )}
        </div>
      )}

      {lastResult && !lastResult.success && !processing && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-6">
          <XCircle className="h-10 w-10 text-danger" />
          <p className="text-sm font-medium text-danger">Scan rejected</p>
        </div>
      )}

      {alert && !isSuccess && (
        <AlertBanner alert={alert} onDismiss={onDismissAlert} />
      )}

      {lastResult?.success && lastResult.product && !showApproveFlash && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-success">
            Last Scan {lastResult.isUnitScan ? "(Unit)" : "(Product)"}
          </p>
          <p className="mt-1 font-medium text-zinc-100">
            {lastResult.product.name}
          </p>
          {lastResult.stockUnit && (
            <p className="text-xs text-zinc-500">
              Unit #{lastResult.stockUnit.unit_number} ·{" "}
              {lastResult.stockUnit.unit_barcode}
            </p>
          )}
          {lastResult.newGodownStock !== undefined && (
            <p className="text-xs text-zinc-500">
              Godown stock: {lastResult.newGodownStock} units
            </p>
          )}
        </div>
      )}
    </div>
  );
}
