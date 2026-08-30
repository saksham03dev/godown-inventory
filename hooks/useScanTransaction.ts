"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { processScanTransaction } from "@/lib/services/unitScanService";
import { playScanOkay, playScanReject } from "@/lib/utils/scanFeedbackAudio";
import { friendlyScanMessage } from "@/lib/utils/scanErrors";
import type {
  AlertState,
  ScanTransactionResult,
  TransactionType,
} from "@/lib/types/database";

interface UseScanTransactionOptions {
  onSuccess?: (result: ScanTransactionResult) => void;
  /** How long the on-camera success/error flash stays visible */
  flashMs?: number;
}

interface UseScanTransactionReturn {
  processing: boolean;
  alert: AlertState | null;
  lastResult: ScanTransactionResult | null;
  approveFlash: boolean;
  errorFlash: boolean;
  handleScan: (
    barcodeId: string,
    godownId: string,
    transactionType: TransactionType,
    bagsQty?: number | null
  ) => Promise<ScanTransactionResult>;
  runAction: (
    action: () => Promise<ScanTransactionResult>
  ) => Promise<ScanTransactionResult>;
  dismissAlert: () => void;
  clearApproveFlash: () => void;
}

export function useScanTransaction(
  options: UseScanTransactionOptions = {}
): UseScanTransactionReturn {
  const { flashMs = 1000 } = options;
  const onSuccessRef = useRef(options.onSuccess);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [lastResult, setLastResult] = useState<ScanTransactionResult | null>(
    null
  );
  const [approveFlash, setApproveFlash] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);

  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  }, [options.onSuccess]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);

  const clearApproveFlash = useCallback(() => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    setApproveFlash(false);
    setErrorFlash(false);
  }, []);

  const scheduleFlashClear = useCallback(() => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setApproveFlash(false);
      setErrorFlash(false);
      flashTimerRef.current = null;
    }, flashMs);
  }, [flashMs]);

  const handleScan = useCallback(
    async (
      barcodeId: string,
      godownId: string,
      transactionType: TransactionType,
      bagsQty?: number | null
    ): Promise<ScanTransactionResult> => {
      if (transactionType === "STOCK_IN" && !godownId) {
        const result: ScanTransactionResult = {
          success: false,
          message: "Please select a godown before scanning.",
        };
        setAlert({ type: "error", message: friendlyScanMessage(result.message) });
        setLastResult(result);
        setApproveFlash(false);
        setErrorFlash(true);
        playScanReject();
        scheduleFlashClear();
        return result;
      }

      setProcessing(true);
      setApproveFlash(false);
      setErrorFlash(false);

      try {
        const result = await processScanTransaction({
          barcodeId,
          godownId,
          transactionType,
          bagsQty: bagsQty ?? null,
        });

        setLastResult(result);

        if (result.success) {
          setApproveFlash(true);
          setErrorFlash(false);
          setAlert({ type: "success", message: result.message });
          playScanOkay();
          onSuccessRef.current?.(result);
        } else {
          setApproveFlash(false);
          setErrorFlash(true);
          setAlert({ type: "error", message: friendlyScanMessage(result.message) });
          playScanReject();
        }

        scheduleFlashClear();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Scan transaction failed.";
        const result: ScanTransactionResult = { success: false, message };
        setAlert({ type: "error", message });
        setLastResult(result);
        setApproveFlash(false);
        setErrorFlash(true);
        playScanReject();
        scheduleFlashClear();
        return result;
      } finally {
        setProcessing(false);
      }
    },
    [scheduleFlashClear]
  );

  const runAction = useCallback(
    async (
      action: () => Promise<ScanTransactionResult>
    ): Promise<ScanTransactionResult> => {
      setProcessing(true);
      setApproveFlash(false);
      setErrorFlash(false);

      try {
        const result = await action();
        setLastResult(result);

        if (result.success) {
          setApproveFlash(true);
          setErrorFlash(false);
          setAlert({ type: "success", message: result.message });
          playScanOkay();
          onSuccessRef.current?.(result);
        } else {
          setApproveFlash(false);
          setErrorFlash(true);
          setAlert({ type: "error", message: friendlyScanMessage(result.message) });
          playScanReject();
        }

        scheduleFlashClear();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Operation failed.";
        const result: ScanTransactionResult = { success: false, message };
        setAlert({ type: "error", message });
        setLastResult(result);
        setApproveFlash(false);
        setErrorFlash(true);
        playScanReject();
        scheduleFlashClear();
        return result;
      } finally {
        setProcessing(false);
      }
    },
    [scheduleFlashClear]
  );

  return {
    processing,
    alert,
    lastResult,
    approveFlash,
    errorFlash,
    handleScan,
    runAction,
    dismissAlert,
    clearApproveFlash,
  };
}
