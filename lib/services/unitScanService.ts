import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchStockUnitByBarcode } from "@/lib/services/batchService";
import { fetchProductByBarcode } from "@/lib/services/inventoryService";
import { isUnitBarcode } from "@/lib/utils/barcode";
import type {
  MutationResult,
  ScanTransactionInput,
  ScanTransactionResult,
  StockUnit,
  TransactionType,
} from "@/lib/types/database";

const DEFAULT_HANDLED_BY = "warehouse-operator";

async function getGodownStockForProduct(
  productId: string,
  godownId: string
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_logs")
    .select("transaction_type, quantity")
    .eq("product_id", productId)
    .eq("godown_id", godownId);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce((total, log) => {
    return log.transaction_type === "STOCK_IN"
      ? total + log.quantity
      : total - log.quantity;
  }, 0);
}

async function processUnitStockIn(
  unit: StockUnit,
  godownId: string,
  handledBy: string
): Promise<ScanTransactionResult> {
  if (unit.status !== "LABELLED") {
    return {
      success: false,
      message: `Unit already ${unit.status.replace("_", " ").toLowerCase()}.`,
      stockUnit: unit,
      isUnitScan: true,
    };
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: updatedUnit, error: unitError } = await supabase
    .from("stock_units")
    .update({
      status: "STOCKED_IN",
      godown_id: godownId,
      stocked_in_at: now,
    })
    .eq("id", unit.id)
    .select(
      `
      *,
      products ( id, name, product_code, barcode_id, total_stock, size, special_note, description, category ),
      stock_batches ( id, batch_code, source_name )
    `
    )
    .single();

  if (unitError) throw new Error(unitError.message);

  const { error: logError } = await supabase.from("inventory_logs").insert({
    product_id: unit.product_id,
    godown_id: godownId,
    transaction_type: "STOCK_IN",
    quantity: 1,
    handled_by: handledBy,
  });

  if (logError) throw new Error(logError.message);

  const product = updatedUnit.products as StockUnit["products"] & {
    barcode_id: string;
    total_stock: number;
    special_note: string | null;
    description: string | null;
    category: string | null;
  };

  const newTotal = (product?.total_stock ?? 0) + 1;
  const { data: updatedProduct, error: productError } = await supabase
    .from("products")
    .update({ total_stock: newTotal })
    .eq("id", unit.product_id)
    .select()
    .single();

  if (productError) throw new Error(productError.message);

  const godownStock = await getGodownStockForProduct(unit.product_id, godownId);

  return {
    success: true,
    message: `Stock In: ${product?.name} (Unit #${unit.unit_number}) from ${updatedUnit.stock_batches?.source_name ?? "batch"}`,
    product: updatedProduct,
    newGodownStock: godownStock,
    stockUnit: updatedUnit as StockUnit,
    isUnitScan: true,
  };
}

async function processUnitStockOut(
  unit: StockUnit,
  godownId: string,
  handledBy: string
): Promise<ScanTransactionResult> {
  if (unit.status !== "STOCKED_IN") {
    return {
      success: false,
      message:
        unit.status === "LABELLED"
          ? "Unit not stocked in yet. Scan at Stock In first."
          : "Unit already stocked out.",
      stockUnit: unit,
      isUnitScan: true,
    };
  }

  if (unit.godown_id !== godownId) {
    return {
      success: false,
      message: "This unit is not in the selected godown.",
      stockUnit: unit,
      isUnitScan: true,
    };
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: updatedUnit, error: unitError } = await supabase
    .from("stock_units")
    .update({
      status: "STOCKED_OUT",
      stocked_out_at: now,
    })
    .eq("id", unit.id)
    .select(
      `
      *,
      products ( id, name, product_code, barcode_id, total_stock, size, special_note, description, category ),
      stock_batches ( id, batch_code, source_name )
    `
    )
    .single();

  if (unitError) throw new Error(unitError.message);

  const { error: logError } = await supabase.from("inventory_logs").insert({
    product_id: unit.product_id,
    godown_id: godownId,
    transaction_type: "STOCK_OUT",
    quantity: 1,
    handled_by: handledBy,
  });

  if (logError) throw new Error(logError.message);

  const product = updatedUnit.products as StockUnit["products"] & {
    barcode_id: string;
    total_stock: number;
    special_note: string | null;
    description: string | null;
    category: string | null;
  };

  const newTotal = Math.max(0, (product?.total_stock ?? 0) - 1);
  const { data: updatedProduct, error: productError } = await supabase
    .from("products")
    .update({ total_stock: newTotal })
    .eq("id", unit.product_id)
    .select()
    .single();

  if (productError) throw new Error(productError.message);

  const godownStock = await getGodownStockForProduct(unit.product_id, godownId);

  return {
    success: true,
    message: `Stock Out: ${product?.name} (Unit #${unit.unit_number}) — ready for billing`,
    product: updatedProduct,
    newGodownStock: godownStock,
    stockUnit: updatedUnit as StockUnit,
    isUnitScan: true,
  };
}

