import { apiMutation } from "@/lib/api/clientMutation";
import {
  generateBarcodeFromProductCode,
  normalizeProductCode,
} from "@/lib/utils/barcode";
import type { MutationResult, Product, ProductInput } from "@/lib/types/database";

export async function createProduct(
  input: ProductInput
): Promise<MutationResult<Product>> {
  return apiMutation<Product>("/api/products", { body: input });
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  options?: { preservePrice?: boolean; existingPrice?: number }
): Promise<MutationResult<Product>> {
  return apiMutation<Product>(`/api/products/${id}`, {
    method: "PATCH",
    body: { ...input, options },
  });
}

export async function deleteProduct(id: string): Promise<MutationResult> {
  return apiMutation(`/api/products/${id}`, { method: "DELETE" });
}

export function getBarcodePreview(productCode: string): string | null {
  try {
    return generateBarcodeFromProductCode(normalizeProductCode(productCode));
  } catch {
    return null;
  }
}
