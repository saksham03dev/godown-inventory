import type { GodownStockItem, GodownStockNameGroup } from "@/lib/types/database";

/** Normalize product name for grouping (trim, collapse spaces, case-insensitive). */
export function normalizeProductNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
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
