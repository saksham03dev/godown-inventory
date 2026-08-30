"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isScanSoundEnabled,
  setScanSoundEnabled,
} from "@/lib/utils/scanFeedbackAudio";

export function ScanSoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isScanSoundEnabled());
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Scan sound"
      onClick={() => {
        const next = !enabled;
        setScanSoundEnabled(next);
        setEnabled(next);
      }}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 text-left transition hover:border-zinc-600"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {enabled ? (
          <Volume2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
        ) : (
          <VolumeX className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-200">
            Scan sound
          </span>
          <span className="block text-xs text-zinc-500">
            {enabled ? "Says Okay on accept, beep on reject" : "Visual tick only"}
          </span>
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled ? "bg-success/80" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            enabled ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