export async function processScanTransaction(
  input: ScanTransactionInput
): Promise<ScanTransactionResult> {
  const {
    barcodeId,
    godownId,
    transactionType,
    quantity = 1,
    handledBy = DEFAULT_HANDLED_BY,
  } = input;

  if (!barcodeId.trim()) {
    return { success: false, message: "Invalid barcode scanned." };
  }
  if (!godownId) {
    return {
      success: false,
      message: "Please select a godown before scanning.",
    };
  }

  try {
    const trimmed = barcodeId.trim();

    if (isUnitBarcode(trimmed)) {
      const unit = await fetchStockUnitByBarcode(trimmed);
      if (!unit) {
        return {
          success: false,
          message: `No unit found for barcode: ${trimmed}`,
        };
      }
      return transactionType === "STOCK_IN"
        ? processUnitStockIn(unit, godownId, handledBy)
        : processUnitStockOut(unit, godownId, handledBy);
    }

    // Try unit barcode even without 87 prefix (legacy safety)
    const unit = await fetchStockUnitByBarcode(trimmed);
    if (unit) {
      return transactionType === "STOCK_IN"
        ? processUnitStockIn(unit, godownId, handledBy)
        : processUnitStockOut(unit, godownId, handledBy);
    }

    // Fallback: product-level barcode (bulk scan)
    if (quantity <= 0) {
      return { success: false, message: "Quantity must be at least 1." };
    }

    const product = await fetchProductByBarcode(trimmed);
    if (!product) {
      return {
        success: false,
        message: `No product or unit found for barcode: ${trimmed}`,
      };
    }

    const currentGodownStock = await getGodownStockForProduct(
      product.id,
      godownId
    );

    if (transactionType === "STOCK_OUT") {
      if (currentGodownStock < quantity) {
        return {
          success: false,
          message: "Insufficient Stock in this Godown",
        };
      }
    }

    const supabase = getSupabaseClient();

    const { error: logError } = await supabase.from("inventory_logs").insert({
      product_id: product.id,
      godown_id: godownId,
      transaction_type: transactionType,
      quantity,
      handled_by: handledBy,
    });

    if (logError) throw new Error(logError.message);

    const stockDelta = transactionType === "STOCK_IN" ? quantity : -quantity;
    const newTotalStock = Math.max(0, product.total_stock + stockDelta);

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({ total_stock: newTotalStock })
      .eq("id", product.id)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    const newGodownStock =
      transactionType === "STOCK_IN"
        ? currentGodownStock + quantity
        : currentGodownStock - quantity;

    const actionLabel =
      transactionType === "STOCK_IN" ? "Stock In" : "Stock Out";

    return {
      success: true,
      message: `${actionLabel} successful: ${product.name} × ${quantity}`,
      product: updatedProduct,
      newGodownStock,
      isUnitScan: false,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Transaction failed unexpectedly.";
    return { success: false, message };
  }
}

export type { TransactionType };
