import { apiMutation } from "@/lib/api/clientMutation";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  Bill,
  BillInput,
  BillItemInput,
  BillWithItems,
  MutationResult,
  StockUnit,
} from "@/lib/types/database";

export async function fetchBills(limit = 20): Promise<Bill[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Stocked-out units not yet linked to any bill (ready for cross-location billing). */
export async function fetchUnbilledStockedOutUnits(
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
      godowns ( id, location_name )
    `
    )
    .eq("status", "STOCKED_OUT")
    .is("bill_id", null)
    .order("stocked_out_at", { ascending: false });

  if (godownId) {
    query = query.eq("godown_id", godownId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StockUnit[];
}

/**
 * Add multiple stocked-out units to a draft bill by barcode (no rescan).
 * Stops on first failure and returns partial progress message.
 */
export async function addUnitsToBill(
  billId: string,
  unitBarcodes: string[],
  unitPrice = 0
): Promise<MutationResult<BillWithItems>> {
  if (unitBarcodes.length === 0) {
    return { success: false, message: "Select at least one bale." };
  }

  let last: MutationResult<BillWithItems> | null = null;
  let added = 0;

  for (const barcode of unitBarcodes) {
    last = await addUnitToBill(billId, barcode, unitPrice);
    if (!last.success) {
      return {
        success: false,
        message:
          added > 0
            ? `Added ${added} bale(s) (${added * BAGS_PER_BALE} bags), then failed: ${last.message}`
            : last.message,
        data: last.data,
      };
    }
    added += 1;
  }

  return {
    success: true,
    message: `Added ${added} bale(s) (${added * BAGS_PER_BALE} bags) to bill.`,
    data: last?.data,
  };
}

/** Create a draft bill and attach the given unbilled units in one step. */
export async function createBillWithUnits(
  unitBarcodes: string[],
  input: BillInput = { customer_name: "Walk-in Customer" }
): Promise<MutationResult<BillWithItems>> {
  const created = await createBill(input);
  if (!created.success || !created.data) {
    return { success: false, message: created.message };
  }

  const added = await addUnitsToBill(created.data.id, unitBarcodes);
  if (!added.success) {
    return {
      success: false,
      message: added.message,
      data: added.data,
    };
  }

  return {
    success: true,
    message: `Bill ${created.data.bill_number} created with ${unitBarcodes.length} bale(s) (${unitBarcodes.length * BAGS_PER_BALE} bags).`,
    data: added.data,
  };
}

export async function fetchBillWithItems(
  billId: string
): Promise<BillWithItems | null> {
  const supabase = getSupabaseClient();
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

export async function createBill(
  input: BillInput = { customer_name: "Walk-in Customer" }
): Promise<MutationResult<Bill>> {
  return apiMutation<Bill>("/api/bills", { body: input });
}

export async function updateBill(
  billId: string,
  input: BillInput
): Promise<MutationResult<BillWithItems>> {
  return apiMutation<BillWithItems>(`/api/bills/${billId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function addUnitToBill(
  billId: string,
  unitBarcode: string,
  unitPrice = 0
): Promise<MutationResult<BillWithItems>> {
  return apiMutation<BillWithItems>("/api/billing/add-unit", {
    body: {
      billId,
      unitBarcode: unitBarcode.trim(),
      unitPrice,
    },
  });
}

export async function updateBillItem(
  itemId: string,
  input: BillItemInput
): Promise<MutationResult<BillWithItems>> {
  return apiMutation<BillWithItems>(`/api/billing/items/${itemId}`, {
    method: "PATCH",
    body: input,
  });
}

export async function removeBillItem(
  itemId: string
): Promise<MutationResult<BillWithItems>> {
  return apiMutation<BillWithItems>("/api/billing/remove-item", {
    body: { itemId },
  });
}

export async function finalizeBill(
  billId: string
): Promise<MutationResult<BillWithItems>> {
  return apiMutation<BillWithItems>(`/api/bills/${billId}/finalize`, {
    method: "POST",
  });
}

export async function deleteBill(billId: string): Promise<MutationResult> {
  return apiMutation("/api/billing/delete-bill", {
    body: { billId },
  });
}
