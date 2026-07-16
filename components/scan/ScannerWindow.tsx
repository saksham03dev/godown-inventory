"use client";

import { useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  RefreshCw,
  ScanBarcode,
  XCircle,
} from "lucide-react";
import type { AlertState, ScanTransactionResult, TransactionType } from "@/lib/types/database";

interface ScannerWindowProps {
  scannerElementId: string;
  isScanning: boolean;
  cameraError: string | null;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  contextLabel?: string;
  /** Hardware / keyboard-wedge 2D scanner is listening */
  hardwareListening?: boolean;
  /** Optional typed/pasted barcode submit (mobile + laptop fallback) */
  onManualSubmit?: (barcode: string) => void;
  /** Non-layout-shifting status shown over the camera feed */
  overlay?: {
    processing?: boolean;
    flash?: "success" | "error" | null;
    message?: string | null;
    detail?: string | null;
  };
}

export function ScannerWindow({
  scannerElementId,
  isScanning,
  cameraError,
  onStart,
  onStop,
  disabled,
  contextLabel,
  hardwareListening = false,
  onManualSubmit,
  overlay,
}: ScannerWindowProps) {
  const showFlash = overlay?.flash === "success" || overlay?.flash === "error";
  const [manualCode, setManualCode] = useState("");

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || disabled || !onManualSubmit) return;
    onManualSubmit(code);
    setManualCode("");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised [overflow-anchor:none]">
      <div className="border-b border-surface-border px-4 py-3">
        <p className="text-sm font-medium text-zinc-200">Barcode Scanner</p>
        <p className="text-xs text-zinc-500">
          Use phone/laptop camera or a USB / Bluetooth 2D scanner
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${
              isScanning
                ? "bg-accent/15 text-accent"
                : "bg-white/5 text-zinc-500"
            }`}
          >
            <Camera className="h-3 w-3" />
            {isScanning ? "Camera on" : "Camera off"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${
              hardwareListening && !disabled
                ? "bg-success/15 text-success"
                : "bg-white/5 text-zinc-500"
            }`}
          >
            <ScanBarcode className="h-3 w-3" />
            {hardwareListening && !disabled
              ? "2D scanner ready"
              : "2D scanner idle"}
          </span>
        </div>
      </div>

      {/* Fixed aspect box — never remount the scanner element */}
      <div className="relative aspect-[4/3] bg-black sm:aspect-video contain-layout contain-size">
        <div
          id={scannerElementId}
          className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
        />

        {!isScanning && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/80">
            <Camera className="h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-400">Camera is off</p>
            <p className="max-w-xs px-4 text-center text-xs text-zinc-600">
              Start the camera on mobile, or scan with a plugged-in 2D scanner
              anytime below.
            </p>
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
            <p className="max-w-xs text-xs text-zinc-500">
              Camera needs HTTPS or localhost. You can still use a 2D scanner or
              type the barcode below.
            </p>
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
            <p className="text-center text-xs text-zinc-300">
              {overlay?.processing
                ? "Processing…"
                : "Scanning… align barcode within the frame"}
            </p>
          </div>
        )}

        {overlay?.processing && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-accent/90 px-3 py-2 text-center text-xs font-medium text-white">
            Processing scan…
          </div>
        )}

        {showFlash && (
          <div
            className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-[2px] transition-opacity ${
              overlay?.flash === "success" ? "bg-success/85" : "bg-danger/85"
            }`}
          >
            {overlay?.flash === "success" ? (
              <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
            ) : (
              <XCircle className="h-12 w-12 text-white" strokeWidth={2.5} />
            )}
            <p className="text-base font-semibold text-white">
              {overlay?.flash === "success" ? "Approved" : "Rejected"}
            </p>
            {overlay?.message && (
              <p className="max-w-xs text-sm text-white/90">{overlay.message}</p>
            )}
            {overlay?.detail && (
              <p className="font-mono text-xs text-white/70">{overlay.detail}</p>
            )}
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

      {onManualSubmit && (
        <form
          onSubmit={submitManual}
          className="space-y-2 border-t border-surface-border p-3"
        >
          <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Or enter barcode
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-barcode-capture="manual"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              disabled={disabled}
              placeholder="Scan with 2D gun or paste code…"
              className="min-w-0 flex-1 rounded-xl border border-surface-border bg-surface-overlay px-3 py-2.5 font-mono text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={disabled || !manualCode.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
            >
              Go
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            2D scanners work without focusing this field. Click away from other
            inputs first, then scan.
          </p>
        </form>
      )}
    </div>
  );
}

/** Compact last-result strip with reserved height to avoid layout jump */
interface ScanResultStripProps {
  alert: AlertState | null;
  lastResult: ScanTransactionResult | null;
  mode: TransactionType;
  onDismissAlert: () => void;
}

export function ScanResultStrip({
  alert,
  lastResult,
  mode,
  onDismissAlert,
}: ScanResultStripProps) {
  const hasContent = Boolean(lastResult || alert);

  return (
    <div className="min-h-[4.5rem] [overflow-anchor:none]">
      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-surface-border px-4 py-3 text-center text-xs text-zinc-600">
          Scan results appear here — camera and 2D scanner both work
        </div>
      ) : lastResult?.success ? (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-success">
            Last {mode === "STOCK_IN" ? "Stock In" : "Wholesale Out"}
            {lastResult.isUnitScan ? " · Bale" : " · Product"}
          </p>
          <p className="mt-0.5 font-medium text-zinc-100">
            {lastResult.product?.name ?? "Success"}
          </p>
          <p className="text-xs text-zinc-500">
            {lastResult.stockUnit
              ? `Bale #${lastResult.stockUnit.unit_number} · ${lastResult.stockUnit.unit_barcode}`
              : lastResult.message}
            {lastResult.newGodownStock !== undefined
              ? ` · Godown: ${lastResult.newGodownStock.toLocaleString()} bags`
              : ""}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-danger">
                Scan rejected
              </p>
              <p className="mt-0.5 text-sm text-zinc-200">
                {alert?.message ?? lastResult?.message ?? "Scan failed"}
              </p>
            </div>
            {alert && (
              <button
                type="button"
                onClick={onDismissAlert}
                className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
