"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface UseBarcodeScanOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  fps?: number;
  qrboxSize?: number;
}

interface UseBarcodeScanReturn {
  isScanning: boolean;
  cameraError: string | null;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  resetDebounce: () => void;
  scannerElementId: string;
}

const SCANNER_ELEMENT_ID = "barcode-scanner-region";

export function useBarcodeScan({
  onScan,
  enabled = true,
  fps = 10,
  qrboxSize = 250,
}: UseBarcodeScanOptions): UseBarcodeScanReturn {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const resetDebounce = useCallback(() => {
    lastScanRef.current = "";
    lastScanTimeRef.current = 0;
  }, []);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Scanner may already be stopped
      }
    }
    scannerRef.current?.clear();
    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (!enabled) return;

    setCameraError(null);

    try {
      await stopScanning();

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps, qrbox: { width: qrboxSize, height: qrboxSize } },
        (decodedText) => {
          const now = Date.now();
          // Debounce duplicate scans within 2 seconds
          if (
            decodedText === lastScanRef.current &&
            now - lastScanTimeRef.current < 2000
          ) {
            return;
          }
          lastScanRef.current = decodedText;
          lastScanTimeRef.current = now;
          onScanRef.current(decodedText);
        },
        () => {
          // Frame-level decode failures are expected; ignore silently
        }
      );

      setIsScanning(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to access camera. Check permissions.";
      setCameraError(message);
      setIsScanning(false);
    }
  }, [enabled, fps, qrboxSize, stopScanning]);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    isScanning,
    cameraError,
    startScanning,
    stopScanning,
    resetDebounce,
    scannerElementId: SCANNER_ELEMENT_ID,
  };
}
