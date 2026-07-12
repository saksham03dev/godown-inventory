import type { BillItem } from "@/lib/types/database";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";

export function formatUnitLabel(item: Pick<BillItem, "unit_number" | "batch_quantity">): string | null {
  if (item.unit_number == null) return null;
  if (item.batch_quantity != null && item.batch_quantity > 0) {
    return `Bale #${item.unit_number}`;
  }
  return `Bale #${item.unit_number}`;
}

/** Human-readable bag quantity for a bill line. */
export function formatBillBags(item: Pick<BillItem, "quantity">): string {
  return `${Number(item.quantity).toLocaleString()} bags`;
}

/** Retail bale line subtitle (partial bag sale from a bale). */
export function formatRetailBaleNote(
  item: Pick<BillItem, "quantity" | "unit_number" | "sale_channel">
): string | null {
  if (item.sale_channel !== "RETAIL") return null;
  const bags = Number(item.quantity).toLocaleString();
  if (item.unit_number != null) {
    return `${bags} bags from Bale #${item.unit_number}`;
  }
  return `${bags} bags (retail)`;
}

/** Wholesale bale line subtitle (1 sealed bale = 1000 bags). */
export function formatWholesaleBaleNote(item: Pick<BillItem, "quantity" | "sale_channel">): string | null {
  if (item.sale_channel === "RETAIL") return null;
  if (item.quantity === BAGS_PER_BALE) return "1 sealed bale";
  if (item.quantity > 0 && item.quantity % BAGS_PER_BALE === 0) {
    const bales = item.quantity / BAGS_PER_BALE;
    return `${bales} bale${bales === 1 ? "" : "s"}`;
  }
  return null;
}
