"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchDashboardMetrics,
  fetchGodownInventory,
  fetchGodowns,
  fetchProducts,
} from "@/lib/services/inventoryService";
import type {
  DashboardMetrics,
  Godown,
  GodownStockItem,
  Product,
} from "@/lib/types/database";

interface UseInventoryReturn {
  products: Product[];
  godowns: Godown[];
  metrics: DashboardMetrics | null;
  godownInventory: GodownStockItem[];
  loading: boolean;
  error: string | null;
  refreshMetrics: () => Promise<void>;
  refreshGodownInventory: (godownId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

export function useInventory(
  selectedGodownId?: string | null
): UseInventoryReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [godownInventory, setGodownInventory] = useState<GodownStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMetrics = useCallback(async () => {
    try {
      const data = await fetchDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    }
  }, []);

  const refreshGodownInventory = useCallback(async (godownId: string) => {
    if (!godownId) {
      setGodownInventory([]);
      return;
    }
    try {
      const data = await fetchGodownInventory(godownId);
      setGodownInventory(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load godown inventory"
      );
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, godownsData] = await Promise.all([
        fetchProducts(),
        fetchGodowns(),
      ]);
      setProducts(productsData);
      setGodowns(godownsData);
      await refreshMetrics();
      if (selectedGodownId) {
        await refreshGodownInventory(selectedGodownId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [selectedGodownId, refreshMetrics, refreshGodownInventory]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (selectedGodownId) {
      refreshGodownInventory(selectedGodownId);
    }
  }, [selectedGodownId, refreshGodownInventory]);

  return {
    products,
    godowns,
    metrics,
    godownInventory,
    loading,
    error,
    refreshMetrics,
    refreshGodownInventory,
    refreshAll,
  };
}
