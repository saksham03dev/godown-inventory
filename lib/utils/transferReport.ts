import type {
  InventoryLogWithRelations,
  TransferReportRecord,
} from "@/lib/types/database";

interface TransferPair {
  out: InventoryLogWithRelations | null;
  inn: InventoryLogWithRelations | null;
}

function inBusinessDay(timestamp: string, startMs: number, endMs: number): boolean {
  const t = new Date(timestamp).getTime();
  return t >= startMs && t < endMs;
}

function godownName(
  id: string | null | undefined,
  names: ReadonlyMap<string, string>,
  fallback: string | null | undefined
): string | null {
  if (id && names.has(id)) return names.get(id) ?? fallback ?? null;
  return fallback ?? null;
}

/** Pair dispatch (stock-out) and receive (stock-in) transfer scans per bale. */
export function pairTransferLogs(
  logs: InventoryLogWithRelations[]
): TransferPair[] {
  const byUnit = new Map<string, InventoryLogWithRelations[]>();

  for (const log of logs) {
    if (log.sale_channel !== "TRANSFER" || !log.stock_unit_id) continue;
    const list = byUnit.get(log.stock_unit_id) ?? [];
    list.push(log);
    byUnit.set(log.stock_unit_id, list);
  }

  const pairs: TransferPair[] = [];

  for (const unitLogs of byUnit.values()) {
    const sorted = [...unitLogs].sort((a, b) => {
      const delta =
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (delta !== 0) return delta;
      if (a.transaction_type === b.transaction_type) return a.id.localeCompare(b.id);
      return a.transaction_type === "STOCK_OUT" ? -1 : 1;
    });

    let openOut: InventoryLogWithRelations | null = null;
    for (const log of sorted) {
      if (log.transaction_type === "STOCK_OUT") {
        if (openOut) pairs.push({ out: openOut, inn: null });
        openOut = log;
      } else if (log.transaction_type === "STOCK_IN") {
        pairs.push({ out: openOut, inn: log });
        openOut = null;
      }
    }
    if (openOut) pairs.push({ out: openOut, inn: null });
  }

  return pairs;
}

/**
 * Transfers that touched the business day, including dispatches still
 * waiting on a receive scan at the other godown.
 */
export function buildTransferReport(
  logs: InventoryLogWithRelations[],
  range: { startIso: string; endIso: string },
  godownNames: ReadonlyMap<string, string>
): TransferReportRecord[] {
  const startMs = new Date(range.startIso).getTime();
  const endMs = new Date(range.endIso).getTime();
  const records: TransferReportRecord[] = [];

  for (const pair of pairTransferLogs(logs)) {
    const { out, inn } = pair;
    const touchesDay =
      (out != null && inBusinessDay(out.timestamp, startMs, endMs)) ||
      (inn != null && inBusinessDay(inn.timestamp, startMs, endMs));
    if (!touchesDay) continue;

    const anchor = inn ?? out;
    if (!anchor?.stock_unit_id) continue;

    const unit = inn?.stock_units ?? out?.stock_units ?? null;
    const product = inn?.products ?? out?.products ?? null;
    const expectedDestId = inn?.godown_id ?? unit?.transfer_to_godown_id ?? null;
    const dispatchedThisDay =
      out != null && inBusinessDay(out.timestamp, startMs, endMs);
    const missingReceive = dispatchedThisDay && inn == null;
    const stockedAtDest =
      unit?.status === "STOCKED_IN" &&
      expectedDestId != null &&
      unit.godown_id === expectedDestId;

    records.push({
      id: out?.id ?? inn?.id ?? anchor.stock_unit_id,
      stock_unit_id: anchor.stock_unit_id,
      unit_number: unit?.unit_number ?? null,
      unit_barcode: unit?.unit_barcode ?? null,
      product_name: product?.name ?? "Product",
      product_code: product?.product_code?.trim() || null,
      from_godown_name: godownName(
        out?.godown_id ?? unit?.transfer_from_godown_id,
        godownNames,
        out?.godowns?.location_name
      ),
      to_godown_name: godownName(
        expectedDestId,
        godownNames,
        inn?.godowns?.location_name
      ),
      bags: Math.round(Number(out?.quantity ?? inn?.quantity ?? 0)),
      dispatched_at: out?.timestamp ?? null,
      received_at: inn?.timestamp ?? null,
      dispatched_by: out?.handled_by?.trim() || null,
      received_by: inn?.handled_by?.trim() || null,
      scanned_out: out != null,
      scanned_in: inn != null,
      missing_receive_scan: missingReceive,
      not_stocked_in_destination: missingReceive && !stockedAtDest,
      unit_status: unit?.status ?? null,
      current_godown_name: godownName(
        unit?.godown_id,
        godownNames,
        null
      ),
    });
  }

  records.sort((a, b) => {
    if (a.not_stocked_in_destination !== b.not_stocked_in_destination) {
      return a.not_stocked_in_destination ? -1 : 1;
    }
    if (a.missing_receive_scan !== b.missing_receive_scan) {
      return a.missing_receive_scan ? -1 : 1;
    }
    const at = a.dispatched_at ?? a.received_at ?? "";
    const bt = b.dispatched_at ?? b.received_at ?? "";
    return bt.localeCompare(at);
  });

  return records;
}
