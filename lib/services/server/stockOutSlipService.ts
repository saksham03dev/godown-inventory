import { createServiceClient } from "@/lib/supabase/service";
import { processUnitStockTransactionServer } from "@/lib/services/server/stockMutationService";
import type {
  MutationResult,
  StockOutSlip,
  StockOutSlipChannel,
  StockOutSlipConfirmItem,
  StockOutSlipWithDetails,
} from "@/lib/types/database";

function nullIfEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function mapSlipWithDetails(row: Record<string, unknown>): StockOutSlipWithDetails {
  const lines = (row.stock_out_slip_lines as StockOutSlipWithDetails["stock_out_slip_lines"]) ?? [];
  const units = (row.stock_out_slip_units as StockOutSlipWithDetails["stock_out_slip_units"]) ?? [];
  const total_bags = lines.reduce((sum, l) => sum + Number(l.bag_count), 0);
  const total_bales = lines.reduce((sum, l) => sum + Number(l.bale_count), 0);
  return {
    ...(row as unknown as StockOutSlip),
    stock_out_slip_lines: lines,
    stock_out_slip_units: units,
    total_bags,
    total_bales,
  };
}

export async function confirmStockOutSlipServer(input: {
  billerName?: string | null;
  billNo?: string | null;
  saleChannel: StockOutSlipChannel;
  items: StockOutSlipConfirmItem[];
  createdBy: string;
  createdByLabel: string;
}): Promise<MutationResult<StockOutSlipWithDetails>> {
  if (input.saleChannel !== "WHOLESALE" && input.saleChannel !== "RETAIL") {
    return { success: false, message: "Invalid sale channel." };
  }
  if (!input.items.length) {
    return { success: false, message: "Scan at least one bale before confirming." };
  }

  const seen = new Set<string>();
  const normalized: StockOutSlipConfirmItem[] = [];
  for (const item of input.items) {
    const barcode = String(item.barcode ?? "").trim();
    const bagsQty = Math.floor(Number(item.bagsQty));
    if (!barcode) {
      return { success: false, message: "Each line needs a barcode." };
    }
    if (seen.has(barcode)) {
      return {
        success: false,
        message: `Duplicate barcode in session: ${barcode}`,
      };
    }
    if (!Number.isFinite(bagsQty) || bagsQty < 1 || bagsQty > 1000) {
      return {
        success: false,
        message: `Invalid bag qty for ${barcode} (1–1000).`,
      };
    }
    seen.add(barcode);
    normalized.push({ barcode, bagsQty });
  }

  const supabase = createServiceClient({ requireServiceRole: true });
  const billerName = nullIfEmpty(input.billerName);
  const billNo = nullIfEmpty(input.billNo);

  const processed: Array<{
    barcode: string;
    stockUnitId: string;
    productId: string;
    unitNumber: number;
    bagsMoved: number;
    logId: string | null;
  }> = [];

  for (const item of normalized) {
    const result = await processUnitStockTransactionServer({
      barcodeId: item.barcode,
      godownId: "",
      transactionType: "STOCK_OUT",
      handledBy: input.createdByLabel,
      bagsQty: item.bagsQty,
    });

    if (!result.success || !result.stockUnit || !result.product) {
      return {
        success: false,
        message:
          processed.length > 0
            ? `${result.message} (${processed.length} unit(s) already stocked out — fix remaining and confirm a new slip.)`
            : result.message || `Failed to stock out ${item.barcode}.`,
      };
    }

    const stockUnitId = result.stockUnit.id;
    const bagsMoved = Math.round(result.bagsMoved ?? item.bagsQty);

    // Stamp newest STOCK_OUT log for this unit with sale channel; slip id later
    const { data: logRow } = await supabase
      .from("inventory_logs")
      .select("id")
      .eq("stock_unit_id", stockUnitId)
      .eq("transaction_type", "STOCK_OUT")
      .is("stock_out_slip_id", null)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logRow?.id) {
      await supabase
        .from("inventory_logs")
        .update({ sale_channel: input.saleChannel })
        .eq("id", logRow.id);
    }

    if (billerName || billNo) {
      await supabase
        .from("stock_units")
        .update({
          sold_to_customer_name: billerName,
          sold_bill_number: billNo,
          sold_at: new Date().toISOString(),
        })
        .eq("id", stockUnitId);
    }

    processed.push({
      barcode: item.barcode,
      stockUnitId,
      productId: result.product.id,
      unitNumber: result.stockUnit.unit_number,
      bagsMoved,
      logId: logRow?.id ?? null,
    });
  }

  const { data: slip, error: slipError } = await supabase
    .from("stock_out_slips")
    .insert({
      biller_name: billerName,
      bill_no: billNo,
      sale_channel: input.saleChannel,
      status: "CONFIRMED",
      created_by: input.createdBy,
      created_by_label: input.createdByLabel,
      confirmed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (slipError || !slip) {
    return {
      success: false,
      message:
        slipError?.message ??
        "Stock out succeeded but slip could not be saved. Contact admin.",
    };
  }

  const lineMap = new Map<
    string,
    { product_id: string; bag_count: number; bale_count: number }
  >();
  for (const row of processed) {
    const existing = lineMap.get(row.productId);
    if (existing) {
      existing.bag_count += row.bagsMoved;
      existing.bale_count += 1;
    } else {
      lineMap.set(row.productId, {
        product_id: row.productId,
        bag_count: row.bagsMoved,
        bale_count: 1,
      });
    }
  }

  const { error: linesError } = await supabase.from("stock_out_slip_lines").insert(
    Array.from(lineMap.values()).map((line) => ({
      slip_id: slip.id,
      product_id: line.product_id,
      bag_count: line.bag_count,
      bale_count: line.bale_count,
    }))
  );
  if (linesError) {
    return { success: false, message: linesError.message };
  }

  const { error: unitsError } = await supabase.from("stock_out_slip_units").insert(
    processed.map((row) => ({
      slip_id: slip.id,
      stock_unit_id: row.stockUnitId,
      product_id: row.productId,
      unit_number: row.unitNumber,
      bags_moved: row.bagsMoved,
    }))
  );
  if (unitsError) {
    return { success: false, message: unitsError.message };
  }

  const logIds = processed.map((p) => p.logId).filter(Boolean) as string[];
  if (logIds.length > 0) {
    await supabase
      .from("inventory_logs")
      .update({ stock_out_slip_id: slip.id })
      .in("id", logIds);
  }

  const detail = await fetchStockOutSlipByIdServer(slip.id);
  return {
    success: true,
    message: `Stock out slip confirmed · ${processed.length} label(s).`,
    data: detail ?? undefined,
  };
}

export async function fetchStockOutSlipsServer(
  limit = 50
): Promise<StockOutSlipWithDetails[]> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await supabase
    .from("stock_out_slips")
    .select(
      `
      *,
      stock_out_slip_lines (
        *,
        products ( id, name, product_code, size )
      ),
      stock_out_slip_units ( * )
    `
    )
    .order("confirmed_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSlipWithDetails(row as Record<string, unknown>));
}

export async function fetchStockOutSlipByIdServer(
  id: string
): Promise<StockOutSlipWithDetails | null> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const { data, error } = await supabase
    .from("stock_out_slips")
    .select(
      `
      *,
      stock_out_slip_lines (
        *,
        products ( id, name, product_code, size )
      ),
      stock_out_slip_units ( * )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapSlipWithDetails(data as Record<string, unknown>);
}

export async function updateStockOutSlipServer(
  id: string,
  input: { billerName?: string | null; billNo?: string | null }
): Promise<MutationResult<StockOutSlipWithDetails>> {
  const supabase = createServiceClient({ requireServiceRole: true });
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.billerName !== undefined) {
    patch.biller_name = nullIfEmpty(input.billerName);
  }
  if (input.billNo !== undefined) {
    patch.bill_no = nullIfEmpty(input.billNo);
  }

  const { error } = await supabase.from("stock_out_slips").update(patch).eq("id", id);
  if (error) {
    return { success: false, message: error.message };
  }

  // Keep sold-to stamps in sync when metadata changes
  const billerName =
    input.billerName !== undefined ? nullIfEmpty(input.billerName) : undefined;
  const billNo = input.billNo !== undefined ? nullIfEmpty(input.billNo) : undefined;

  if (billerName !== undefined || billNo !== undefined) {
    const { data: unitRows } = await supabase
      .from("stock_out_slip_units")
      .select("stock_unit_id")
      .eq("slip_id", id);
    const unitIds = (unitRows ?? []).map((u) => u.stock_unit_id);
    if (unitIds.length > 0) {
      const unitPatch: Record<string, unknown> = {};
      if (billerName !== undefined) unitPatch.sold_to_customer_name = billerName;
      if (billNo !== undefined) unitPatch.sold_bill_number = billNo;
      await supabase.from("stock_units").update(unitPatch).in("id", unitIds);
    }
  }

  const detail = await fetchStockOutSlipByIdServer(id);
  return {
    success: true,
    message: "Slip updated.",
    data: detail ?? undefined,
  };
}
