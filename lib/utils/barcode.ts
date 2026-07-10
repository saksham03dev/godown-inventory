/**
 * Product catalog barcodes use prefix 89.
 * Unit-level barcodes use prefix 87.
 */

export function generateBarcodeFromProductCode(productCode: string): string {
  const normalized = productCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (!normalized) {
    throw new Error("Product code must contain at least one letter or number.");
  }

  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }

  const digits = (Math.abs(hash) % 1_000_000_000_0).toString().padStart(10, "0");
  return `89${digits}`;
}

export function normalizeProductCode(productCode: string): string {
  return productCode.trim().toUpperCase();
}

/**
 * Unit-level barcodes use prefix 87 (product catalog barcodes use 89).
 * Each unit barcode is unique per batch + unit number.
 */
export function generateBatchCode(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `B${date}${rand}`;
}

export function generateUnitBarcode(
  batchCode: string,
  unitNumber: number
): string {
  const input = `${batchCode}:${unitNumber}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  const digits = (Math.abs(hash) % 1_000_000_000_0)
    .toString()
    .padStart(10, "0");
  return `87${digits}`;
}

export function generateBillNumber(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `INV-${date}-${rand}`;
}

export function isUnitBarcode(barcode: string): boolean {
  return barcode.trim().startsWith("87");
}
