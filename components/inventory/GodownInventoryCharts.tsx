"use client";

import { useMemo } from "react";
import { groupGodownStockByName } from "@/lib/utils/inventoryGrouping";
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
  const groups = useMemo(() => groupGodownStockByName(items), [items]);
  const totalBags = groups.reduce((sum, g) => sum + g.quantity, 0);
  const sorted = [...groups].sort((a, b) => b.quantity - a.quantity);
  const maxQty = sorted[0]?.quantity ?? 1;

  if (items.length === 0) {
    return null;
  }

  const variantCount = items.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Total Bags
          </p>
          <p className="mt-2 text-4xl font-bold text-zinc-100">
            {totalBags.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-zinc-500">in {godownName}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Product Names
          </p>
          <p className="mt-2 text-4xl font-bold text-accent">{groups.length}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {variantCount} SKU{variantCount === 1 ? "" : "s"} total
          </p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Top Product
          </p>
          <p className="mt-2 truncate text-lg font-bold text-zinc-100">
            {sorted[0]?.product_name ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {sorted[0]
              ? [
                  sorted[0].variants.length > 1
                    ? `${sorted[0].variants.length} variants`
                    : sorted[0].variants[0]?.size
                      ? `Size ${sorted[0].variants[0].size}`
                      : null,
                  `${sorted[0].quantity.toLocaleString()} bags`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">
          Stock by Product Name (bags)
        </h3>
        <div className="space-y-4">
          {sorted.map((group, index) => {
            const pct = totalBags > 0 ? (group.quantity / totalBags) * 100 : 0;
            const barWidth = maxQty > 0 ? (group.quantity / maxQty) * 100 : 0;
            const color = BAR_COLORS[index % BAR_COLORS.length];
            const qualities = [
              ...new Set(
                group.variants
                  .map((v) => v.quality?.trim())
                  .filter(Boolean) as string[]
              ),
            ];
            const sizes = [
              ...new Set(
                group.variants
                  .map((v) => v.size?.trim())
                  .filter(Boolean) as string[]
              ),
            ];

            return (
              <div key={group.key}>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {group.product_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {group.variants.length > 1 ? (
                        <span>{group.variants.length} variants · </span>
                      ) : null}
                      {qualities.length ? (
                        <span className="font-semibold text-amber-200/90">
                          {qualities.join(", ")}
                        </span>
                      ) : null}
                      {qualities.length && sizes.length ? " · " : ""}
                      {sizes.length ? (
                        <span className="font-semibold text-zinc-300">
                          {sizes.map((s) => `Size ${s}`).join(", ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-zinc-100">
                      {group.quantity.toLocaleString()}
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
          {sorted.map((group, index) => {
            const pct = totalBags > 0 ? (group.quantity / totalBags) * 100 : 0;
            if (pct <= 0) return null;
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <div
                key={group.key}
                className={`${color} relative min-w-[2px]`}
                style={{ width: `${pct}%` }}
                title={`${group.product_name}: ${group.quantity.toLocaleString()} bags (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {sorted.map((group, index) => {
            const pct = totalBags > 0 ? (group.quantity / totalBags) * 100 : 0;
            const color = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <li key={group.key} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${color}`} />
                <span className="truncate text-zinc-400">
                  {group.product_name}
                  {group.variants.length > 1 ? (
                    <span className="text-zinc-600">
                      {" "}
                      ({group.variants.length} SKUs)
                    </span>
                  ) : null}{" "}
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
