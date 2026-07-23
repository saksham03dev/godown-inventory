import type {
  ActivityFeedItem,
  InventoryLogWithRelations,
} from "@/lib/types/database";

type LogWithOptionalSlip = InventoryLogWithRelations & {
  stock_out_slips?: { biller_name: string | null } | null;
};

/**
 * Club STOCK_OUT rows that share a slip + product into one feed item (bag qty primary).
 * Other logs remain one item each.
 */
export function groupInventoryLogsForActivity(
  logs: LogWithOptionalSlip[],
  limit = 5
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [];
  const slipProductSeen = new Set<string>();

  for (const log of logs) {
    if (
      log.transaction_type === "STOCK_OUT" &&
      log.stock_out_slip_id
    ) {
      const key = `${log.stock_out_slip_id}:${log.product_id}`;
      if (slipProductSeen.has(key)) continue;
      slipProductSeen.add(key);

      const group = logs.filter(
        (l) =>
          l.stock_out_slip_id === log.stock_out_slip_id &&
          l.product_id === log.product_id &&
          l.transaction_type === "STOCK_OUT"
      );
      const bag_count = group.reduce((sum, l) => sum + Number(l.quantity), 0);
      const newest = group.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );

      items.push({
        id: key,
        transaction_type: "STOCK_OUT",
        product_name: newest.products?.name ?? "Unknown Product",
        product_code: newest.products?.product_code ?? null,
        godown_name: newest.godowns?.location_name ?? null,
        bag_count: Math.round(bag_count),
        bale_count: group.length,
        sale_channel: newest.sale_channel,
        biller_name: newest.stock_out_slips?.biller_name ?? null,
        timestamp: newest.timestamp,
        stock_out_slip_id: newest.stock_out_slip_id,
      });
    } else {
      items.push({
        id: log.id,
        transaction_type: log.transaction_type,
        product_name: log.products?.name ?? "Unknown Product",
        product_code: log.products?.product_code ?? null,
        godown_name: log.godowns?.location_name ?? null,
        bag_count: Math.round(Number(log.quantity)),
        bale_count: 1,
        sale_channel: log.sale_channel,
        timestamp: log.timestamp,
        stock_out_slip_id: log.stock_out_slip_id ?? null,
      });
    }

    if (items.length >= limit) break;
  }

  return items.slice(0, limit);
}
