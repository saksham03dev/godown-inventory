"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  quantity: number;
  setQuantity: (qty: number) => void;
  handleScan: (
    barcodeId: string,
    godownId: string,
    transactionType: TransactionType
  ) => Promise<ScanTransactionResult>;
  dismissAlert: () => void;
}

export function useScanTransaction(
  options: UseScanTransactionOptions = {}
): UseScanTransactionReturn {
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [lastResult, setLastResult] = useState<ScanTransactionResult | null>(
    null
  );
  const [quantity, setQuantity] = useState(1);
  const quantityRef = useRef(quantity);

  useEffect(() => {
    quantityRef.current = quantity;
  }, [quantity]);

  const dismissAlert = useCallback(() => setAlert(null), []);

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
        return result;
      }

      setProcessing(true);
      setAlert(null);

      try {
        const result = await processScanTransaction({
          barcodeId,
          godownId,
          transactionType,
          quantity: quantityRef.current,
        });

        setLastResult(result);

        if (result.success) {
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
    quantity,
    setQuantity,
    handleScan,
    dismissAlert,
  };
}
