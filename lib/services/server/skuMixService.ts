import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSkuMixWarning,
  isSameProductCode,
  isSameProductName,
  type SkuMixConflict,
  type SkuMixWarning,
} from "@/lib/utils/skuMix";
import {
  isMissingColumnError,
} from "@/lib/utils/schemaErrors";

type ProductRow = {
  id: string;
  name: string;
  quality?: string | null;
  size: string | null;
  product_code: string;
};

type BatchRow = {
  batch_code: string;
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** After stock-in, warn when the same product name exists with a different backend code. */
export async function detectSkuMixAfterStockIn(
  supabase: SupabaseClient,
  godownId: string,
  product: Pick<ProductRow, "id" | "name" | "quality" | "size" | "product_code">,
  incomingBatchCode?: string | null
): Promise<SkuMixWarning | undefined> {
  type UnitRow = {
    product_id: string;
    stock_batches: BatchRow | BatchRow[] | null;
    products: ProductRow | ProductRow[] | null;
  };

  let units: UnitRow[] | null = null;
  let error: { message: string } | null = null;

  const primary = await supabase
    .from("stock_units")
    .select(
      `
      product_id,
      stock_batches ( batch_code ),
      products ( id, name, quality, size, product_code )
    `
    )
    .eq("godown_id", godownId)
    .eq("status", "STOCKED_IN");

  units = primary.data as UnitRow[] | null;
  error = primary.error;

  if (error && isMissingColumnError(error.message, "quality")) {
    const fallback = await supabase
      .from("stock_units")
      .select(
        `
      product_id,
      stock_batches ( batch_code ),
      products ( id, name, size, product_code )
    `
      )
      .eq("godown_id", godownId)
      .eq("status", "STOCKED_IN");
    units = fallback.data as UnitRow[] | null;
    error = fallback.error;
  }

  if (error || !units?.length) return undefined;

  const conflicts = new Map<string, SkuMixConflict>();

  for (const unit of units) {
    const rowProduct = normalizeRelation(
      unit.products as ProductRow | ProductRow[] | null
    );
    const batch = normalizeRelation(
      unit.stock_batches as BatchRow | BatchRow[] | null
    );
    if (!rowProduct || rowProduct.id === product.id) continue;
    if (!isSameProductName(rowProduct.name, product.name)) continue;
    if (isSameProductCode(rowProduct.product_code, product.product_code)) continue;

    const conflictKey = rowProduct.product_code;
    if (conflicts.has(conflictKey)) continue;

    conflicts.set(conflictKey, {
      productCode: rowProduct.product_code,
      size: rowProduct.size?.trim() || null,
      batchCode: batch?.batch_code ?? null,
      quality: rowProduct.quality?.trim() || null,
    });
  }

  if (conflicts.size === 0) return undefined;

  return buildSkuMixWarning({
    productName: product.name,
    incomingProductCode: product.product_code,
    incomingSize: product.size,
    incomingBatchCode: incomingBatchCode,
    incomingQuality: product.quality,
    conflicts: Array.from(conflicts.values()),
  });
}
