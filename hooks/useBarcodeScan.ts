"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface UseBarcodeScanOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  fps?: number;
  qrboxSize?: number;
  /** Ignore the same barcode for this many ms after a successful detect */
  debounceMs?: number;
  /** Unique DOM id when multiple scanner regions may exist */
  scannerElementId?: string;
}

interface UseBarcodeScanReturn {
  isScanning: boolean;
  cameraError: string | null;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  resetDebounce: () => void;
  scannerElementId: string;
}

export function useBarcodeScan({
  onScan,
  enabled = true,
  fps = 10,
  qrboxSize = 250,
  debounceMs = 2200,
  scannerElementId: scannerElementIdProp,
}: UseBarcodeScanOptions): UseBarcodeScanReturn {
  const reactId = useId().replace(/:/g, "");
  const scannerElementId =
    scannerElementIdProp ?? `barcode-scanner-${reactId}`;
  const scannerElementIdRef = useRef(scannerElementId);
  scannerElementIdRef.current = scannerElementId;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  const startingRef = useRef(false);
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
    startingRef.current = false;
    const scanner = scannerRef.current;
    if (!scanner) {
      setIsScanning(false);
      return;
    }

    scannerRef.current = null;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // Scanner may already be stopped
    }
    try {
      scanner.clear();
    } catch {
      // Element may already be cleared
    }
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    if (!enabled || startingRef.current) return;

    startingRef.current = true;
    setCameraError(null);

    try {
      await stopScanning();
      startingRef.current = true;

      // Wait a frame so the scanner DOM node is stable after layout
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );

      const elementId = scannerElementIdRef.current;
      const el = document.getElementById(elementId);
      if (!el) {
        throw new Error("Scanner view is not ready. Try again.");
      }

      const scanner = new Html5Qrcode(elementId, {
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
        {
          fps,
          qrbox: { width: qrboxSize, height: qrboxSize },
          // Avoid continuous DOM/CSS thrashing from aspect ratio recalcs
          aspectRatio: 4 / 3,
          disableFlip: false,
        },
        (decodedText) => {
          const now = Date.now();
          if (
            decodedText === lastScanRef.current &&
            now - lastScanTimeRef.current < debounceMs
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
      scannerRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [enabled, fps, qrboxSize, debounceMs, stopScanning]);

  useEffect(() => {
    return () => {
      void stopScanning();
    };
  }, [stopScanning]);

  return {
    isScanning,
    cameraError,
    startScanning,
    stopScanning,
    resetDebounce,
    scannerElementId,
  };
}
