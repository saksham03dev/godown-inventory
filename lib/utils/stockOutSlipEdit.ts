import type { StockOutSlipWithDetails } from "@/lib/types/database";

/** True when bill metadata or per-bale qty fields differ from the loaded slip. */
export function isStockOutSlipEditDirty(
  slip: StockOutSlipWithDetails,
  editBiller: string,
  editBillNo: string,
  editBags: Record<string, string>
): boolean {
  if (editBiller.trim() !== (slip.biller_name ?? "").trim()) {
    return true;
  }
  if (editBillNo.trim() !== (slip.bill_no ?? "").trim()) {
    return true;
  }
  return slip.stock_out_slip_units.some((u) => {
    const saved = String(Math.round(u.bags_moved));
    const current = editBags[u.id] ?? saved;
    return current !== saved;
  });
}
