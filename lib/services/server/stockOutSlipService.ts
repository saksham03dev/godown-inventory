import { createServiceClient } from "@/lib/supabase/service";
import { processUnitStockTransactionServer } from "@/lib/services/server/stockMutationService";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import type {
  MutationResult,
  StockOutSlip,
  StockOutSlipChannel,
  StockOutSlipConfirmItem,
  StockOutSlipWithDetails,
} from "@/lib/types/database";

export interface SlipUnitQtyEdit {
  id: string;
  bagsMoved: number;
}

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

type ProcessedSlipUnit = {
  barcode: string;
  stockUnitId: string;
  productId: string;
  unitNumber: number;
  bagsMoved: number;
  logId: string | null;
};

type ConfirmServiceClient = ReturnType<typeof createServiceClient>;

async function stampStockOutMeta(
  supabase: ConfirmServiceClient,
  input: {
    stockUnitId: string;
    saleChannel: StockOutSlipChannel;
    billerName: string | null;
    billNo: string | null;
  }
): Promise<string | null> {
  const { data: logRow } = await supabase
    .from("inventory_logs")
    .select("id")
    .eq("stock_unit_id", input.stockUnitId)
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

  if (input.billerName || input.billNo) {
    await supabase
      .from("stock_units")
      .update({
        sold_to_customer_name: input.billerName,
        sold_bill_number: input.billNo,
        sold_at: new Date().toISOString(),
      })
      .eq("id", input.stockUnitId);
  }

  return logRow?.id ?? null;
}

async function attachProcessedUnitToSlip(
  supabase: ConfirmServiceClient,
  slipId: string,
  row: ProcessedSlipUnit
): Promise<MutationResult> {
  const { data: existingLine, error: lineLookupError } = await supabase
    .from("stock_out_slip_lines")
    .select("id, bag_count, bale_count")
    .eq("slip_id", slipId)
    .eq("product_id", row.productId)
    .maybeSingle();
  if (lineLookupError) {
    return { success: false, message: lineLookupError.message };
  }

  if (existingLine) {
    const { error: lineUpdateError } = await supabase
      .from("stock_out_slip_lines")
      .update({
        bag_count: existingLine.bag_count + row.bagsMoved,
        bale_count: existingLine.bale_count + 1,
      })
      .eq("id", existingLine.id);
    if (lineUpdateError) {
      return { success: false, message: lineUpdateError.message };
    }
  } else {
    const { error: lineInsertError } = await supabase.from("stock_out_slip_lines").insert({
      slip_id: slipId,
      product_id: row.productId,
      bag_count: row.bagsMoved,
      bale_count: 1,
    });
    if (lineInsertError) {
      return { success: false, message: lineInsertError.message };
    }
  }

  const { error: unitError } = await supabase.from("stock_out_slip_units").insert({
    slip_id: slipId,
    stock_unit_id: row.stockUnitId,
    product_id: row.productId,
    unit_number: row.unitNumber,
    bags_moved: row.bagsMoved,
  });
  if (unitError) {
    if (unitError.code === "23505") {
      return { success: true, message: "Already on slip." };
    }
    return { success: false, message: unitError.message };
  }

  if (row.logId) {
    await supabase
      .from("inventory_logs")
      .update({ stock_out_slip_id: slipId })
      .eq("id", row.logId);
  } else {
    await supabase
      .from("inventory_logs")
      .update({ stock_out_slip_id: slipId })
      .eq("transaction_type", "STOCK_OUT")
      .eq("stock_unit_id", row.stockUnitId)
      .is("stock_out_slip_id", null);
  }

  return { success: true, message: "Attached." };
}

async function findUnitOnAnySlip(
  supabase: ConfirmServiceClient,
  stockUnitId: string
): Promise<{ id: string; slip_id: string } | null> {
  const { data } = await supabase
    .from("stock_out_slip_units")
    .select("id, slip_id")
    .eq("stock_unit_id", stockUnitId)
    .maybeSingle();
  return data ?? null;
}

