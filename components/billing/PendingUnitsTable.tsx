"use client";

import { Package } from "lucide-react";
import type { StockUnit } from "@/lib/types/database";

interface PendingUnitsTableProps {
  units: StockUnit[];
  selectedIds: Set<string>;
  onToggle: (unitId: string) => void;
  onToggleAll: () => void;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PendingUnitsTable({
  units,
  selectedIds,
  onToggle,
  onToggleAll,
}: PendingUnitsTableProps) {
  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <Package className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-400">
          No pending stocked-out units
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Units appear here after stock-out and before they are added to a bill.
        </p>
      </div>
    );
  }

  const allSelected = units.every((u) => selectedIds.has(u.id));

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="w-12 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-surface-border bg-surface-overlay accent-accent"
                />
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Unit
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Barcode
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Stocked out from
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Stocked out at
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {units.map((unit) => {
              const product = unit.products;
              const selected = selectedIds.has(unit.id);
              const price = Number(product?.retail_selling_price ?? 0);
              return (
                <tr
                  key={unit.id}
                  onClick={() => onToggle(unit.id)}
                  className={`cursor-pointer transition hover:bg-white/[0.02] ${
                    selected ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggle(unit.id)}
                      aria-label={`Select ${product?.name ?? "unit"}`}
                      className="h-4 w-4 rounded border-surface-border bg-surface-overlay accent-accent"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-zinc-200">
                      {product?.name ?? "Unknown"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {product?.product_code}
                      {product?.size ? ` · ${product.size}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-300">
                    #{unit.unit_number}
                    {unit.stock_batches?.source_name ? (
                      <span className="ml-1 text-xs text-zinc-500">
                        · {unit.stock_batches.source_name}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">
                    {unit.unit_barcode}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-300">
                    {unit.godowns?.location_name ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400">
                    {formatWhen(unit.stocked_out_at)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-zinc-200">
                    ₹{price.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
