import { createServiceClient } from "@/lib/supabase/service";
import type { BillWithItems } from "@/lib/types/database";

export async function fetchBillWithItems(
  billId: string
): Promise<BillWithItems | null> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("bills")
    .select(`*, bill_items ( * )`)
    .eq("id", billId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const bill = data as BillWithItems;
  bill.bill_items = (bill.bill_items ?? []).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return bill;
}
