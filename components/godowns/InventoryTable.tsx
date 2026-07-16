import { ChevronRight, Package } from "lucide-react";
import { OpenBaleCountBadge } from "@/components/inventory/OpenBaleBadge";
import type { GodownStockItem } from "@/lib/types/database";

interface InventoryTableProps {
  items: GodownStockItem[];
  godownName?: string;
  onProductClick?: (item: GodownStockItem) => void;
}

export function InventoryTable({
  items,
  godownName,
  onProductClick,
}: InventoryTableProps) {
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
                Code
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Barcode
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Category
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
            {items.map((item) => (
              <tr
                key={item.product_id}
                onClick={() => onProductClick?.(item)}
                className={`transition hover:bg-white/[0.02] ${
                  onProductClick ? "cursor-pointer" : ""
                }`}
              >
                <td className="px-5 py-4 font-medium text-zinc-200">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {item.product_name}
                    <OpenBaleCountBadge count={item.open_bales} />
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                    {item.product_code}
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                  {item.barcode_id}
                </td>
                <td className="px-5 py-4">
                  {item.category ? (
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-xs text-zinc-400">
                      {item.category}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent">
                    {item.quantity.toLocaleString()}
                  </span>
                </td>
                {onProductClick && (
                  <td className="px-3 py-4 text-zinc-500">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
