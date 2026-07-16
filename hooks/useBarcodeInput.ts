"use client";

import { useBarcodeScan } from "@/hooks/useBarcodeScan";
import { useHardwareScanner } from "@/hooks/useHardwareScanner";

interface UseBarcodeInputOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  /** Optional stable DOM id for the camera region */
  scannerElementId?: string;
}

/**
 * Unified barcode capture: phone/laptop camera + USB/Bluetooth 2D scanner (keyboard wedge).
 * Feeds the same onScan callback used by stock and billing flows.
 */
export function useBarcodeInput({
  onScan,
  enabled = true,
  scannerElementId,
}: UseBarcodeInputOptions) {
  const camera = useBarcodeScan({
    onScan,
    enabled,
    scannerElementId,
  });

  const hardware = useHardwareScanner({
    onScan,
    enabled,
  });

  return {
    ...camera,
    hardwareListening: hardware.isListening,
    lastHardwareScan: hardware.lastScanned,
  };
}
