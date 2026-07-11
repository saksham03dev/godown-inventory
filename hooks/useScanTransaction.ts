"use client";

import { useCallback, useState } from "react";
import { processScanTransaction } from "@/lib/services/unitScanService";
import type {
  AlertState,
  ScanTransactionResult,
  TransactionType,
} from "@/lib/types/database";

interface UseScanTransactionOptions {
  onSuccess?: (result: ScanTransactionResult) => void;
}

interface UseScanTransactionReturn {
  processing: boolean;
  alert: AlertState | null;
  lastResult: ScanTransactionResult | null;
  approveFlash: boolean;
  handleScan: (
    barcodeId: string,
    godownId: string,
    transactionType: TransactionType
  ) => Promise<ScanTransactionResult>;
  dismissAlert: () => void;
  clearApproveFlash: () => void;
}

export function useScanTransaction(
  options: UseScanTransactionOptions = {}
): UseScanTransactionReturn {
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [lastResult, setLastResult] = useState<ScanTransactionResult | null>(
    null
  );
  const [approveFlash, setApproveFlash] = useState(false);

  const dismissAlert = useCallback(() => setAlert(null), []);
  const clearApproveFlash = useCallback(() => setApproveFlash(false), []);

  const handleScan = useCallback(
    async (
      barcodeId: string,
      godownId: string,
      transactionType: TransactionType
    ): Promise<ScanTransactionResult> => {
      if (!godownId) {
        const result: ScanTransactionResult = {
          success: false,
          message: "Please select a godown before scanning.",
        };
        setAlert({ type: "error", message: result.message });
        setLastResult(result);
        setApproveFlash(false);
        return result;
      }

      setProcessing(true);
      setAlert(null);
      setApproveFlash(false);

      try {
        const result = await processScanTransaction({
          barcodeId,
          godownId,
          transactionType,
          quantity: 1,
        });

        setLastResult(result);

        if (result.success) {
          setApproveFlash(true);
          setAlert({ type: "success", message: result.message });
          options.onSuccess?.(result);
        } else {
          setAlert({ type: "error", message: result.message });
        }

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Scan transaction failed.";
        const result: ScanTransactionResult = { success: false, message };
        setAlert({ type: "error", message });
        setLastResult(result);
        setApproveFlash(false);
        return result;
      } finally {
        setProcessing(false);
      }
    },
    [options]
  );

  return {
    processing,
    alert,
    lastResult,
    approveFlash,
    handleScan,
    dismissAlert,
    clearApproveFlash,
  };
}
