"use client";

import type { StockUnit } from "@/lib/types/database";

interface LabelDetailCardProps {
  unit: StockUnit;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span
        className={`text-sm text-zinc-200 ${mono ? "font-mono text-xs" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  LABELLED: "Labelled (not stocked in)",
  STOCKED_IN: "Stocked in",
  STOCKED_OUT: "Stocked out",
};

export function LabelDetailCard({ unit }: LabelDetailCardProps) {
  const product = unit.products;
  const batch = unit.stock_batches;
  const godown = unit.godowns;
  const retailPrice = (product as { retail_selling_price?: number } | null)
    ?.retail_selling_price;

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 animate-slide-up">
      <p className="text-xs font-medium uppercase tracking-wider text-accent">
        Label Details
      </p>
      <p className="mt-1 font-mono text-lg font-bold text-zinc-100">
        {unit.unit_barcode}
      </p>
      <p className="text-xs text-zinc-500">
        Unique unit ID: {unit.id}
      </p>

      <div className="mt-4 space-y-3 divide-y divide-surface-border/50">
        <div className="space-y-2 pb-3">
          <p className="text-xs font-semibold text-zinc-400">Product</p>
          <DetailRow label="Name" value={product?.name} />
          <DetailRow label="Backend Code" value={product?.product_code} mono />
          <DetailRow label="Size" value={product?.size} />
          <DetailRow
            label="Retail Price"
            value={
              retailPrice !== undefined
                ? `₹${Number(retailPrice).toFixed(2)}`
                : null
            }
          />
        </div>

        <div className="space-y-2 py-3">
          <p className="text-xs font-semibold text-zinc-400">Unit</p>
          <DetailRow label="Unit Number" value={`#${unit.unit_number}`} />
          <DetailRow label="Status" value={STATUS_LABELS[unit.status] ?? unit.status} />
          <DetailRow label="Barcode" value={unit.unit_barcode} mono />
        </div>

        <div className="space-y-2 py-3">
          <p className="text-xs font-semibold text-zinc-400">Batch</p>
          <DetailRow label="Batch Code" value={batch?.batch_code} mono />
          <DetailRow label="Source / Buyer" value={batch?.source_name} />
        </div>

        <div className="space-y-2 pt-3">
          <p className="text-xs font-semibold text-zinc-400">Location & Timeline</p>
          <DetailRow label="Godown" value={godown?.location_name ?? "—"} />
          <DetailRow
            label="Stocked In"
            value={
              unit.stocked_in_at
                ? new Date(unit.stocked_in_at).toLocaleString()
                : null
            }
          />
          <DetailRow
            label="Stocked Out"
            value={
              unit.stocked_out_at
                ? new Date(unit.stocked_out_at).toLocaleString()
                : null
            }
          />
          <DetailRow
            label="Created"
            value={new Date(unit.created_at).toLocaleString()}
          />
        </div>
      </div>
    </div>
  );
}
