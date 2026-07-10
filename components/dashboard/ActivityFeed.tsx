import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import type { InventoryLogWithRelations } from "@/lib/types/database";

interface ActivityFeedProps {
  logs: InventoryLogWithRelations[];
}

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 text-center text-sm text-zinc-500">
        No recent activity. Transactions will appear here in real time.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised">
      <div className="border-b border-surface-border px-5 py-4">
        <h3 className="font-medium text-zinc-100">Live Activity Feed</h3>
        <p className="text-xs text-zinc-500">Last 5 inventory transactions</p>
      </div>

      <ul className="divide-y divide-surface-border">
        {logs.map((log) => {
          const isStockIn = log.transaction_type === "STOCK_IN";
          const Icon = isStockIn ? ArrowDownLeft : ArrowUpRight;

          return (
            <li
              key={log.id}
              className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02]"
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isStockIn ? "bg-success/10" : "bg-danger/10"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isStockIn ? "text-success" : "text-danger"}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {log.products?.name ?? "Unknown Product"}
                </p>
                <p className="text-xs text-zinc-500">
                  {isStockIn ? "Stock In" : "Stock Out"} ·{" "}
                  {log.godowns?.location_name ?? "Unknown Godown"} · ×
                  {log.quantity}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-xs text-zinc-600">
                <Clock className="h-3 w-3" />
                {formatTimestamp(log.timestamp)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
