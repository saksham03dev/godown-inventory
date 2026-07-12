"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGodowns } from "@/lib/services/inventoryService";
import { fetchOpenBales } from "@/lib/services/openBalesService";
import type { Godown, StockUnit } from "@/lib/types/database";

export function useOpenBales(godownId?: string | null) {
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bales, godownList] = await Promise.all([
        fetchOpenBales(godownId),
        fetchGodowns(),
      ]);
      setUnits(bales);
      setGodowns(godownList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load open bales.");
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [godownId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { units, godowns, loading, error, refresh };
}
