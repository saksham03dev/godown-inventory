"use client";

import type { TransferPhase } from "@/lib/constants/transfer";

interface TransferPhaseSwitchProps {
  phase: TransferPhase;
  onChange: (phase: TransferPhase) => void;
  disabled?: boolean;
}

const PHASE_STYLES = {
  dispatch: {
    active: "bg-danger/15 ring-1 ring-danger/40",
    title: "text-danger",
  },
  receive: {
    active: "bg-success/15 ring-1 ring-success/40",
    title: "text-success",
  },
} as const;

export function TransferPhaseSwitch({
  phase,
  onChange,
  disabled,
}: TransferPhaseSwitchProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Transfer step
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["dispatch", "receive"] as const).map((option) => {
          const styles = PHASE_STYLES[option];
          const active = phase === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`rounded-xl px-3 py-3 text-left transition disabled:opacity-50 ${
                active
                  ? styles.active
                  : "border border-surface-border hover:bg-white/5"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  active ? styles.title : "text-zinc-300"
                }`}
              >
                {option === "dispatch" ? "1. Dispatch" : "2. Receive"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {option === "dispatch"
                  ? "Scan at source godown"
                  : "Scan at destination godown"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
