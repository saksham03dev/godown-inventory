"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseHardwareScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  /** Min barcode length to accept from a wedge scanner burst */
  minLength?: number;
  /** Flush incomplete burst after this idle gap (ms) */
  idleFlushMs?: number;
  /** Same-code debounce after a successful scan */
  debounceMs?: number;
}

interface UseHardwareScannerReturn {
  isListening: boolean;
  lastScanned: string | null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Dedicated manual barcode field handles Enter itself
  if (target.dataset.barcodeCapture === "manual") return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/**
 * Captures barcodes from USB/Bluetooth 2D scanners that act as keyboard wedges
 * (rapid keystrokes ending with Enter). Ignores typing in normal form fields.
 */
export function useHardwareScanner({
  onScan,
  enabled = true,
  minLength = 6,
  idleFlushMs = 80,
  debounceMs = 2200,
}: UseHardwareScannerOptions): UseHardwareScannerReturn {
  const onScanRef = useRef(onScan);
  const bufferRef = useRef("");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanRef = useRef({ code: "", at: 0 });
  const [isListening, setIsListening] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const emit = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (code.length < minLength) return;

      const now = Date.now();
      if (
        code === lastScanRef.current.code &&
        now - lastScanRef.current.at < debounceMs
      ) {
        return;
      }
      lastScanRef.current = { code, at: now };
      setLastScanned(code);
      onScanRef.current(code);
    },
    [minLength, debounceMs]
  );

  const clearBuffer = useCallback(() => {
    bufferRef.current = "";
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleFlush = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const buffered = bufferRef.current;
      bufferRef.current = "";
      idleTimerRef.current = null;
      if (buffered.length >= minLength) {
        emit(buffered);
      }
    }, idleFlushMs);
  }, [emit, idleFlushMs, minLength]);

  useEffect(() => {
    if (!enabled) {
      setIsListening(false);
      clearBuffer();
      return;
    }

    setIsListening(true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === "Enter") {
        const buffered = bufferRef.current;
        clearBuffer();
        if (buffered.length >= minLength) {
          event.preventDefault();
          emit(buffered);
        }
        return;
      }

      // Printable single character (wedge scanners send these rapidly)
      if (event.key.length === 1) {
        bufferRef.current += event.key;
        scheduleIdleFlush();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      setIsListening(false);
      clearBuffer();
    };
  }, [enabled, clearBuffer, emit, minLength, scheduleIdleFlush]);

  return { isListening, lastScanned };
}
