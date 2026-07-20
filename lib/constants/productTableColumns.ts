export type ProductTableColumnId =
  | "name"
  | "product_code"
  | "barcode_id"
  | "retail_selling_price"
  | "size"
  | "total_stock"
  | "notes";

export const PRODUCT_TABLE_COLUMNS: {
  id: ProductTableColumnId;
  label: string;
}[] = [
  { id: "name", label: "Name" },
  { id: "product_code", label: "Backend Code" },
  { id: "barcode_id", label: "Barcode" },
  { id: "retail_selling_price", label: "Price / bag" },
  { id: "size", label: "Size" },
  { id: "total_stock", label: "Stock (bags)" },
  { id: "notes", label: "Notes" },
];

export const DEFAULT_VISIBLE_PRODUCT_COLUMNS: ProductTableColumnId[] =
  PRODUCT_TABLE_COLUMNS.map((c) => c.id);

export const PRODUCT_TABLE_COLUMNS_STORAGE_KEY = "products-table-columns";

export function parseStoredProductColumns(raw: string | null): ProductTableColumnId[] {
  if (!raw) return DEFAULT_VISIBLE_PRODUCT_COLUMNS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_PRODUCT_COLUMNS;
    const valid = new Set(PRODUCT_TABLE_COLUMNS.map((c) => c.id));
    const filtered = parsed.filter(
      (id): id is ProductTableColumnId =>
        typeof id === "string" && valid.has(id as ProductTableColumnId)
    );
    return filtered.length > 0 ? filtered : DEFAULT_VISIBLE_PRODUCT_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_PRODUCT_COLUMNS;
  }
}