/** Recover a bale that already went out (timeout) but never landed on a slip. */
async function recoverOrphanStockOut(
  supabase: ConfirmServiceClient,
  barcode: string,
  bagsQty: number
): Promise<
  | { kind: "orphan"; row: ProcessedSlipUnit }
  | { kind: "already_on_slip"; slipId: string }
  | { kind: "none" }
> {
  const { data: unit } = await supabase
    .from("stock_units")
    .select("id, product_id, unit_number, remaining_bags, status, unit_barcode")
    .eq("unit_barcode", barcode)
    .maybeSingle();

  if (!unit || unit.status !== "STOCKED_OUT") {
    return { kind: "none" };
  }

  const existing = await findUnitOnAnySlip(supabase, unit.id);
  if (existing) {
    return { kind: "already_on_slip", slipId: existing.slip_id };
  }

  const { data: logRow } = await supabase
    .from("inventory_logs")
    .select("id, quantity")
    .eq("stock_unit_id", unit.id)
    .eq("transaction_type", "STOCK_OUT")
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    kind: "orphan",
    row: {
      barcode,
      stockUnitId: unit.id,
      productId: unit.product_id,
      unitNumber: unit.unit_number,
      bagsMoved: Math.round(Number(logRow?.quantity ?? bagsQty)),
      logId: logRow?.id ?? null,
    },
  };
}

