import type { GodownStockItem, GodownStockNameGroup } from "@/lib/types/database";

/** Normalize product name for grouping (trim, collapse spaces, case-insensitive). */
export function normalizeProductNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Human-readable variant label: backend code, size, quality. */
export function formatVariantLabel(item: GodownStockItem): string {
  const parts = [
    item.product_code,
    item.size?.trim() ? `Size ${item.size.trim()}` : null,
    item.quality?.trim() || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Filter stock items by product name or backend code (case-insensitive). */
export function filterStockItems(
  items: GodownStockItem[],
  query: string
): GodownStockItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.product_name.toLowerCase().includes(q) ||
      item.product_code.toLowerCase().includes(q)
  );
}

export function groupGodownStockByName(
  items: GodownStockItem[]
): GodownStockNameGroup[] {
  const map = new Map<string, GodownStockNameGroup>();

  for (const item of items) {
    const key = normalizeProductNameKey(item.product_name);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        product_name: item.product_name.trim(),
        quantity: 0,
        open_bales: 0,
        variants: [],
      };
      map.set(key, group);
    }
    group.quantity += item.quantity;
    group.open_bales += item.open_bales;
    group.variants.push(item);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      variants: group.variants.sort((a, b) =>
        a.product_code.localeCompare(b.product_code)
      ),
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}
