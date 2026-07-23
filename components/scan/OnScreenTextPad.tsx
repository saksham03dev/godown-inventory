"use client";

import { Delete } from "lucide-react";
import { useState } from "react";

type PadMode = "letters" | "digits";

interface OnScreenTextPadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Max characters (default 64). */
  maxLength?: number;
  /** Start on digit pad (useful for bill numbers). */
  defaultMode?: PadMode;
}

const LETTER_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
] as const;

const DIGIT_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "-",
  "0",
  "/",
] as const;

const keyClass =
  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg border border-surface-border bg-surface-overlay text-sm font-semibold text-zinc-100 transition hover:bg-white/5 active:bg-white/10 disabled:opacity-40";
const keyMutedClass =
  "flex h-10 items-center justify-center rounded-lg border border-surface-border bg-surface-raised px-3 text-xs font-medium text-zinc-400 transition hover:bg-white/5 active:bg-white/10 disabled:opacity-40";

/**
 * On-screen text entry that never focuses a system text input.
 * Avoids Android soft-keyboard suppression when an OTG scanner (HID keyboard) is connected.
 */
export function OnScreenTextPad({
  value,
  onChange,
  label,
  hint,
  placeholder = "—",
  disabled = false,
  maxLength = 64,
  defaultMode = "letters",
}: OnScreenTextPadProps) {
  const [mode, setMode] = useState<PadMode>(defaultMode);

  const append = (char: string) => {
    if (disabled) return;
    if (value.length >= maxLength) return;
    onChange(`${value}${char}`);
  };

  const backspace = () => {
    if (disabled || !value) return;
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    if (disabled || !value) return;
    onChange("");
  };

  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </p>
      ) : null}

      {/* Display only — not an input, so OTG cannot type here and soft keyboard is never required */}
      <div
        aria-live="polite"
        className={`min-h-[2.75rem] rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-base text-zinc-100 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {value ? (
          <span className="break-all">{value}</span>
        ) : (
          <span className="text-zinc-600">{placeholder}</span>
        )}
      </div>

      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("letters")}
          className={`${keyMutedClass} flex-1 ${
            mode === "letters" ? "border-accent/40 text-accent" : ""
          }`}
        >
          ABC
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("digits")}
          className={`${keyMutedClass} flex-1 ${
            mode === "digits" ? "border-accent/40 text-accent" : ""
          }`}
        >
          123
        </button>
        <button
          type="button"
          disabled={disabled || !value}
          onClick={clear}
          className={keyMutedClass}
        >
          Clear
        </button>
        <button
          type="button"
          disabled={disabled || !value}
          onClick={backspace}
          aria-label="Backspace"
          className={keyMutedClass}
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>

      {mode === "letters" ? (
        <div className="space-y-1.5">
          {LETTER_ROWS.map((row) => (
            <div key={row.join("")} className="flex gap-1">
              {row.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  disabled={disabled}
                  onClick={() => append(letter)}
                  className={keyClass}
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => append(" ")}
            className={`${keyMutedClass} w-full`}
          >
            Space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {DIGIT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => append(key)}
              className={`${keyClass} h-11`}
            >
              {key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
