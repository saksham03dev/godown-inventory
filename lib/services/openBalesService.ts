import { getSupabaseClient } from "@/lib/supabase/client";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type { StockUnit } from "@/lib/types/database";

/** Bales partially sold — STOCKED_IN with remaining_bags < 1000. */
export async function fetchOpenBales(
  godownId?: string | null
): Promise<StockUnit[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("stock_units")
    .select(
      `
      *,
      products ( id, name, product_code, size, retail_selling_price ),
      stock_batches ( id, batch_code, source_name, quantity ),
      godowns!godown_id ( id, location_name )
    `
    )
    .eq("status", "STOCKED_IN")
    .gt("remaining_bags", 0)
    .lt("remaining_bags", BAGS_PER_BALE)
    .order("remaining_bags", { ascending: true });

  if (godownId) {
    query = query.eq("godown_id", godownId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message.includes("remaining_bags")) {
      throw new Error(
        "Bag inventory not migrated yet. Run `npm run db:push` to apply migration 011."
      );
    }
    throw new Error(error.message);
  }

  return (data ?? []) as StockUnit[];
}
