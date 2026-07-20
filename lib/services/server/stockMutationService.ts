import { createServiceClient } from "@/lib/supabase/service";
import { fetchBillWithItems } from "@/lib/services/billService.server";
import { detectQualityMixAfterStockIn } from "@/lib/services/server/qualityMixService";
import { isProductBarcode } from "@/lib/utils/barcode";
import type {
  MutationResult,
  Product,
  RetailBaleEvent,
  RetailBillLineResult,
  ScanTransactionResult,
  StockUnit,
  TransactionType,
} from "@/lib/types/database";

function mapRpcScanResult(data: unknown): ScanTransactionResult {
  if (!data || typeof data !== "object") {
    return { success: false, message: "Unexpected response from stock service." };
  }
  const row = data as Record<string, unknown>;
  return {
    success: Boolean(row.success),
    message: String(row.message ?? (row.success ? "OK" : "Scan failed.")),
    product: (row.product as Product | undefined) ?? undefined,
    stockUnit: (row.stockUnit as StockUnit | undefined) ?? undefined,
    newGodownStock:
      typeof row.newGodownStock === "number" ? row.newGodownStock : undefined,
    isUnitScan: row.isUnitScan !== false,
    bagsMoved:
      typeof row.bagsMoved === "number" ? row.bagsMoved : undefined,
  };
}

/** Server-only: atomic unit stock in/out via Postgres RPC. */
export async function processUnitStockTransactionServer(input: {
  barcodeId: string;
  godownId: string;
  transactionType: TransactionType;
  handledBy: string;
  bagsQty?: number | null;
}): Promise<ScanTransactionResult> {
  const barcode = input.barcodeId.trim();
  if (!barcode) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (input.transactionType === "STOCK_IN" && !input.godownId) {
    return {
      success: false,
      message: "Please select a godown before scanning.",
    };
  }

  if (isProductBarcode(barcode)) {
    return {
      success: false,
      message:
        "Use unit label barcodes (87…). Product barcodes cannot update warehouse stock safely.",
      isUnitScan: false,
    };
  }

  try {
    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc(
      "process_unit_stock_transaction",
      {
        p_barcode: barcode,
        p_godown_id: input.godownId || null,
        p_transaction_type: input.transactionType,
        p_handled_by: input.handledBy,
        p_bags_qty: input.bagsQty ?? null,
      }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    const result = mapRpcScanResult(data);

    if (
      result.success &&
      input.transactionType === "STOCK_IN" &&
      result.product &&
      input.godownId
    ) {
      const qualityMixWarning = await detectQualityMixAfterStockIn(
        supabase,
        input.godownId,
        {
          id: result.product.id,
          name: result.product.name,
          quality: result.product.quality ?? null,
          size: result.product.size ?? null,
          product_code: result.product.product_code,
        },
        result.stockUnit?.stock_batches?.batch_code ?? null
      );

      if (qualityMixWarning) {
        result.qualityMixWarning = qualityMixWarning;
      }
    }

    return result;
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Stock transaction failed.",
    };
  }
}

/** Server-only: move sealed full bale between godowns. */
export async function transferSealedBaleServer(input: {
  barcodeId: string;
  fromGodownId: string;
  toGodownId: string;
  handledBy: string;
}): Promise<ScanTransactionResult> {
  const barcode = input.barcodeId.trim();
  if (!barcode) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!input.fromGodownId || !input.toGodownId) {
    return {
      success: false,
      message: "Select both source and destination godowns.",
    };
  }
  if (isProductBarcode(barcode)) {
    return {
      success: false,
      message: "Use unit label barcodes (87…).",
      isUnitScan: false,
    };
  }

  try {
    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("transfer_sealed_bale", {
      p_barcode: barcode,
      p_from_godown_id: input.fromGodownId,
      p_to_godown_id: input.toGodownId,
      p_handled_by: input.handledBy,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return mapRpcScanResult(data);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Transfer failed.",
    };
  }
}

