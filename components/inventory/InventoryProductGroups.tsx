"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Search,
} from "lucide-react";
import {
  filterStockItems,
  groupGodownStockByName,
} from "@/lib/utils/inventoryGrouping";
import type { GodownStockItem } from "@/lib/types/database";

interface InventoryProductGroupsProps {
  items: GodownStockItem[];
  godownId: string;
  godownName?: string;
  searchQuery: string;
  onProductClick?: (item: GodownStockItem) => void;
}

export function InventoryProductGroups({
  items,
  godownName,
  searchQuery,
  onProductClick,
}: InventoryProductGroupsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(
    () => filterStockItems(items, searchQuery),
    [items, searchQuery]
  );

  const groups = useMemo(
    () => groupGodownStockByName(filteredItems),
    [filteredItems]
  );

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <Package className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-400">
          No inventory in {godownName ?? "this view"}
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <Search className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-400">
          No products match &ldquo;{searchQuery}&rdquo;
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isExpanded = expanded.has(group.key);
        const variantCount = group.variants.length;

        return (
          <section
            key={group.key}
            className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised"
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02] sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
                <h3 className="truncate text-base font-semibold text-zinc-100">
                  {group.product_name}
                </h3>
                {variantCount > 1 ? (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {variantCount} SKUs
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-accent">
                {group.quantity.toLocaleString()} bags
              </span>
            </button>

            {isExpanded ? (
              <ul className="border-t border-surface-border divide-y divide-surface-border">
                {group.variants.map((variant) => (
                  <li key={variant.product_id}>
                    <button
                      type="button"
                      onClick={() => onProductClick?.(variant)}
                      disabled={!onProductClick}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 pl-11 text-left transition hover:bg-white/[0.02] disabled:cursor-default sm:px-5 sm:pl-12"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                          {variant.product_code}
                        </span>
                        {variant.size?.trim() ? (
                          <span className="text-zinc-400">
                            Size {variant.size.trim()}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {variant.quantity.toLocaleString()} bags
                        </span>
                        {onProductClick ? (
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
