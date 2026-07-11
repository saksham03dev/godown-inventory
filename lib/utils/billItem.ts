import type { BillItem } from "@/lib/types/database";

export function formatUnitLabel(item: Pick<BillItem, "unit_number" | "batch_quantity">): string | null {
  if (item.unit_number == null) return null;
  if (item.batch_quantity != null && item.batch_quantity > 0) {
    return `${item.unit_number}/${item.batch_quantity}`;
  }
  return `#${item.unit_number}`;
}
