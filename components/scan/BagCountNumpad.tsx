"use client";

import { Delete } from "lucide-react";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";

export type BagCountNumpadAccent = "default" | "retail";

interface BagCountNumpadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  max?: number;
  disabled?: boolean;
  accent?: BagCountNumpadAccent;
  placeholder?: string;
  id?: string;
}

function appendDigit(current: string, digit: string, max: number): string {
  if (digit === "0" && current === "") return current;
  const next = `${current}${digit}`;
  const n = Number(next);
  if (!Number.isFinite(n) || n > max) return current;
  return next;
}

const ACCENT = {
  default: {
    display: "border-surface-border focus-within:border-accent",
    key: "border-surface-border bg-surface-overlay hover:bg-white/5 active:bg-white/10",
    keyMuted: "border-surface-border bg-surface-raised hover:bg-white/5 text-zinc-400",
  },
  retail: {
    display: "border-retail/30 focus-within:border-retail",
    key: "border-surface-border bg-surface-overlay hover:bg-white/5 active:bg-white/10",
    keyMuted: "border-surface-border bg-surface-raised hover:bg-white/5 text-zinc-400",
  },
} as const;

export function BagCountNumpad({
  value,
  onChange,
  label,
  hint,
  max = BAGS_PER_BALE,
  disabled = false,
  accent = "default",
  placeholder = "0",
  id,
}: BagCountNumpadProps) {
  const styles = ACCENT[accent];

  const pressDigit = (digit: string) => {
    if (disabled) return;
    onChange(appendDigit(value, digit, max));
  };

  const pressBackspace = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };

  const pressClear = () => {
    if (disabled || !value) return;
    onChange("");
  };

  const keys: { label: string; action: () => void; muted?: boolean; wide?: boolean }[] = [
    { label: "1", action: () => pressDigit("1") },
    { label: "2", action: () => pressDigit("2") },
    { label: "3", action: () => pressDigit("3") },
    { label: "4", action: () => pressDigit("4") },
    { label: "5", action: () => pressDigit("5") },
    { label: "6", action: () => pressDigit("6") },
    { label: "7", action: () => pressDigit("7") },
    { label: "8", action: () => pressDigit("8") },
    { label: "9", action: () => pressDigit("9") },
    { label: "C", action: pressClear, muted: true },
    { label: "0", action: () => pressDigit("0") },
    { label: "⌫", action: pressBackspace, muted: true },
  ];

  return (
    <div className="space-y-3">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-medium uppercase tracking-wider text-zinc-500"
        >
          {label}
        </label>
      ) : null}

      <div
        id={id}
        aria-live="polite"
        className={`rounded-xl border bg-surface-overlay px-4 py-3 text-center text-2xl font-semibold tabular-nums text-zinc-100 ${styles.display} ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {value || (
          <span className="text-zinc-600">{placeholder}</span>
        )}
      </div>

      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}

      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <button
            key={key.label}
            type="button"
            disabled={disabled}
            onClick={key.action}
            aria-label={
              key.label === "⌫"
                ? "Backspace"
                : key.label === "C"
                  ? "Clear"
                  : key.label
            }
            className={`flex h-12 items-center justify-center rounded-xl border text-lg font-semibold transition disabled:opacity-40 ${
              key.muted ? styles.keyMuted : styles.key
            } ${key.label === "⌫" ? "text-base" : ""}`}
          >
            {key.label === "⌫" ? <Delete className="h-5 w-5" /> : key.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function parseBagCountValue(
  value: string,
  max: number = BAGS_PER_BALE
): number | null {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n;
}
