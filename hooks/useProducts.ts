"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProducts } from "@/lib/services/inventoryService";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/services/productService";
import type { AlertState, Product, ProductInput } from "@/lib/types/database";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProduct = useCallback(
    async (input: ProductInput) => {
      setMutating(true);
      setAlert(null);
      const result = await createProduct(input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const editProduct = useCallback(
    async (
      id: string,
      input: ProductInput,
      options?: { preservePrice?: boolean; existingPrice?: number }
    ) => {
      setMutating(true);
      setAlert(null);
      const result = await updateProduct(id, input, options);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const removeProduct = useCallback(
    async (id: string) => {
      setMutating(true);
      setAlert(null);
      const result = await deleteProduct(id);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refresh]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    products,
    loading,
    mutating,
    error,
    alert,
    refresh,
    addProduct,
    editProduct,
    removeProduct,
    dismissAlert,
  };
}
