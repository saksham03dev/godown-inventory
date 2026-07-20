"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { OpenBaleCountBadge } from "@/components/inventory/OpenBaleBadge";
import { groupGodownStockByName } from "@/lib/utils/inventoryGrouping";
import type { GodownStockItem } from "@/lib/types/database";

interface InventoryTableProps {
  items: GodownStockItem[];
  godownName?: string;
  onProductClick?: (item: GodownStockItem) => void;
}

function VariantMeta({ item }: { item: GodownStockItem }) {
  const parts = [
    item.size ? `Size ${item.size}` : null,
    item.quality ? item.quality : null,
  ].filter(Boolean);

  return (
    <p className="mt-0.5 truncate text-xs text-zinc-500">
      <span className="font-mono text-accent">{item.product_code}</span>
      {parts.length ? ` · ${parts.join(" · ")}` : ""}
    </p>
  );
}

export function InventoryTable({
  items,
  godownName,
  onProductClick,
}: InventoryTableProps) {
  const groups = useMemo(() => groupGodownStockByName(items), [items]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
          No inventory in {godownName ?? "this godown"}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Backend Code
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Size
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Bags
              </th>
              {onProductClick && (
                <th className="w-10 px-3 py-3.5">
                  <span className="sr-only">Open</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {groups.map((group) => {
              const isExpanded =
                group.variants.length === 1 || expanded.has(group.key);
              const single = group.variants.length === 1;
              const codes = [
                ...new Set(group.variants.map((v) => v.product_code)),
              ];
              const sizes = [
                ...new Set(
                  group.variants
                    .map((v) => v.size?.trim())
                    .filter(Boolean) as string[]
                ),
              ];

              return (
                <Fragment key={group.key}>
                  <tr
                    onClick={() => {
                      if (single) {
                        onProductClick?.(group.variants[0]);
                      } else {
                        toggleGroup(group.key);
                      }
                    }}
                    className={`bg-surface-raised transition hover:bg-white/[0.02] ${
                      onProductClick || group.variants.length > 1
                        ? "cursor-pointer"
                        : ""
                    }`}
                  >
                    <td className="px-5 py-4 font-medium text-zinc-100">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {!single ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                          )
                        ) : null}
                        {group.product_name}
                        <OpenBaleCountBadge count={group.open_bales} />
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {single ? (
                        <span className="font-mono text-xs text-accent">
                          {group.variants[0].product_code}
                        </span>
                      ) : (
                        <span className="rounded-lg bg-surface-overlay px-2 py-0.5 text-xs text-zinc-300">
                          {codes.length} code{codes.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {single ? (
                        group.variants[0].size ? (
                          <span className="rounded-lg bg-zinc-100/10 px-2.5 py-1 text-sm font-semibold text-zinc-100">
                            {group.variants[0].size}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )
                      ) : sizes.length ? (
                        <span className="text-xs text-zinc-400">
                          {sizes.join(", ")}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent">
                        {group.quantity.toLocaleString()}
                      </span>
                    </td>
                    {onProductClick && (
                      <td className="px-3 py-4 text-zinc-500">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    )}
                  </tr>

                  {isExpanded &&
                    !single &&
                    group.variants.map((variant) => (
                      <tr
                        key={variant.product_id}
                        onClick={() => onProductClick?.(variant)}
                        className={`bg-surface-overlay/20 transition hover:bg-white/[0.03] ${
                          onProductClick ? "cursor-pointer" : ""
                        }`}
                      >
                        <td className="px-5 py-3 pl-12">
                          <p className="text-sm text-zinc-300">
                            {variant.product_name}
                          </p>
                          {variant.quality ? (
                            <p className="mt-0.5 text-xs text-zinc-600">
                              {variant.quality}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                            {variant.product_code}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {variant.size ? (
                            <span className="rounded-lg bg-zinc-100/10 px-2 py-0.5 text-xs font-semibold text-zinc-100">
                              {variant.size}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-sm font-medium text-zinc-200">
                            {variant.quantity.toLocaleString()}
                          </span>
                        </td>
                        {onProductClick && (
                          <td className="px-3 py-3 text-zinc-500">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        )}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
