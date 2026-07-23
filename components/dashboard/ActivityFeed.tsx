import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";
import type { ActivityFeedItem } from "@/lib/types/database";

interface ActivityFeedProps {
  items: ActivityFeedItem[];
}

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function channelLabel(channel: ActivityFeedItem["sale_channel"]): string | null {
  if (channel === "RETAIL") return "Retail";
  if (channel === "WHOLESALE") return "Wholesale";
  if (channel === "STOCK_IN") return null;
  return null;
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
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
        <p className="text-xs text-zinc-500">
          Last {items.length} inventory events (stock-outs clubbed by slip)
        </p>
      </div>

      <ul className="divide-y divide-surface-border">
        {items.map((item) => {
          const isStockIn = item.transaction_type === "STOCK_IN";
          const Icon = isStockIn ? ArrowDownLeft : ArrowUpRight;
          const channel = channelLabel(item.sale_channel);
          const title =
            item.product_code?.trim() || item.product_name || "Unknown Product";
          const secondary = [
            item.product_code?.trim() ? item.product_name : null,
            isStockIn ? "Stock In" : "Stock Out",
            channel,
            item.godown_name,
            item.biller_name?.trim() ? `Biller ${item.biller_name.trim()}` : null,
            item.bale_count > 1 ? `${item.bale_count} labels` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <li
              key={item.id}
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
                  {title}
                </p>
                <p className="text-xs text-zinc-500">
                  {secondary}
                  {" · "}
                  <span className="tabular-nums text-zinc-400">
                    {Math.round(item.bag_count)} bags
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-xs text-zinc-600">
                <Clock className="h-3 w-3" />
                {formatTimestamp(item.timestamp)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
