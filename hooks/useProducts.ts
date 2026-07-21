"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogCache } from "@/contexts/CatalogCacheContext";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/services/productService";
import type { AlertState, Product, ProductInput } from "@/lib/types/database";

export function useProducts() {
  const { products, productsLoading, catalogError, refreshProducts } =
    useCatalogCache();
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    if (catalogError) setError(catalogError);
  }, [catalogError]);

  const refresh = useCallback(async () => {
    setError(null);
    await refreshProducts();
  }, [refreshProducts]);

  const addProduct = useCallback(
    async (input: ProductInput) => {
      setMutating(true);
      setAlert(null);
      const result = await createProduct(input);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refreshProducts();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshProducts]
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
        await refreshProducts();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshProducts]
  );

  const removeProduct = useCallback(
    async (id: string) => {
      setMutating(true);
      setAlert(null);
      const result = await deleteProduct(id);
      if (result.success) {
        setAlert({ type: "success", message: result.message });
        await refreshProducts();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setMutating(false);
      return result;
    },
    [refreshProducts]
  );

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    products,
    loading: productsLoading,
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
