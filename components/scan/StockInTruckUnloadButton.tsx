"use client";

interface StockInTruckUnloadButtonProps {
  baleCount: number;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function StockInTruckUnloadButton({
  baleCount,
  loading,
  disabled,
  onClick,
}: StockInTruckUnloadButtonProps) {
  if (baleCount <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-accent/80 bg-accent px-5 py-4 text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-accent/25 transition hover:bg-accent-muted disabled:border-surface-border disabled:bg-surface-overlay disabled:text-zinc-500 disabled:shadow-none"
      >
        {loading ? "Uploading…" : "TRUCK UNLOADED"}
        <span className="rounded-lg bg-white/20 px-2 py-0.5 text-sm tabular-nums">
          {baleCount}
        </span>
      </button>
      <p className="text-center text-xs text-zinc-600">
        Tap when this truck is done. Pending uploads retry automatically; then the
        tally clears for the next load.
      </p>
    </>
  );
}
