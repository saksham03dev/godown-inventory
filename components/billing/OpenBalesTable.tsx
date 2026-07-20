"use client";

import { PackageOpen } from "lucide-react";
import { OpenBaleBadge } from "@/components/inventory/OpenBaleBadge";
import { formatBagCount } from "@/lib/utils/inventory";
import type { StockUnit } from "@/lib/types/database";

interface OpenBalesTableProps {
  units: StockUnit[];
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OpenBalesTable({ units }: OpenBalesTableProps) {
  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <PackageOpen className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-400">
          No open bales
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
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Bale
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Barcode
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Godown
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Bags left
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Opened
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {units.map((unit) => {
              const product = unit.products;
              return (
                <tr key={unit.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <p className="inline-flex flex-wrap items-center gap-2 font-medium text-zinc-200">
                      {product?.name ?? "Unknown"}
                      <OpenBaleBadge
                        remainingBags={unit.remaining_bags}
                        compact
                      />
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {product?.product_code}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-300">
                    #{unit.unit_number}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-zinc-400">
                    {unit.unit_barcode}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-300">
                    {unit.godowns?.location_name ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex rounded-lg bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-400">
                      {formatBagCount(unit.remaining_bags)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-zinc-400">
                    {formatWhen(unit.opened_at)}
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
