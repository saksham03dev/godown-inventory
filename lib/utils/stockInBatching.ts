import type {
  InventoryLogWithRelations,
  StockInReportBatch,
} from "@/lib/types/database";

/** Genuine purchase stock-in (exclude return / transfer / correction channels). */
export function isGenuineStockIn(
  log: Pick<InventoryLogWithRelations, "transaction_type" | "sale_channel">
): boolean {
  if (log.transaction_type !== "STOCK_IN") return false;
  const channel = log.sale_channel ?? "STOCK_IN";
  return channel === "STOCK_IN";
}

function batchMeta(log: InventoryLogWithRelations) {
  const unit = log.stock_units;
  const batch = unit?.stock_batches;
  return {
    batchId: unit?.batch_id ?? batch?.id ?? null,
    purchaseNo: batch?.purchase_no?.trim() || null,
    sourceName: batch?.source_name?.trim() || null,
  };
}

/** Fold purchase / source labels so "P-129" and "p 129" club together. */
export function normalizePurchaseIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Club key: product + warehouse + purchase no when set, otherwise similar
 * source name, otherwise the label batch.
 */
function groupKey(log: InventoryLogWithRelations): string {
  const meta = batchMeta(log);
  const purchase = normalizePurchaseIdentity(meta.purchaseNo);
  const source = normalizePurchaseIdentity(meta.sourceName);
  if (purchase) return `${log.product_id}:${log.godown_id}:po:${purchase}`;
  if (source) return `${log.product_id}:${log.godown_id}:src:${source}`;
  if (meta.batchId) return `${log.product_id}:${log.godown_id}:batch:${meta.batchId}`;
  return `${log.product_id}:${log.godown_id}:none`;
}

function pickDisplayValue(
  logs: InventoryLogWithRelations[],
  field: "purchaseNo" | "sourceName"
): string | null {
  const seen = new Map<string, string>();
  for (const log of logs) {
    const raw = batchMeta(log)[field];
    const key = normalizePurchaseIdentity(raw);
    if (!key || seen.has(key)) continue;
    seen.set(key, raw!);
  }
  if (seen.size === 0) return null;
  return [...seen.values()].join(" · ");
}

/**
 * Club STOCK_IN logs by product + warehouse + purchase no (or similar source).
 */
export function clubStockInBatches(
  logs: InventoryLogWithRelations[]
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
    const first = group[0];
    const last = group[group.length - 1];
    const bag_count = Math.round(
      group.reduce((sum, l) => sum + Number(l.quantity), 0)
    );
    const handlers = new Set(
      group.map((l) => l.handled_by?.trim()).filter(Boolean)
    );
    batches.push({
      id: `${first.id}:${last.id}`,
      product_id: first.product_id,
      product_name: first.products?.name ?? "Unknown Product",
      product_code: first.products?.product_code ?? null,
      godown_id: first.godown_id,
      godown_name: first.godowns?.location_name ?? null,
      purchase_no: pickDisplayValue(group, "purchaseNo"),
      source_name: pickDisplayValue(group, "sourceName"),
      bag_count,
      scan_count: group.length,
      started_at: first.timestamp,
      ended_at: last.timestamp,
      handled_by: handlers.size === 1 ? [...handlers][0]! : null,
      logs: group,
    });
  }

  batches.sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  return batches;
}
