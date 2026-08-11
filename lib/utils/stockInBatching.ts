import type {
  InventoryLogWithRelations,
  StockInReportBatch,
} from "@/lib/types/database";

/** Max gap between consecutive same-product/godown stock-ins in one purchase batch. */
export const STOCK_IN_BATCH_GAP_MS = 15 * 60 * 1000;

/** Genuine purchase stock-in (exclude return / transfer / correction channels). */
export function isGenuineStockIn(
  log: Pick<InventoryLogWithRelations, "transaction_type" | "sale_channel">
): boolean {
  if (log.transaction_type !== "STOCK_IN") return false;
  const channel = log.sale_channel ?? "STOCK_IN";
  return channel === "STOCK_IN";
}

function groupKey(log: InventoryLogWithRelations): string {
  return `${log.product_id}:${log.godown_id}`;
}

/**
 * Club STOCK_IN logs by product + godown, splitting when consecutive
 * timestamps for that pair are more than 15 minutes apart.
 */
export function clubStockInBatches(
  logs: InventoryLogWithRelations[],
  gapMs = STOCK_IN_BATCH_GAP_MS
): StockInReportBatch[] {
  const genuine = logs.filter(isGenuineStockIn);
  const byKey = new Map<string, InventoryLogWithRelations[]>();

  for (const log of genuine) {
    const key = groupKey(log);
    const list = byKey.get(key);
    if (list) list.push(log);
    else byKey.set(key, [log]);
  }

  const batches: StockInReportBatch[] = [];

  for (const [, group] of byKey) {
    group.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let current: InventoryLogWithRelations[] = [];

    const flush = () => {
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      const bag_count = Math.round(
        current.reduce((sum, l) => sum + Number(l.quantity), 0)
      );
      const handlers = new Set(
        current.map((l) => l.handled_by?.trim()).filter(Boolean)
      );
      batches.push({
        id: `${first.id}:${last.id}`,
        product_id: first.product_id,
        product_name: first.products?.name ?? "Unknown Product",
        product_code: first.products?.product_code ?? null,
        godown_id: first.godown_id,
        godown_name: first.godowns?.location_name ?? null,
        bag_count,
        scan_count: current.length,
        started_at: first.timestamp,
        ended_at: last.timestamp,
        handled_by: handlers.size === 1 ? [...handlers][0]! : null,
        logs: current,
      });
      current = [];
    };

    for (const log of group) {
      if (current.length === 0) {
        current.push(log);
        continue;
      }
      const prev = current[current.length - 1];
      const gap =
        new Date(log.timestamp).getTime() - new Date(prev.timestamp).getTime();
      if (gap > gapMs) {
        flush();
      }
      current.push(log);
    }
    flush();
  }

  batches.sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  return batches;
}
