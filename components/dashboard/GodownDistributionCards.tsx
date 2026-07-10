import { Warehouse } from "lucide-react";
import type { GodownDistribution } from "@/lib/types/database";

interface GodownDistributionCardsProps {
  distribution: GodownDistribution[];
}

const barColors = [
  "bg-accent",
  "bg-success",
  "bg-amber-400",
  "bg-purple-400",
  "bg-pink-400",
  "bg-cyan-400",
];

export function GodownDistributionCards({
  distribution,
}: GodownDistributionCardsProps) {
  if (distribution.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-zinc-500">
        No godown distribution data yet. Start scanning to populate inventory.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {distribution.map((item, index) => (
        <div
          key={item.godown_id}
          className="rounded-2xl border border-surface-border bg-surface-raised p-5"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
              <Warehouse className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-medium text-zinc-100">{item.location_name}</p>
              <p className="text-xs text-zinc-500">
                {item.total_units} units allocated
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Share of stock</span>
              <span className="font-semibold text-zinc-200">
                {item.percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-overlay">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColors[index % barColors.length]}`}
                style={{ width: `${Math.max(item.percentage, 2)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