/** Server-only: return stock into a godown. */
export async function processReturnStockInServer(input: {
  barcodeId: string;
  godownId: string;
  bagsQty?: number | null;
  handledBy: string;
  reason?: string | null;
}): Promise<ScanTransactionResult> {
  const barcode = input.barcodeId.trim();
  if (!barcode) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!input.godownId) {
    return {
      success: false,
      message: "Please select a godown for returned stock.",
    };
  }
  if (isProductBarcode(barcode)) {
    return {
      success: false,
      message: "Use unit label barcodes (87…).",
      isUnitScan: false,
    };
  }

  try {
    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("process_return_stock_in", {
      p_barcode: barcode,
      p_godown_id: input.godownId,
      p_bags_qty: input.bagsQty ?? null,
      p_handled_by: input.handledBy,
      p_reason: input.reason ?? null,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return mapRpcScanResult(data);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Return failed.",
    };
  }
}

/** Server-only: claim unit onto draft bill atomically. */
export async function attachUnitToBillServer(input: {
  billId: string;
  unitBarcode: string;
  unitPrice?: number;
}): Promise<MutationResult<Awaited<ReturnType<typeof fetchBillWithItems>>>> {
  try {
    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("attach_unit_to_bill", {
      p_bill_id: input.billId,
      p_unit_barcode: input.unitBarcode.trim(),
      p_unit_price: input.unitPrice ?? 0,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const row = data as { success?: boolean; message?: string } | null;
    if (!row?.success) {
      return {
        success: false,
        message: row?.message ?? "Failed to add unit to bill.",
      };
    }

    const bill = await fetchBillWithItems(input.billId);
    return {
      success: true,
      message: row.message ?? "Unit added to bill.",
      data: bill ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to add item.",
    };
  }
}

export async function addRetailLineToBillServer(input: {
  billId: string;
  unitBarcode: string;
  bagsQty: number;
  unitPrice?: number;
  handledBy: string;
}): Promise<RetailBillLineResult> {
  try {
    const bagsQty = Math.floor(input.bagsQty);
    if (bagsQty < 1) {
      return { success: false, message: "Minimum sale is 1 bag." };
    }

    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("process_retail_bill_line", {
      p_bill_id: input.billId,
      p_unit_barcode: input.unitBarcode.trim(),
      p_bags_qty: bagsQty,
      p_unit_price: input.unitPrice ?? 0,
      p_handled_by: input.handledBy,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const row = data as {
      success?: boolean;
      message?: string;
      event?: RetailBaleEvent;
      remainingBags?: number;
      bagsSold?: number;
    } | null;

    if (!row?.success) {
      return {
        success: false,
        message: row?.message ?? "Failed to add retail line.",
      };
    }

    const bill = await fetchBillWithItems(input.billId);
    return {
      success: true,
      message: row.message ?? "Bags added to bill.",
      event: row.event,
      remainingBags: row.remainingBags,
      bagsSold: row.bagsSold,
      data: bill ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Retail sale failed.",
    };
  }
}

export async function removeBillItemServer(
  itemId: string
): Promise<MutationResult<Awaited<ReturnType<typeof fetchBillWithItems>>>> {
  try {
    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("release_bill_item_unit", {
      p_bill_item_id: itemId,
    });
    if (error) return { success: false, message: error.message };

    const row = data as {
      success?: boolean;
      message?: string;
      billId?: string;
    } | null;
    if (!row?.success) {
      return { success: false, message: row?.message ?? "Failed to remove item." };
    }

    const bill = row.billId ? await fetchBillWithItems(row.billId) : null;
    return {
      success: true,
      message: row.message ?? "Item removed from bill.",
      data: bill ?? undefined,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to remove item.",
    };
  }
}

export async function deleteBillServer(
  billId: string
): Promise<MutationResult> {
  try {
    const existing = await fetchBillWithItems(billId);
    if (!existing) return { success: false, message: "Bill not found." };

    const supabase = createServiceClient({ requireServiceRole: true });
    const { data, error } = await supabase.rpc("release_all_bill_units", {
      p_bill_id: billId,
    });
    if (error) return { success: false, message: error.message };

    const row = data as { success?: boolean; message?: string } | null;
    if (!row?.success) {
      return { success: false, message: row?.message ?? "Failed to delete bill." };
    }

    return {
      success: true,
      message: `Bill ${existing.bill_number} deleted.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete bill.",
    };
  }
}
