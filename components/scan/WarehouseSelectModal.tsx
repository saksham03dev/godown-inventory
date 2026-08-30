"use client";

import { useEffect } from "react";
import { Check, MapPin } from "lucide-react";
import type { Godown } from "@/lib/types/database";
import { unlockScanFeedback } from "@/lib/utils/scanFeedbackAudio";

interface WarehouseSelectModalProps {
  open: boolean;
  godowns: Godown[];
  selectedId: string;
  onChange: (godownId: string) => void;
  disabled?: boolean;
}

/** Centered mobile dialog — warehouse must be chosen before stock-in scanning. */
export function WarehouseSelectModal({
  open,
  godowns,
  selectedId,
  onChange,
  disabled,
}: WarehouseSelectModalProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:hidden">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-select-title"
        className="relative flex w-full max-w-md max-h-[min(90dvh,36rem)] flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl animate-slide-up"
      >
        <div className="shrink-0 border-b border-surface-border px-5 pb-4 pt-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/20">
              <MapPin className="h-6 w-6 text-accent" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2
                id="warehouse-select-title"
                className="text-lg font-semibold text-zinc-100"
              >
                Pick warehouse first
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Choose where you are receiving stock, then scan labels.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {godowns.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500">
              No warehouses available.
            </p>
          ) : (
            <ul className="space-y-2">
              {godowns.map((godown) => {
                const active = godown.id === selectedId;
                return (
                  <li key={godown.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        unlockScanFeedback();
                        onChange(godown.id);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition disabled:opacity-50 ${
                        active
                          ? "border-accent/50 bg-accent/15 text-zinc-100"
                          : "border-surface-border bg-surface-overlay text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      <span className="min-w-0 font-medium">
                        {godown.location_name}
                      </span>
                      {active ? (
                        <Check className="h-4 w-4 shrink-0 text-accent" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
