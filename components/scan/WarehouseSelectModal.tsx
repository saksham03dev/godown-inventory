"use client";

import { useEffect } from "react";
import { MapPin } from "lucide-react";
import { GodownSelector } from "@/components/scan/GodownSelector";
import type { Godown } from "@/lib/types/database";

interface WarehouseSelectModalProps {
  open: boolean;
  godowns: Godown[];
  selectedId: string;
  onChange: (godownId: string) => void;
  disabled?: boolean;
}

/** Blocking mobile sheet — warehouse must be chosen before stock-in scanning. */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:hidden">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-select-title"
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border border-surface-border bg-surface-raised px-5 pb-8 pt-6 shadow-2xl animate-slide-up"
      >
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20">
            <MapPin className="h-8 w-8 text-accent" aria-hidden />
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
        <GodownSelector
          godowns={godowns}
          selectedId={selectedId}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
