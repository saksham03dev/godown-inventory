"use client";

import { useCallback, useEffect, useState } from "react";
import { ALL_GODOWNS_ID } from "@/lib/constants/inventoryView";
import { useCatalogCache } from "@/contexts/CatalogCacheContext";
import {
  fetchAllGodownInventory,
  fetchDashboardMetrics,
  fetchGodownInventory,
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

async function loadInventoryForSelection(
  godownId: string
): Promise<GodownStockItem[]> {
  if (godownId === ALL_GODOWNS_ID) {
    return fetchAllGodownInventory();
  }
  return fetchGodownInventory(godownId);
}

export function useInventory(
  selectedGodownId?: string | null
): UseInventoryReturn {
  const {
    godowns,
    products,
    godownsLoading,
    productsLoading,
    catalogError,
    refreshCatalog,
  } = useCatalogCache();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [godownInventory, setGodownInventory] = useState<GodownStockItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await fetchDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const refreshGodownInventory = useCallback(async (godownId: string) => {
    if (!godownId) {
      setGodownInventory([]);
      return;
    }
    setInventoryLoading(true);
    try {
      const data = await loadInventoryForSelection(godownId);
      setGodownInventory(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inventory"
      );
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([refreshCatalog(), refreshMetrics()]);
    if (selectedGodownId) {
      await refreshGodownInventory(selectedGodownId);
    }
  }, [
    selectedGodownId,
    refreshCatalog,
    refreshMetrics,
    refreshGodownInventory,
  ]);

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  useEffect(() => {
    if (selectedGodownId) {
      void refreshGodownInventory(selectedGodownId);
    } else {
      setGodownInventory([]);
    }
  }, [selectedGodownId, refreshGodownInventory]);

  useEffect(() => {
    if (catalogError) {
      setError(catalogError);
    }
  }, [catalogError]);

  const loading =
    godownsLoading || productsLoading || metricsLoading || inventoryLoading;

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
