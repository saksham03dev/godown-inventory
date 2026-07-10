"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProducts } from "@/lib/services/inventoryService";
import {
  createStockBatch,
  fetchBatchWithUnits,
  fetchBatches,
} from "@/lib/services/batchService";
import type {
  AlertState,
  CreateBatchInput,
  Product,
  StockBatch,
  StockBatchWithUnits,
} from "@/lib/types/database";

export function useLabels() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<StockBatchWithUnits | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, batchesData] = await Promise.all([
        fetchProducts(),
        fetchBatches(),
      ]);
      setProducts(productsData);
      setBatches(batchesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createBatch = useCallback(
    async (input: CreateBatchInput) => {
      setCreating(true);
      setAlert(null);
      const result = await createStockBatch(input);
      if (result.success && result.data) {
        setAlert({ type: "success", message: result.message });
        setActiveBatch(result.data);
        await refresh();
      } else {
        setAlert({ type: "error", message: result.message });
      }
      setCreating(false);
      return result;
    },
    [refresh]
  );

  const loadBatch = useCallback(async (batchId: string) => {
    try {
      const batch = await fetchBatchWithUnits(batchId);
      setActiveBatch(batch);
      return batch;
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load batch",
      });
      return null;
    }
  }, []);

  const dismissAlert = useCallback(() => setAlert(null), []);

  return {
    products,
    batches,
    activeBatch,
    loading,
    creating,
    error,
    alert,
    refresh,
    createBatch,
    loadBatch,
    dismissAlert,
  };
}
