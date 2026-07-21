"use client";

import { useCallback, useEffect, useState } from "react";
import { useCatalogGodowns } from "@/contexts/CatalogCacheContext";
import { fetchOpenBales } from "@/lib/services/openBalesService";
import type { StockUnit } from "@/lib/types/database";

export function useOpenBales(godownId?: string | null) {
  const { godowns, loading: godownsLoading } = useCatalogGodowns();
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setUnitsLoading(true);
    setError(null);
    try {
      const bales = await fetchOpenBales(godownId);
      setUnits(bales);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load open bales.");
      setUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  }, [godownId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    units,
    godowns,
    loading: godownsLoading || unitsLoading,
    error,
    refresh,
  };
}
