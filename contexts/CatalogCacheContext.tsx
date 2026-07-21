"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchGodowns,
  fetchProducts,
} from "@/lib/services/inventoryService";
import type { Godown, Product } from "@/lib/types/database";

interface CatalogCacheContextValue {
  godowns: Godown[];
  products: Product[];
  godownsLoading: boolean;
  productsLoading: boolean;
  catalogError: string | null;
  refreshGodowns: () => Promise<Godown[]>;
  refreshProducts: () => Promise<Product[]>;
  refreshCatalog: () => Promise<void>;
}

const CatalogCacheContext = createContext<CatalogCacheContextValue | null>(null);

export function CatalogCacheProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [godownsLoading, setGodownsLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const godownsPromiseRef = useRef<Promise<Godown[]> | null>(null);
  const productsPromiseRef = useRef<Promise<Product[]> | null>(null);

  const refreshGodowns = useCallback(async (): Promise<Godown[]> => {
    if (godownsPromiseRef.current) {
      return godownsPromiseRef.current;
    }

    setGodownsLoading(true);
    const promise = fetchGodowns()
      .then((data) => {
        setGodowns(data);
        setCatalogError(null);
        return data;
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load warehouses";
        setCatalogError(message);
        throw err;
      })
      .finally(() => {
        setGodownsLoading(false);
        godownsPromiseRef.current = null;
      });

    godownsPromiseRef.current = promise;
    return promise;
  }, []);

  const refreshProducts = useCallback(async (): Promise<Product[]> => {
    if (productsPromiseRef.current) {
      return productsPromiseRef.current;
    }

    setProductsLoading(true);
    const promise = fetchProducts()
      .then((data) => {
        setProducts(data);
        setCatalogError(null);
        return data;
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load products";
        setCatalogError(message);
        throw err;
      })
      .finally(() => {
        setProductsLoading(false);
        productsPromiseRef.current = null;
      });

    productsPromiseRef.current = promise;
    return promise;
  }, []);

  const refreshCatalog = useCallback(async () => {
    await Promise.all([refreshGodowns(), refreshProducts()]);
  }, [refreshGodowns, refreshProducts]);

  useEffect(() => {
    if (!profile) {
      setGodowns([]);
      setProducts([]);
      return;
    }
    void refreshGodowns();
    void refreshProducts();
  }, [profile, refreshGodowns, refreshProducts]);

  return (
    <CatalogCacheContext.Provider
      value={{
        godowns,
        products,
        godownsLoading,
        productsLoading,
        catalogError,
        refreshGodowns,
        refreshProducts,
        refreshCatalog,
      }}
    >
      {children}
    </CatalogCacheContext.Provider>
  );
}

export function useCatalogCache() {
  const ctx = useContext(CatalogCacheContext);
  if (!ctx) {
    throw new Error("useCatalogCache must be used within CatalogCacheProvider");
  }
  return ctx;
}

/** Godowns from shared session cache (deduped fetches). */
export function useCatalogGodowns() {
  const { godowns, godownsLoading, catalogError, refreshGodowns } =
    useCatalogCache();
  return { godowns, loading: godownsLoading, error: catalogError, refreshGodowns };
}

/** Products from shared session cache (deduped fetches). */
export function useCatalogProducts() {
  const { products, productsLoading, catalogError, refreshProducts } =
    useCatalogCache();
  return {
    products,
    loading: productsLoading,
    error: catalogError,
    refreshProducts,
  };
}
