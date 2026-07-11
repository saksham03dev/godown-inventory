import { createServiceClient } from "@/lib/supabase/service";
import {
  generateBarcodeFromProductCode,
  normalizeProductCode,
} from "@/lib/utils/barcode";
import type { MutationResult, Product, ProductInput } from "@/lib/types/database";

function formatProductError(error: { code?: string; message: string }): string {
  if (
    error.message.includes("product_code") &&
    (error.message.includes("schema cache") ||
      error.message.includes("column") ||
      error.code === "PGRST204")
  ) {
    return (
      "Database is missing the product_code column. Run supabase/migrations/002_product_godown_management.sql in the Supabase SQL Editor, then retry."
    );
  }
  return error.message;
}

function db() {
  return createServiceClient({ requireServiceRole: true });
}

export async function createProductServer(
  input: ProductInput
): Promise<MutationResult<Product>> {
  try {
    const name = input.name.trim();
    const product_code = normalizeProductCode(input.product_code);

    if (!name) return { success: false, message: "Product name is required." };
    if (!product_code) {
      return { success: false, message: "Product code is required." };
    }

    const retail_selling_price = input.retail_selling_price ?? 0;
    if (retail_selling_price < 0) {
      return { success: false, message: "Selling price cannot be negative." };
    }

    const barcode_id = generateBarcodeFromProductCode(product_code);
    const { data, error } = await db()
      .from("products")
      .insert({
        name,
        product_code,
        barcode_id,
        total_stock: 0,
        size: input.size?.trim() || null,
        special_note: input.special_note?.trim() || null,
        category: input.category?.trim() || null,
        retail_selling_price,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: "A product with this backend code already exists.",
        };
      }
      throw new Error(formatProductError(error));
    }

    return {
      success: true,
      message: `Product "${name}" created with code ${product_code}.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to create product.",
    };
  }
}

export async function updateProductServer(
  id: string,
  input: ProductInput,
  options?: { preservePrice?: boolean; existingPrice?: number }
): Promise<MutationResult<Product>> {
  try {
    const name = input.name.trim();
    const product_code = normalizeProductCode(input.product_code);

    if (!name) return { success: false, message: "Product name is required." };
    if (!product_code) {
      return { success: false, message: "Product code is required." };
    }

    const retail_selling_price = options?.preservePrice
      ? (options.existingPrice ?? 0)
      : (input.retail_selling_price ?? 0);
    if (retail_selling_price < 0) {
      return { success: false, message: "Selling price cannot be negative." };
    }

    const barcode_id = generateBarcodeFromProductCode(product_code);
    const { data, error } = await db()
      .from("products")
      .update({
        name,
        product_code,
        barcode_id,
        size: input.size?.trim() || null,
        special_note: input.special_note?.trim() || null,
        category: input.category?.trim() || null,
        retail_selling_price,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: "Another product already uses this backend code.",
        };
      }
      throw new Error(formatProductError(error));
    }

    return {
      success: true,
      message: `Product "${name}" updated successfully.`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to update product.",
    };
  }
}

export async function deleteProductServer(id: string): Promise<MutationResult> {
  try {
    const supabase = db();
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("name")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return {
      success: true,
      message: `Product "${product.name}" deleted.`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to delete product.",
    };
  }
}
