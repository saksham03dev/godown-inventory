import { normalizeProductNameKey } from "@/lib/utils/inventoryGrouping";

export function normalizeQualityKey(quality: string | null | undefined): string {
  const trimmed = quality?.trim().toLowerCase() ?? "";
  return trimmed || "__unset__";
}

export interface QualityMixConflict {
  quality: string | null;
  productCode: string;
  size: string | null;
  batchCode: string | null;
}

export interface QualityMixWarning {
  message: string;
  incomingQuality: string | null;
  existingQualities: QualityMixConflict[];
}

function formatQualityLabel(quality: string | null | undefined): string {
  const trimmed = quality?.trim();
  return trimmed || "Unspecified";
}

function formatConflictSummary(conflicts: QualityMixConflict[]): string {
  return conflicts
    .map((entry) => {
      const parts = [formatQualityLabel(entry.quality)];
      if (entry.size) parts.push(`size ${entry.size}`);
      if (entry.batchCode) parts.push(`batch ${entry.batchCode}`);
      return parts.join(", ");
    })
    .join("; ");
}

export function buildQualityMixWarning(input: {
  productName: string;
  incomingQuality: string | null | undefined;
  incomingSize?: string | null;
  incomingBatchCode?: string | null;
  conflicts: QualityMixConflict[];
}): QualityMixWarning {
  const incomingParts = [
    `Quality ${formatQualityLabel(input.incomingQuality)}`,
    input.incomingSize?.trim() ? `size ${input.incomingSize.trim()}` : null,
    input.incomingBatchCode ? `batch ${input.incomingBatchCode}` : null,
  ].filter(Boolean);

  return {
    message: `Mixed quality in godown: "${input.productName}" stocked in as ${incomingParts.join(", ")}, but this godown already has ${formatConflictSummary(input.conflicts)}. Stock-in was allowed — verify before billing.`,
    incomingQuality: input.incomingQuality?.trim() || null,
    existingQualities: input.conflicts,
  };
}

export function isSameProductName(a: string, b: string): boolean {
  return normalizeProductNameKey(a) === normalizeProductNameKey(b);
}

export function isDifferentQuality(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return normalizeQualityKey(a) !== normalizeQualityKey(b);
}
