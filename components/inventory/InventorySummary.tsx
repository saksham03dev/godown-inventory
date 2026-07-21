"use client";

import { useMemo } from "react";
import { groupGodownStockByName } from "@/lib/utils/inventoryGrouping";
import type { GodownStockItem } from "@/lib/types/database";

interface InventorySummaryProps {
  items: GodownStockItem[];
  scopeLabel: string;
}

export function InventorySummary({ items, scopeLabel }: InventorySummaryProps) {
  const groups = useMemo(() => groupGodownStockByName(items), [items]);
  const totalBags = groups.reduce((sum, g) => sum + g.quantity, 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Total Bags
        </p>
        <p className="mt-2 text-4xl font-bold text-zinc-100">
          {totalBags.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{scopeLabel}</p>
      </div>
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Product Names
        </p>
        <p className="mt-2 text-4xl font-bold text-accent">{groups.length}</p>
        <p className="mt-1 text-xs text-zinc-500">grouped by name</p>
      </div>
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          SKUs
        </p>
        <p className="mt-2 text-4xl font-bold text-zinc-100">{items.length}</p>
        <p className="mt-1 text-xs text-zinc-500">
          backend code{items.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
