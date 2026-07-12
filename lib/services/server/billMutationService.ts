import { createServiceClient } from "@/lib/supabase/service";
import { generateBillNumber } from "@/lib/utils/barcode";
import { fetchBillWithItems } from "@/lib/services/billService.server";
import type {
  Bill,
  BillInput,
  BillItem,
  BillItemInput,
  BillWithItems,
  MutationResult,
} from "@/lib/types/database";
import { billNeedsSoldToCustomer } from "@/lib/utils/billItem";

function db() {
  return createServiceClient({ requireServiceRole: true });
}

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

export async function createBillServer(
  input: BillInput = { customer_name: "Walk-in Customer" }
): Promise<MutationResult<Bill>> {
  try {
    const { data, error } = await db()
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

export async function updateBillServer(
  billId: string,
  input: BillInput
): Promise<MutationResult<BillWithItems>> {
  try {
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Cannot edit a finalized bill." };
    }

    const tax_percent = input.tax_percent ?? bill.tax_percent;
    const discount = input.discount ?? bill.discount;
    const totals = calcTotals(bill.bill_items, tax_percent, discount);

    const { error } = await db()
      .from("bills")
      .update({
        customer_name: input.customer_name.trim() || bill.customer_name,
        customer_phone:
          input.customer_phone !== undefined && input.customer_phone !== null
            ? input.customer_phone.trim() || null
            : bill.customer_phone,
        customer_address:
          input.customer_address !== undefined &&
          input.customer_address !== null
            ? input.customer_address.trim() || null
            : bill.customer_address,
        notes:
          input.notes !== undefined && input.notes !== null
            ? input.notes.trim() || null
            : bill.notes,
        tax_percent,
        discount,
        ...totals,
      })
      .eq("id", billId);

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

export async function updateBillItemServer(
  itemId: string,
  input: BillItemInput
): Promise<MutationResult<BillWithItems>> {
  try {
    const supabase = db();
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

export async function finalizeBillServer(
  billId: string
): Promise<MutationResult<BillWithItems>> {
  try {
    const bill = await fetchBillWithItems(billId);
    if (!bill) return { success: false, message: "Bill not found." };
    if (bill.status === "FINALIZED") {
      return { success: false, message: "Bill is already finalized." };
    }
    if (bill.bill_items.length === 0) {
      return {
        success: false,
        message: "Add at least one item before finalizing.",
      };
    }

    const customerName = bill.customer_name?.trim() ?? "";
    if (billNeedsSoldToCustomer(bill.bill_items) && !customerName) {
      return {
        success: false,
        message:
          "Enter customer name before finalizing (required for complete sealed bale sales).",
      };
    }

    const supabase = db();
    const { data, error } = await supabase.rpc("finalize_bill_stamp_sold_to", {
      p_bill_id: billId,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const row = data as {
      success?: boolean;
      message?: string;
      stampedUnits?: number;
    } | null;

    if (!row?.success) {
      return {
        success: false,
        message: row?.message ?? "Failed to finalize bill.",
      };
    }

    const final = await fetchBillWithItems(billId);
    const stamped = row.stampedUnits ?? 0;
    return {
      success: true,
      message:
        stamped > 0
          ? `Bill ${bill.bill_number} finalized. Sold-to stamped on ${stamped} bale(s).`
          : row.message ?? `Bill ${bill.bill_number} finalized.`,
      data: final ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to finalize bill.",
    };
  }
}
