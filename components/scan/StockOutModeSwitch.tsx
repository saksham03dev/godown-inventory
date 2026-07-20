"use client";

export type StockOutSaleMode = "wholesale" | "retail";

interface StockOutModeSwitchProps {
  mode: StockOutSaleMode;
  onChange: (mode: StockOutSaleMode) => void;
  disabled?: boolean;
}

export function StockOutModeSwitch({
  mode,
  onChange,
  disabled,
}: StockOutModeSwitchProps) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Stock out mode
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("wholesale")}
          className={`rounded-xl px-3 py-3 text-left transition disabled:opacity-50 ${
            mode === "wholesale"
              ? "bg-accent/15 ring-1 ring-accent/40"
              : "border border-surface-border hover:bg-white/5"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              mode === "wholesale" ? "text-accent" : "text-zinc-300"
            }`}
          >
            Wholesale
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Full bale · scan & go</p>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("retail")}
          className={`rounded-xl px-3 py-3 text-left transition disabled:opacity-50 ${
            mode === "retail"
              ? "bg-amber-500/15 ring-1 ring-amber-500/40"
              : "border border-surface-border hover:bg-white/5"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              mode === "retail" ? "text-amber-400" : "text-zinc-300"
            }`}
          >
            Retail
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Scan · enter bags to cut</p>
        </button>
      </div>
    </div>
  );
}
