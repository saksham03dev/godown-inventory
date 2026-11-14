"use client";

import { useMemo } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { balesToBags } from "@/lib/utils/inventory";
import type { StockBatch } from "@/lib/types/database";

function formatWhen(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function LabelPrintHistory({
  batches,
  loading,
  onOpenBatch,
}: {
  batches: StockBatch[];
  loading?: boolean;
  onOpenBatch: (batchId: string) => void;
}) {
  const sorted = useMemo(
    () =>
      [...batches].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [batches]
  );

  const totals = useMemo(() => {
    const bales = batches.reduce(
      (sum, b) => sum + Math.max(0, Math.floor(Number(b.quantity) || 0)),
      0
    );
    return { batches: batches.length, bales, bags: balesToBags(bales) };
  }, [batches]);

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface-overlay">
      <div className="border-b border-surface-border px-4 py-3 sm:px-5">
        <h3 className="font-medium text-zinc-100">Label print history</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          This month — newest first, one row per label batch
        </p>
        {!loading && batches.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-400">
            {totals.batches} batch{totals.batches === 1 ? "" : "es"} ·{" "}
            {totals.bales.toLocaleString("en-IN")} bales (
            {totals.bags.toLocaleString("en-IN")} bags)
          </p>
        ) : null}
      </div>
      {loading ? (
        <div className="py-6">
          <LoadingSpinner size="sm" label="Loading history…" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-500">
          No label batches this month.
        </p>
      ) : (
        <ul className="divide-y divide-surface-border max-h-96 overflow-y-auto">
          {sorted.map((batch) => {
            const product = batch.products;
            const code = product?.product_code?.trim() || "—";
            const name = product?.name?.trim() || "Product";
            const size = product?.size?.trim();
            const bales = Math.max(0, Math.floor(Number(batch.quantity) || 0));
            return (
              <li key={batch.id}>
                <button
                  type="button"
                  onClick={() => onOpenBatch(batch.id)}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-zinc-500">
                      {formatWhen(batch.created_at)}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-labels">
                      {batch.batch_code}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-zinc-200">
                      <span className="font-semibold">{code}</span>
                      <span className="text-zinc-500"> · {name}</span>
                      {size ? (
                        <span className="text-zinc-500">{` · Size ${size}`}</span>
                      ) : null}
                    </p>
                    {(batch.source_name || batch.purchase_no) && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {[batch.source_name, batch.purchase_no ? `PO ${batch.purchase_no}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold tabular-nums text-zinc-100">
                      {bales} bale{bales === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs tabular-nums text-zinc-500">
                      {balesToBags(bales).toLocaleString("en-IN")} bags
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}