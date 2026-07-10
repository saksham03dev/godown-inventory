import { getSupabaseClient } from "@/lib/supabase/client";
import { generateBillNumber } from "@/lib/utils/barcode";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import type {
  Bill,
  BillInput,
  BillItem,
  BillItemInput,
  BillWithItems,
  MutationResult,
  Product,
} from "@/lib/types/database";

function calcTotals(
  items: Pick<BillItem, "line_total">[],
  taxPercent: number,
  discount: number
) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.line_total), 0);
  const tax_amount = (subtotal * taxPercent) / 100;
  const total = Math.max(0, subtotal + tax_amount - discount);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: Number(tax_amount.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

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
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("bills")
      .insert({
        bill_number: generateBillNumber(),
        customer_name: input.customer_name.trim() || "Walk-in Customer",
        customer_phone: input.customer_phone?.trim() || null,
        customer_address: input.customer_address?.trim() || null,
        notes: input.notes?.trim() || null,
        tax_percent: input.tax_percent ?? 0,
        discount: input.discount ?? 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      success: true,
      message: `Bill ${data.bill_number} created.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to create bill.",
    };
  }
}

export async function updateBill(
  billId: string,
  input: BillInput
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = getSupabaseClient();
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Cannot edit a finalized bill." };
    }

    const tax_percent = input.tax_percent ?? bill.tax_percent;
    const discount = input.discount ?? bill.discount;
    const totals = calcTotals(bill.bill_items, tax_percent, discount);

    const { data, error } = await supabase
      .from("bills")
      .update({
        customer_name: input.customer_name.trim() || bill.customer_name,
        customer_phone: input.customer_phone?.trim() ?? bill.customer_phone,
        customer_address:
          input.customer_address?.trim() ?? bill.customer_address,
        notes: input.notes?.trim() ?? bill.notes,
        tax_percent,
        discount,
        ...totals,
      })
      .eq("id", billId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const refreshed = await fetchBillWithItems(billId);
    return {
      success: true,
      message: "Bill updated.",
      data: refreshed ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update bill.",
    };
  }
}

export async function addUnitToBill(
  billId: string,
  unitBarcode: string,
  unitPrice = 0
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = getSupabaseClient();
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Cannot modify a finalized bill." };
    }

    const unit = await fetchStockUnitByBarcode(unitBarcode.trim());
    if (!unit) {
      return { success: false, message: "Unit barcode not recognized." };
    }
    if (unit.status !== "STOCKED_OUT") {
      return {
        success: false,
        message: "Only stocked-out units can be added to a bill. Scan at Stock Out first.",
      };
    }
    if (unit.bill_id) {
      return {
        success: false,
        message: "This unit is already on another bill.",
      };
    }

    const existing = bill.bill_items.find((i) => i.stock_unit_id === unit.id);
    if (existing) {
      return { success: false, message: "Unit already on this bill." };
    }

    const product = unit.products as
      | (Pick<Product, "id" | "name" | "product_code" | "size"> & {
          retail_selling_price?: number;
        })
      | null
      | undefined;
    const source = unit.stock_batches?.source_name ?? null;
    const resolvedPrice =
      unitPrice > 0
        ? unitPrice
        : Number(product?.retail_selling_price ?? 0);
    const line_total = resolvedPrice;

    const { data: item, error: itemError } = await supabase
      .from("bill_items")
      .insert({
        bill_id: billId,
        stock_unit_id: unit.id,
        product_id: unit.product_id,
        product_name: product?.name ?? "Unknown",
        product_code: product?.product_code ?? "",
        unit_barcode: unit.unit_barcode,
        source_name: source,
        quantity: 1,
        unit_price: resolvedPrice,
        line_total,
      })
      .select()
      .single();

    if (itemError) throw new Error(itemError.message);

    await supabase
      .from("stock_units")
      .update({ bill_id: billId })
      .eq("id", unit.id);

    const updatedItems = [...bill.bill_items, item as BillItem];
    const totals = calcTotals(
      updatedItems,
      bill.tax_percent,
      bill.discount
    );

    await supabase.from("bills").update(totals).eq("id", billId);

    const refreshed = await fetchBillWithItems(billId);
    return {
      success: true,
      message: `Added ${product?.name} (Unit #${unit.unit_number}) to bill.`,
      data: refreshed ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to add item.",
    };
  }
}

export async function updateBillItem(
  itemId: string,
  input: BillItemInput
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = getSupabaseClient();

    const { data: item, error: fetchError } = await supabase
      .from("bill_items")
      .select("*, bills ( * )")
      .eq("id", itemId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    const bill = (item as { bills: Bill }).bills;
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Cannot edit a finalized bill." };
    }

    const quantity = input.quantity ?? item.quantity;
    const unit_price = input.unit_price ?? item.unit_price;
    const line_total = Number((quantity * unit_price).toFixed(2));

    await supabase
      .from("bill_items")
      .update({ quantity, unit_price, line_total })
      .eq("id", itemId);

    const refreshed = await fetchBillWithItems(bill.id);
    if (!refreshed) return { success: false, message: "Bill not found." };

    const totals = calcTotals(
      refreshed.bill_items,
      refreshed.tax_percent,
      refreshed.discount
    );
    await supabase.from("bills").update(totals).eq("id", bill.id);

    const final = await fetchBillWithItems(bill.id);
    return {
      success: true,
      message: "Line item updated.",
      data: final ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update item.",
    };
  }
}

export async function removeBillItem(
  itemId: string
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = getSupabaseClient();

    const { data: item, error: fetchError } = await supabase
      .from("bill_items")
      .select("*, bills ( * )")
      .eq("id", itemId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    const bill = (item as { bills: Bill }).bills;
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Cannot edit a finalized bill." };
    }

    if (item.stock_unit_id) {
      await supabase
        .from("stock_units")
        .update({ bill_id: null })
        .eq("id", item.stock_unit_id);
    }

    await supabase.from("bill_items").delete().eq("id", itemId);

    const refreshed = await fetchBillWithItems(bill.id);
    if (!refreshed) return { success: false, message: "Bill not found." };

    const totals = calcTotals(
      refreshed.bill_items,
      refreshed.tax_percent,
      refreshed.discount
    );
    await supabase.from("bills").update(totals).eq("id", bill.id);

    const final = await fetchBillWithItems(bill.id);
    return {
      success: true,
      message: "Item removed from bill.",
      data: final ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to remove item.",
    };
  }
}

export async function finalizeBill(
  billId: string
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = getSupabaseClient();
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };
    if (bill.bill_items.length === 0) {
      return { success: false, message: "Add at least one item before finalizing." };
    }

    const totals = calcTotals(
      bill.bill_items,
      bill.tax_percent,
      bill.discount
    );

    await supabase
      .from("bills")
      .update({
        ...totals,
        status: "FINALIZED",
        finalized_at: new Date().toISOString(),
      })
      .eq("id", billId);

    const final = await fetchBillWithItems(billId);
    return {
      success: true,
      message: `Bill ${bill.bill_number} finalized.`,
      data: final ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to finalize bill.",
    };
  }
}

export async function deleteBill(billId: string): Promise<MutationResult> {
  try {
    const supabase = getSupabaseClient();
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };

    await supabase
      .from("stock_units")
      .update({ bill_id: null })
      .eq("bill_id", billId);

    await supabase.from("bills").delete().eq("id", billId);

    return {
      success: true,
      message: `Bill ${bill.bill_number} deleted.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete bill.",
    };
  }
}
