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

interface InventoryBarChartProps {
  items: GodownStockItem[];
}

export function InventoryBarChart({ items }: InventoryBarChartProps) {
  const groups = useMemo(() => groupGodownStockByName(items), [items]);
  const totalBags = groups.reduce((sum, g) => sum + g.quantity, 0);
  const sorted = [...groups].sort((a, b) => b.quantity - a.quantity);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">
        Stock by Product Name
      </h3>
      <div className="space-y-4">
        {sorted.map((group, index) => {
          const pct = totalBags > 0 ? (group.quantity / totalBags) * 100 : 0;
          const color = BAR_COLORS[index % BAR_COLORS.length];
          const skuLabel = `${group.variants.length} SKU${group.variants.length === 1 ? "" : "s"}`;

          return (
            <div key={group.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-zinc-200">
                  {group.product_name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    · {skuLabel}
                  </span>
                </p>
                <p className="shrink-0 text-sm text-zinc-300">
                  <span className="font-semibold text-zinc-100">
                    {group.quantity.toLocaleString()}
                  </span>
                  <span className="text-zinc-500"> · </span>
                  <span className="text-zinc-400">{pct.toFixed(1)}%</span>
                </p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
