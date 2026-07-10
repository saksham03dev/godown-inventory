"use client";

import { Camera, CameraOff, RefreshCw } from "lucide-react";

interface ScannerWindowProps {
  scannerElementId: string;
  isScanning: boolean;
  cameraError: string | null;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  contextLabel?: string;
}

export function ScannerWindow({
  scannerElementId,
  isScanning,
  cameraError,
  onStart,
  onStop,
  disabled,
  contextLabel,
}: ScannerWindowProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised overflow-hidden">
      <div className="border-b border-surface-border px-4 py-3">
        <p className="text-sm font-medium text-zinc-200">Camera Scanner</p>
        <p className="text-xs text-zinc-500">
          Point at a barcode or QR code to scan
        </p>
      </div>

      <div className="relative aspect-[4/3] bg-black sm:aspect-video">
        <div id={scannerElementId} className="h-full w-full" />

        {!isScanning && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/80">
            <Camera className="h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-400">Camera is off</p>
            <button
              type="button"
              onClick={onStart}
              disabled={disabled}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Camera
            </button>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 p-4 text-center">
            <CameraOff className="h-10 w-10 text-danger" />
            <p className="text-sm text-danger">{cameraError}</p>
            <button
              type="button"
              onClick={onStart}
              disabled={disabled}
              className="flex items-center gap-2 rounded-xl border border-surface-border px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {isScanning && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
            {contextLabel && (
              <p className="mb-1 text-center text-xs font-medium text-accent">
                {contextLabel}
              </p>
            )}
            <p className="text-center text-xs text-zinc-300 animate-pulse-soft">
              Scanning… align barcode within the frame
            </p>
          </div>
        )}
      </div>

      {isScanning && (
        <div className="border-t border-surface-border p-3">
          <button
            type="button"
            onClick={onStop}
            className="w-full rounded-xl border border-surface-border py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            Stop Camera
          </button>
        </div>
      )}
    </div>
  );
}
