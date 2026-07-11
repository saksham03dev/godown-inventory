"use client";

import type { GodownStockItem } from "@/lib/types/database";

const BAR_COLORS = [
  "bg-accent",
  "bg-success",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
];

interface GodownInventoryChartsProps {
  items: GodownStockItem[];
  godownName: string;
}

export function GodownInventoryCharts({
  items,
  godownName,
}: GodownInventoryChartsProps) {
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const sorted = [...items].sort((a, b) => b.quantity - a.quantity);
  const maxQty = sorted[0]?.quantity ?? 1;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total Units
          </p>
          <p className="mt-2 text-4xl font-bold text-zinc-100">{totalUnits}</p>
          <p className="mt-1 text-xs text-zinc-500">in {godownName}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Product Types
          </p>
          <p className="mt-2 text-4xl font-bold text-accent">{items.length}</p>
          <p className="mt-1 text-xs text-zinc-500">distinct SKUs stocked</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Top Product
          </p>
          <p className="mt-2 truncate text-lg font-bold text-zinc-100">
            {sorted[0]?.product_name ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {sorted[0] ? `${sorted[0].quantity} units` : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          Stock by Product
        </h3>
        <div className="space-y-4">
          {sorted.map((item, index) => {
            const pct = totalUnits > 0 ? (item.quantity / totalUnits) * 100 : 0;
            const barWidth = maxQty > 0 ? (item.quantity / maxQty) * 100 : 0;
            const color = BAR_COLORS[index % BAR_COLORS.length];

            return (
              <div key={item.product_id}>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {item.product_name}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">
                      {item.product_code}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-zinc-100">
                      {item.quantity}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {pct.toFixed(1)}% of stock
                    </p>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-overlay">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          Share of Inventory
        </h3>
        <div className="flex h-8 overflow-hidden rounded-xl">
          {sorted.map((item, index) => {
            const pct = totalUnits > 0 ? (item.quantity / totalUnits) * 100 : 0;
            if (pct <= 0) return null;
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <div
                key={item.product_id}
                className={`${color} relative min-w-[2px]`}
                style={{ width: `${pct}%` }}
                title={`${item.product_name}: ${item.quantity} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {sorted.map((item, index) => {
            const pct = totalUnits > 0 ? (item.quantity / totalUnits) * 100 : 0;
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <li key={item.product_id} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${color}`} />
                <span className="truncate text-zinc-400">
                  {item.product_name}{" "}
                  <span className="text-zinc-600">({pct.toFixed(1)}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