export async function confirmStockOutSlipServer(input: {
  billerName?: string | null;
  billNo?: string | null;
  saleChannel: StockOutSlipChannel;
  items: StockOutSlipConfirmItem[];
  createdBy: string;
  createdByLabel: string;
  existingSlipId?: string | null;
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

  const processed: ProcessedSlipUnit[] = [];
  let slipId = nullIfEmpty(input.existingSlipId);

  if (slipId) {
    const existingSlip = await fetchStockOutSlipByIdServer(slipId);
    if (!existingSlip) {
      slipId = null;
    } else if (existingSlip.sale_channel !== input.saleChannel) {
      return { success: false, message: "That slip does not match this sale mode." };
    }
  }

  const failWithProgress = async (message: string): Promise<MutationResult<StockOutSlipWithDetails>> => {
    const detail = slipId ? await fetchStockOutSlipByIdServer(slipId) : null;
    return {
      success: false,
      message,
      data: detail ?? undefined,
      processedBarcodes: processed.map((row) => row.barcode),
    };
  };

  const createSlipIfNeeded = async (): Promise<MutationResult<{ id: string }>> => {
    if (slipId) return { success: true, message: "Slip ready.", data: { id: slipId } };
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
      .select("id")
      .single();
    if (slipError || !slip) {
      return {
        success: false,
        message: slipError?.message ?? "Could not create the stock-out slip.",
      };
    }
    slipId = slip.id;
    return { success: true, message: "Slip created.", data: { id: slip.id } };
  };

  for (const item of normalized) {
    const result = await processUnitStockTransactionServer({
      barcodeId: item.barcode,
      godownId: "",
      transactionType: "STOCK_OUT",
      handledBy: input.createdByLabel,
      bagsQty: item.bagsQty,
    });

    let row: ProcessedSlipUnit | null = null;

    if (result.success && result.stockUnit && result.product) {
      const stockUnitId = result.stockUnit.id;
      const bagsMoved = Math.round(result.bagsMoved ?? item.bagsQty);
      const logId = await stampStockOutMeta(supabase, {
        stockUnitId,
        saleChannel: input.saleChannel,
        billerName,
        billNo,
      });
      row = {
        barcode: item.barcode,
        stockUnitId,
        productId: result.product.id,
        unitNumber: result.stockUnit.unit_number,
        bagsMoved,
        logId,
      };
    } else {
      const recovered = await recoverOrphanStockOut(supabase, item.barcode, item.bagsQty);
      if (recovered.kind === "already_on_slip") {
        // Same slip or a prior chunk: skip so the rest of the list can still confirm.
        processed.push({
          barcode: item.barcode,
          stockUnitId: "",
          productId: "",
          unitNumber: 0,
          bagsMoved: item.bagsQty,
          logId: null,
        });
        if (!slipId) slipId = recovered.slipId;
        continue;
      }
      if (recovered.kind === "orphan") {
        row = recovered.row;
        await stampStockOutMeta(supabase, {
          stockUnitId: row.stockUnitId,
          saleChannel: input.saleChannel,
          billerName,
          billNo,
        });
      } else {
        return failWithProgress(
          `${result.message || `Could not stock out ${item.barcode}.`} ${processed.length} bale(s) already registered on the slip. The rest were not registered.`
        );
      }
    }

    const slipResult = await createSlipIfNeeded();
    if (!slipResult.success || !slipResult.data || !slipId || !row) {
      return failWithProgress(slipResult.message || "Could not create the stock-out slip.");
    }

    const attached = await attachProcessedUnitToSlip(supabase, slipId, row);
    if (!attached.success) {
      return failWithProgress(
        attached.message ||
          `Bale ${item.barcode} went out but could not be attached to the slip. Check Stock Out Slips.`
      );
    }
    processed.push(row);
  }

  const detail = slipId ? await fetchStockOutSlipByIdServer(slipId) : null;
  if (!detail) {
    return failWithProgress(
      "Bales were stocked out but the slip could not be reloaded. Open Stock Out Slips."
    );
  }

  return {
    success: true,
    message: `Stock out slip confirmed · ${detail.total_bales} label(s) on slip.`,
    data: detail,
    processedBarcodes: processed.map((row) => row.barcode),
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
  input: {
    billerName?: string | null;
    billNo?: string | null;
    units?: SlipUnitQtyEdit[];
  }
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

  if (input.units && input.units.length > 0) {
    const qtyResult = await applySlipUnitQtyEdits(supabase, id, input.units);
    if (!qtyResult.success) {
      return { success: false, message: qtyResult.message };
    }
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
      await supabase
        .from("stock_units")
        .update(unitPatch)
        .in("id", unitIds)
        .eq("status", "STOCKED_OUT");
    }
  }

  const detail = await fetchStockOutSlipByIdServer(id);
  return {
    success: true,
    message: "Slip updated.",
    data: detail ?? undefined,
  };
}

async function applySlipUnitQtyEdits(
  supabase: ReturnType<typeof createServiceClient>,
  slipId: string,
  edits: SlipUnitQtyEdit[]
): Promise<{ success: boolean; message: string }> {
  const seen = new Set<string>();
  const normalized: SlipUnitQtyEdit[] = [];
  for (const edit of edits) {
    const slipUnitId = String(edit.id ?? "").trim();
    const bagsMoved = Math.floor(Number(edit.bagsMoved));
    if (!slipUnitId) {
      return { success: false, message: "Each qty edit needs a slip unit id." };
    }
    if (seen.has(slipUnitId)) {
      return { success: false, message: "Duplicate bale qty edit." };
    }
    if (!Number.isFinite(bagsMoved) || bagsMoved < 1 || bagsMoved > BAGS_PER_BALE) {
      return {
        success: false,
        message: `Bag qty must be between 1 and ${BAGS_PER_BALE}.`,
      };
    }
    seen.add(slipUnitId);
    normalized.push({ id: slipUnitId, bagsMoved });
  }

  const productIds = new Set<string>();

  for (const edit of normalized) {
    const { data: slipUnit, error: slipUnitErr } = await supabase
      .from("stock_out_slip_units")
      .select("id, slip_id, stock_unit_id, product_id, bags_moved")
      .eq("id", edit.id)
      .eq("slip_id", slipId)
      .maybeSingle();

    if (slipUnitErr) return { success: false, message: slipUnitErr.message };
    if (!slipUnit) {
      return { success: false, message: "Bale on this slip was not found." };
    }

    const oldMoved = Math.round(Number(slipUnit.bags_moved));
    if (oldMoved === edit.bagsMoved) continue;

    const { data: unit, error: unitErr } = await supabase
      .from("stock_units")
      .select(
        "id, remaining_bags, status, bill_id, opened_at, stocked_out_at, product_id"
      )
      .eq("id", slipUnit.stock_unit_id)
      .maybeSingle();

    if (unitErr) return { success: false, message: unitErr.message };
    if (!unit) {
      return { success: false, message: "Stock unit for this bale was not found." };
    }
    if (unit.bill_id) {
      return {
        success: false,
        message:
          "Cannot change qty on a bale that is already attached to a bill. Remove it from the bill first.",
      };
    }

    const remaining = Math.round(Number(unit.remaining_bags ?? 0));
    const maxMoved = Math.min(BAGS_PER_BALE, oldMoved + remaining);
    if (edit.bagsMoved > maxMoved) {
      return {
        success: false,
        message: `Bale # qty cannot exceed ${maxMoved} bags (only ${remaining} left in warehouse).`,
      };
    }

    const newRemaining = remaining + (oldMoved - edit.bagsMoved);
    if (newRemaining < 0 || newRemaining > BAGS_PER_BALE) {
      return { success: false, message: "Corrected qty would put this bale out of range." };
    }

    const now = new Date().toISOString();
    const unitPatch: Record<string, unknown> = {
      remaining_bags: newRemaining,
      status: newRemaining === 0 ? "STOCKED_OUT" : "STOCKED_IN",
      stocked_out_at: newRemaining === 0 ? (unit.stocked_out_at ?? now) : null,
      opened_at:
        newRemaining === 0 || newRemaining === BAGS_PER_BALE
          ? newRemaining === BAGS_PER_BALE
            ? null
            : unit.opened_at
          : unit.opened_at ?? now,
    };
    if (newRemaining > 0) {
      unitPatch.sold_to_customer_name = null;
      unitPatch.sold_bill_number = null;
      unitPatch.sold_at = null;
    }

    const { error: unitUpdErr } = await supabase
      .from("stock_units")
      .update(unitPatch)
      .eq("id", unit.id);
    if (unitUpdErr) return { success: false, message: unitUpdErr.message };

    const { error: slipUnitUpdErr } = await supabase
      .from("stock_out_slip_units")
      .update({ bags_moved: edit.bagsMoved })
      .eq("id", slipUnit.id);
    if (slipUnitUpdErr) return { success: false, message: slipUnitUpdErr.message };

    await supabase
      .from("inventory_logs")
      .update({ quantity: edit.bagsMoved })
      .eq("stock_out_slip_id", slipId)
      .eq("stock_unit_id", unit.id)
      .eq("transaction_type", "STOCK_OUT");

    productIds.add(String(slipUnit.product_id));
  }

  if (productIds.size > 0) {
    const { data: slipUnits, error: listErr } = await supabase
      .from("stock_out_slip_units")
      .select("product_id, bags_moved")
      .eq("slip_id", slipId);
    if (listErr) return { success: false, message: listErr.message };

    const byProduct = new Map<string, { bag_count: number; bale_count: number }>();
    for (const row of slipUnits ?? []) {
      const pid = String(row.product_id);
      const existing = byProduct.get(pid) ?? { bag_count: 0, bale_count: 0 };
      existing.bag_count += Math.round(Number(row.bags_moved));
      existing.bale_count += 1;
      byProduct.set(pid, existing);
    }

    for (const [productId, totals] of byProduct) {
      if (!productIds.has(productId)) continue;
      const { error: lineErr } = await supabase
        .from("stock_out_slip_lines")
        .update({
          bag_count: totals.bag_count,
          bale_count: totals.bale_count,
        })
        .eq("slip_id", slipId)
        .eq("product_id", productId);
      if (lineErr) return { success: false, message: lineErr.message };
    }

    for (const productId of productIds) {
      await supabase.rpc("sync_product_total_stock", {
        p_product_id: productId,
      });
    }
  }

  return { success: true, message: "Quantities updated." };
}
