import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import type { Product, ScanTransactionResult, StockUnit } from "@/lib/types/database";

/** Window in which a stock-in that already landed can still be counted on the tally. */
const RECENT_STOCK_IN_MS = 10 * 60 * 1000;

export function shouldRecoverStockIn(message: string): boolean {
  return /already stocked in|failed to fetch|network|timeout|request failed|stock transaction failed/i.test(
    message
  );
}

function productFromUnit(unit: StockUnit): Product | null {
  const raw = unit.products;
  if (!raw || Array.isArray(raw) || !("name" in raw)) return null;
  return {
    id: unit.product_id,
    name: String(raw.name ?? "Product"),
    product_code: "product_code" in raw ? String(raw.product_code ?? "") : "",
    barcode_id: "barcode_id" in raw ? String(raw.barcode_id ?? "") : "",
    total_stock: 0,
    size: raw.size ? String(raw.size) : null,
    quality: "quality" in raw && raw.quality ? String(raw.quality) : null,
    special_note: null,
    description: null,
    category: "category" in raw && raw.category ? String(raw.category) : null,
    retail_selling_price: Number(raw.retail_selling_price ?? 0),
  };
}

/** A stock-in that just landed, even if this screen was told it was already in stock. */
export function stockInResultIfRecent(
  unit: StockUnit,
  godownId: string
): ScanTransactionResult | null {
  if (unit.status !== "STOCKED_IN" || unit.godown_id !== godownId || !unit.stocked_in_at) {
    return null;
  }
  const age = Date.now() - new Date(unit.stocked_in_at).getTime();
  if (age < -60_000 || age > RECENT_STOCK_IN_MS) return null;

  const product = productFromUnit(unit);
  if (!product) return null;
  const bags = Math.round(Number(unit.remaining_bags));
  return {
    success: true,
    message: `Already received — ${product.name}, bale #${unit.unit_number} added to the tally. Stock was not changed.`,
    product,
    stockUnit: unit,
    isUnitScan: true,
    bagsMoved: bags > 0 ? bags : BAGS_PER_BALE,
  };
}

export async function recoverRecentStockIn(
  barcodeId: string,
  godownId: string
): Promise<ScanTransactionResult | null> {
  try {
    const unit = await fetchStockUnitByBarcode(barcodeId);
    if (!unit) return null;
    return stockInResultIfRecent(unit, godownId);
  } catch {
    return null;
  }
}
