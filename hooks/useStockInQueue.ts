"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STOCK_IN_QUEUE_STORAGE_KEY,
  STOCK_IN_UPLOAD_BATCH_SIZE,
  STOCK_IN_UPLOAD_INTERVAL_MS,
} from "@/lib/constants/stockIn";
import { uploadStockInBatch } from "@/lib/services/stockInBatchService";
import type { MutationResult } from "@/lib/types/database";

export type StockInQueueStatus = "pending" | "uploading" | "saved" | "failed";

export interface StockInQueueItem {
  barcode: string;
  bagsQty: number;
  productId: string;
  productName: string;
  productCode: string;
  size: string | null;
  unitNumber: number;
  status: StockInQueueStatus;
  uploadId: string | null;
  error: string | null;
}

export interface StockInQueueCounts {
  scanned: number;
  inWarehouse: number;
  sending: number;
}

type Store = Record<string, StockInQueueItem[]>;

const EMPTY_ITEMS: StockInQueueItem[] = [];

function newUploadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stock-in-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeItem(value: unknown): StockInQueueItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StockInQueueItem>;
  const barcode = typeof row.barcode === "string" ? row.barcode.trim() : "";
  if (!barcode) return null;
  const status: StockInQueueStatus =
    row.status === "saved" || row.status === "failed" || row.status === "uploading"
      ? row.status === "uploading"
        ? "pending"
        : row.status
      : "pending";
  return {
    barcode,
    bagsQty: Math.max(1, Math.floor(Number(row.bagsQty) || 1)),
    productId: String(row.productId ?? ""),
    productName: String(row.productName ?? "Product"),
    productCode: String(row.productCode ?? ""),
    size: row.size ? String(row.size) : null,
    unitNumber: Math.floor(Number(row.unitNumber) || 0),
    status,
    uploadId: typeof row.uploadId === "string" && row.uploadId ? row.uploadId : null,
    error: typeof row.error === "string" ? row.error : null,
  };
}

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STOCK_IN_QUEUE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { byGodown?: Record<string, unknown> };
    const byGodown = parsed.byGodown ?? {};
    const store: Store = {};
    for (const [godownId, items] of Object.entries(byGodown)) {
      if (!Array.isArray(items)) continue;
      const normalized = items
        .map(normalizeItem)
        .filter((item): item is StockInQueueItem => Boolean(item));
      if (normalized.length) store[godownId] = normalized;
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  const hasItems = Object.values(store).some((items) => items.length > 0);
  if (!hasItems) {
    localStorage.removeItem(STOCK_IN_QUEUE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(
    STOCK_IN_QUEUE_STORAGE_KEY,
    JSON.stringify({ byGodown: store })
  );
}

function pickBatch(store: Store, allowPartial: boolean): {
  godownId: string;
  uploadId: string;
  items: StockInQueueItem[];
} | null {
  for (const [godownId, items] of Object.entries(store)) {
    const retry = items.filter((item) => item.status === "pending" && item.uploadId);
    if (!retry.length) continue;
    const uploadId = retry[0].uploadId as string;
    return {
      godownId,
      uploadId,
      items: retry.filter((item) => item.uploadId === uploadId).slice(0, STOCK_IN_UPLOAD_BATCH_SIZE),
    };
  }

  for (const [godownId, items] of Object.entries(store)) {
    const fresh = items.filter((item) => item.status === "pending" && !item.uploadId);
    if (!fresh.length) continue;
    if (!allowPartial && fresh.length < STOCK_IN_UPLOAD_BATCH_SIZE) continue;
    return {
      godownId,
      uploadId: newUploadId(),
      items: fresh.slice(0, STOCK_IN_UPLOAD_BATCH_SIZE),
    };
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function godownStillSending(store: Store, godownId: string): boolean {
  const list = store[godownId] ?? [];
  return list.some(
    (item) => item.status === "pending" || item.status === "uploading"
  );
}

export function stockInCounts(items: StockInQueueItem[]): StockInQueueCounts {
  const active = items.filter((item) => item.status !== "failed");
  return {
    scanned: active.length,
    inWarehouse: items.filter((item) => item.status === "saved").length,
    sending: items.filter((item) => item.status === "pending" || item.status === "uploading").length,
  };
}

export function useStockInQueue() {
  const [store, setStore] = useState<Store>({});
  const storeRef = useRef<Store>({});
  const flushingRef = useRef(false);
  const hydratedRef = useRef(false);

  const commit = useCallback((next: Store) => {
    storeRef.current = next;
    setStore(next);
    writeStore(next);
  }, []);

  const flush = useCallback(async (allowPartial: boolean) => {
    if (flushingRef.current) return;
    const batch = pickBatch(storeRef.current, allowPartial);
    if (!batch) return;

    flushingRef.current = true;
    const barcodes = new Set(batch.items.map((item) => item.barcode));
    const current = storeRef.current[batch.godownId] ?? [];
    commit({
      ...storeRef.current,
      [batch.godownId]: current.map((item) =>
        barcodes.has(item.barcode)
          ? { ...item, status: "uploading", uploadId: batch.uploadId, error: null }
          : item
      ),
    });

    const revertToPending = () => {
      const latest = storeRef.current[batch.godownId] ?? [];
      commit({
        ...storeRef.current,
        [batch.godownId]: latest.map((item) =>
          barcodes.has(item.barcode) && item.status === "uploading"
            ? { ...item, status: "pending", uploadId: batch.uploadId }
            : item
        ),
      });
    };

    try {
      const result = await uploadStockInBatch({
        uploadId: batch.uploadId,
        godownId: batch.godownId,
        items: batch.items.map((item) => ({ barcode: item.barcode, bagsQty: item.bagsQty })),
      });
      const saved = new Set(result.savedBarcodes ?? []);
      const failed = new Map((result.failed ?? []).map((row) => [row.barcode, row.message]));
      if (!saved.size && !failed.size) {
        revertToPending();
        return;
      }
      const latest = storeRef.current[batch.godownId] ?? [];
      commit({
        ...storeRef.current,
        [batch.godownId]: latest.map((item) => {
          if (!barcodes.has(item.barcode)) return item;
          if (saved.has(item.barcode)) {
            return { ...item, status: "saved", uploadId: batch.uploadId, error: null };
          }
          if (failed.has(item.barcode)) {
            return {
              ...item,
              status: "failed",
              uploadId: batch.uploadId,
              error: failed.get(item.barcode) ?? "Could not stock in this label.",
            };
          }
          return { ...item, status: "pending", uploadId: batch.uploadId };
        }),
      });
    } catch {
      revertToPending();
    } finally {
      flushingRef.current = false;
      const more = pickBatch(storeRef.current, false);
      if (more && more.uploadId !== batch.uploadId) void flush(false);
    }
  }, [commit]);

  useEffect(() => {
    const stored = readStore();
    storeRef.current = stored;
    setStore(stored);
    hydratedRef.current = true;
    void flush(true);
  }, [flush]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flush(true);
    }, STOCK_IN_UPLOAD_INTERVAL_MS);

    const sendCurrentBatch = () => {
      if (flushingRef.current) return;
      const batch = pickBatch(storeRef.current, true);
      if (!batch) return;
      const barcodes = new Set(batch.items.map((item) => item.barcode));
      const current = storeRef.current[batch.godownId] ?? [];
      const next = {
        ...storeRef.current,
        [batch.godownId]: current.map((item) =>
          barcodes.has(item.barcode)
            ? { ...item, status: "pending" as const, uploadId: batch.uploadId }
            : item
        ),
      };
      commit(next);
      try {
        void fetch("/api/inventory/stock-in/batch", {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: batch.uploadId,
            godownId: batch.godownId,
            items: batch.items.map((item) => ({ barcode: item.barcode, bagsQty: item.bagsQty })),
          }),
        });
      } catch {
        // The saved queue retries the same upload id when Stock In opens again.
      }
    };

    window.addEventListener("pagehide", sendCurrentBatch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", sendCurrentBatch);
    };
  }, [commit, flush]);

  const itemsFor = useCallback(
    (godownId: string) => store[godownId] ?? EMPTY_ITEMS,
    [store]
  );

  const containsBarcode = useCallback((barcode: string) => {
    const needle = barcode.trim();
    return Object.values(storeRef.current).some((items) =>
      items.some((item) => item.barcode === needle)
    );
  }, []);

  const enqueue = useCallback(
    (godownId: string, item: Omit<StockInQueueItem, "status" | "uploadId" | "error">) => {
      const barcode = item.barcode.trim();
      const list = storeRef.current[godownId] ?? [];
      if (list.some((row) => row.barcode === barcode) || containsBarcode(barcode)) return false;
      commit({
        ...storeRef.current,
        [godownId]: [
          ...list,
          { ...item, barcode, status: "pending", uploadId: null, error: null },
        ],
      });
      const pending = (storeRef.current[godownId] ?? []).filter(
        (row) => row.status === "pending" && !row.uploadId
      );
      if (pending.length >= STOCK_IN_UPLOAD_BATCH_SIZE) void flush(false);
      return true;
    },
    [commit, containsBarcode, flush]
  );

  const clearSaved = useCallback(
    (godownId: string) => {
      const list = storeRef.current[godownId] ?? [];
      commit({
        ...storeRef.current,
        [godownId]: list.filter((item) => item.status !== "saved"),
      });
    },
    [commit]
  );

  const completeTruckUnload = useCallback(
    async (godownId: string): Promise<MutationResult<{ unloaded: number }>> => {
      const godown = godownId.trim();
      if (!godown) {
        return { success: false, message: "Pick a warehouse first." };
      }

      const maxRounds = 24;
      let backoffMs = 300;
      for (let round = 0; round < maxRounds; round++) {
        while (pickBatch(storeRef.current, true)) {
          while (flushingRef.current) {
            await sleep(50);
          }
          await flush(true);
          while (flushingRef.current) {
            await sleep(50);
          }
        }
        if (!godownStillSending(storeRef.current, godown)) {
          break;
        }
        if (round < maxRounds - 1) {
          await sleep(backoffMs);
          backoffMs = Math.min(Math.round(backoffMs * 1.45), 2000);
        }
      }

      const list = storeRef.current[godown] ?? [];
      const active = list.filter((item) => item.status !== "failed");
      if (active.length === 0) {
        return {
          success: false,
          message: "Scan at least one bale before marking the truck unloaded.",
        };
      }

      if (godownStillSending(storeRef.current, godown)) {
        return {
          success: false,
          message:
            "Some labels are still sending to the warehouse. Check the network and tap TRUCK UNLOADED again.",
        };
      }

      const unloaded = list.filter((item) => item.status === "saved").length;
      commit({
        ...storeRef.current,
        [godown]: list.filter((item) => item.status === "failed"),
      });

      return {
        success: true,
        message:
          unloaded > 0
            ? `Truck unloaded · ${unloaded} bale${unloaded === 1 ? "" : "s"} in warehouse.`
            : "Truck session cleared.",
        data: { unloaded },
      };
    },
    [commit, flush]
  );

  return {
    hydrated: hydratedRef.current || Object.keys(store).length > 0,
    itemsFor,
    countsFor: (godownId: string) => stockInCounts(store[godownId] ?? EMPTY_ITEMS),
    containsBarcode,
    enqueue,
    clearSaved,
    completeTruckUnload,
  };
}
