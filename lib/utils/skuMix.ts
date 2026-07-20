import { normalizeProductNameKey } from "@/lib/utils/inventoryGrouping";

export function normalizeProductCodeKey(code: string): string {
  return code.trim().toUpperCase();
}

export interface SkuMixConflict {
  productCode: string;
  size: string | null;
  batchCode: string | null;
  quality: string | null;
}

export interface SkuMixWarning {
  message: string;
  incomingProductCode: string;
  conflicts: SkuMixConflict[];
}

function formatSkuLabel(input: {
  productName: string;
  productCode: string;
  size?: string | null;
  batchCode?: string | null;
  quality?: string | null;
}): string {
  const parts = [
    `"${input.productName}"`,
    `code ${input.productCode}`,
    input.size?.trim() ? `size ${input.size.trim()}` : null,
    input.batchCode ? `batch ${input.batchCode}` : null,
    input.quality?.trim() ? `quality ${input.quality.trim()}` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatConflictSummary(conflicts: SkuMixConflict[], productName: string): string {
  return conflicts
    .map((entry) =>
      formatSkuLabel({
        productName,
        productCode: entry.productCode,
        size: entry.size,
        batchCode: entry.batchCode,
        quality: entry.quality,
      })
    )
    .join("; ");
}

export function buildSkuMixWarning(input: {
  productName: string;
  incomingProductCode: string;
  incomingSize?: string | null;
  incomingBatchCode?: string | null;
  incomingQuality?: string | null;
  conflicts: SkuMixConflict[];
}): SkuMixWarning {
  return {
    message: `Mixed SKU in godown: stocked in ${formatSkuLabel({
      productName: input.productName,
      productCode: input.incomingProductCode,
      size: input.incomingSize,
      batchCode: input.incomingBatchCode,
      quality: input.incomingQuality,
    })}, but this godown already has ${formatConflictSummary(input.conflicts, input.productName)}. Stock-in was allowed — verify labels before billing.`,
    incomingProductCode: input.incomingProductCode,
    conflicts: input.conflicts,
  };
}

export function isSameProductName(a: string, b: string): boolean {
  return normalizeProductNameKey(a) === normalizeProductNameKey(b);
}

export function isSameProductCode(a: string, b: string): boolean {
  return normalizeProductCodeKey(a) === normalizeProductCodeKey(b);
}
