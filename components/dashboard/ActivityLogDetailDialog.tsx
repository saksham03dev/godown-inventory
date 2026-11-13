"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import type { ActivityFeedItem, InventoryLogWithRelations } from "@/lib/types/database";

function formatWhen(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function typeLabel(type: InventoryLogWithRelations["transaction_type"]): string {
  if (type === "STOCK_IN") return "Stock in";
  if (type === "STOCK_OUT") return "Stock out";
  return type;
}

interface ActivityLogDetailDialogProps {
  open: boolean;
  item: ActivityFeedItem | null;
  logs: InventoryLogWithRelations[];
  onClose: () => void;
}

export function ActivityLogDetailDialog({
  open,
  item,
  logs,
  onClose,
}: ActivityLogDetailDialogProps) {
  const selected =
    item == null
      ? []
      : logs.filter((log) => item.log_ids.includes(log.id));

  const title = item
    ? item.product_code?.trim() || item.product_name
    : "Activity";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={
        item
          ? `${typeLabel(item.transaction_type)} · ${Math.round(item.bag_count)} bags · ${item.bale_count} label${item.bale_count === 1 ? "" : "s"}`
          : undefined
      }
      size="lg"
    >
      {!item ? null : (
        <div className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {item.godown_name ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Godown
                </dt>
                <dd className="text-zinc-200">{item.godown_name}</dd>
              </div>
            ) : null}
            {item.sale_channel && item.sale_channel !== "STOCK_IN" ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Channel
                </dt>
                <dd className="text-zinc-200">{item.sale_channel}</dd>
              </div>
            ) : null}
            {item.biller_name?.trim() ? (
              <div>
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  Biller
                </dt>
                <dd className="text-zinc-200">{item.biller_name.trim()}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wider text-zinc-500">
                Latest
              </dt>
              <dd className="text-zinc-200">{formatWhen(item.timestamp)}</dd>
            </div>
          </dl>

          {item.stock_out_slip_id ? (
            <p className="text-sm">
              <Link
                href="/stock-out-slips"
                className="font-medium text-accent hover:underline"
                onClick={onClose}
              >
                View stock-out slips
              </Link>
            </p>
          ) : null}

          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Log lines ({selected.length})
          </p>
          <ul className="max-h-80 divide-y divide-surface-border overflow-y-auto rounded-xl border border-surface-border">
            {selected.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">
                No log rows loaded for this group.
              </li>
            ) : (
              selected
                .sort(
                  (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime()
                )
                .map((log) => {
                  const unit = log.stock_units;
                  return (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-200">
                          {unit?.unit_number != null
                            ? `Bale #${unit.unit_number}`
                            : "Bale"}
                          {unit?.unit_barcode ? (
                            <span className="ml-2 font-mono text-xs text-zinc-500">
                              {unit.unit_barcode}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatWhen(log.timestamp)}
                          {log.handled_by ? ` · ${log.handled_by}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-zinc-100">
                        {Math.round(Number(log.quantity))} bags
                      </span>
                    </li>
                  );
                })
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
