"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_VISIBLE_PRODUCT_COLUMNS,
  parseStoredProductColumns,
  PRODUCT_TABLE_COLUMNS,
  PRODUCT_TABLE_COLUMNS_STORAGE_KEY,
  type ProductTableColumnId,
} from "@/lib/constants/productTableColumns";

export function useProductTableColumns() {
  const [visibleColumns, setVisibleColumns] = useState<ProductTableColumnId[]>(
    DEFAULT_VISIBLE_PRODUCT_COLUMNS
  );

  useEffect(() => {
    setVisibleColumns(
      parseStoredProductColumns(
        localStorage.getItem(PRODUCT_TABLE_COLUMNS_STORAGE_KEY)
      )
    );
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PRODUCT_TABLE_COLUMNS_STORAGE_KEY,
      JSON.stringify(visibleColumns)
    );
  }, [visibleColumns]);

  const toggleColumn = useCallback((id: ProductTableColumnId) => {
    setVisibleColumns((prev) => {
      const has = prev.includes(id);
      if (has && prev.length <= 1) return prev;
      return has ? prev.filter((c) => c !== id) : [...prev, id];
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE_PRODUCT_COLUMNS);
  }, []);

  const columnLabels = PRODUCT_TABLE_COLUMNS;

  return {
    visibleColumns,
    toggleColumn,
    resetColumns,
    columnLabels,
    isVisible: (id: ProductTableColumnId) => visibleColumns.includes(id),
  };
}
