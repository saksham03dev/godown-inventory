"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STOCK_OUT_QUEUE_STORAGE_KEY,
  STOCK_OUT_STAGED_STORAGE_KEY,
  STOCK_OUT_UPLOAD_BATCH_SIZE,
  STOCK_OUT_UPLOAD_INTERVAL_MS,
  type StockOutSaleMode,
} from "@/lib/constants/stockOut";
import { confirmStockOutSlip } from "@/lib/services/stockOutSlipService";
import type { MutationResult } from "@/lib/types/database";

export type StockOutQueueStatus = "pending" | "uploading" | "saved" | "failed";

export interface StockOutQueueItem {
  barcode: string;
  bagsQty: number;
  productId: string;
  productName: string;
  productCode: string;
  size: string | null;
  unitNumber: number;
  status: StockOutQueueStatus;
  uploadId: string | null;
  error: string | null;
}

export interface StockOutSession {
  id: string;
  saleMode: StockOutSaleMode;
  billerName: string;
  billNo: string;
  slipId: string | null;
  openedAt: string;
  closed: boolean;
  items: StockOutQueueItem[];
}

export interface StockOutQueueCounts {
  scanned: number;
  stockedOut: number;
  sending: number;
}

interface Store {
  sessions: StockOutSession[];
}

const EMPTY_ITEMS: StockOutQueueItem[] = [];

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sessionReady(session: StockOutSession | null | undefined): session is StockOutSession {
  return Boolean(session && session.billerName.trim() && session.billNo.trim());
}

function normalizeItem(value: unknown): StockOutQueueItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StockOutQueueItem>;
  const barcode = typeof row.barcode === "string" ? row.barcode.trim() : "";
  if (!barcode) return null;
  const status: StockOutQueueStatus =
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

function normalizeSession(value: unknown): StockOutSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<StockOutSession>;
  const items = Array.isArray(row.items)
    ? row.items.map(normalizeItem).filter((item): item is StockOutQueueItem => Boolean(item))
    : [];
  return {
    id: typeof row.id === "string" && row.id ? row.id : newId("stock-out"),
    saleMode: row.saleMode === "retail" ? "retail" : "wholesale",
    billerName: typeof row.billerName === "string" ? row.billerName : "",
    billNo: typeof row.billNo === "string" ? row.billNo : "",
    slipId: typeof row.slipId === "string" && row.slipId ? row.slipId : null,
    openedAt: typeof row.openedAt === "string" && row.openedAt ? row.openedAt : new Date().toISOString(),
    closed: Boolean(row.closed),
    items,
  };
}

function readLegacySession(): StockOutSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STOCK_OUT_STAGED_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      mode?: StockOutSaleMode;
      items?: unknown[];
      slipId?: string | null;
    };
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeItem).filter((item): item is StockOutQueueItem => Boolean(item))
      : [];
    if (!items.length) return null;
    return {
      id: newId("stock-out"),
      saleMode: parsed.mode === "retail" ? "retail" : "wholesale",
      billerName: "",
      billNo: "",
      slipId: parsed.slipId ? String(parsed.slipId) : null,
      openedAt: new Date().toISOString(),
      closed: false,
      items,
    };
  } catch {
    return null;
  }
}

function readStore(): Store {
  if (typeof window === "undefined") return { sessions: [] };
  try {
    const raw = localStorage.getItem(STOCK_OUT_QUEUE_STORAGE_KEY);
    if (!raw) {
      const legacy = readLegacySession();
      if (legacy) localStorage.removeItem(STOCK_OUT_STAGED_STORAGE_KEY);
      return { sessions: legacy ? [legacy] : [] };
    }
    const parsed = JSON.parse(raw) as { sessions?: unknown[] };
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions
          .map(normalizeSession)
          .filter((session): session is StockOutSession => Boolean(session))
      : [];
    return { sessions };
  } catch {
    return { sessions: [] };
  }
}

function unfinished(session: StockOutSession): StockOutQueueItem[] {
  return session.items.filter((item) => item.status !== "saved");
}

function pruneStore(store: Store): Store {
  return {
    sessions: store.sessions.flatMap((session) => {
      if (!session.closed) return [session];
      const items = unfinished(session);
      return items.length ? [{ ...session, items }] : [];
    }),
  };
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  if (!store.sessions.length) {
    localStorage.removeItem(STOCK_OUT_QUEUE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(STOCK_OUT_QUEUE_STORAGE_KEY, JSON.stringify(store));
}

function replaceSession(store: Store, sessionId: string, next: StockOutSession | null): Store {
  const sessions = store.sessions.flatMap((session) => {
    if (session.id !== sessionId) return [session];
    return next ? [next] : [];
  });
  return { sessions };
}

interface UploadBatch {
  sessionId: string;
  uploadId: string;
  slipId: string | null;
  billerName: string;
  billNo: string;
  saleMode: StockOutSaleMode;
  items: StockOutQueueItem[];
}

function pickBatch(store: Store, allowPartial: boolean): UploadBatch | null {
  for (const session of store.sessions) {
    if (!sessionReady(session)) continue;
    const retry = session.items.filter((item) => item.status === "pending" && item.uploadId);
    if (!retry.length) continue;
    const uploadId = retry[0].uploadId as string;
    return {
      sessionId: session.id,
      uploadId,
      slipId: session.slipId,
      billerName: session.billerName,
      billNo: session.billNo,
      saleMode: session.saleMode,
      items: retry.filter((item) => item.uploadId === uploadId).slice(0, STOCK_OUT_UPLOAD_BATCH_SIZE),
    };
  }

  for (const session of store.sessions) {
    if (!sessionReady(session)) continue;
    const fresh = session.items.filter((item) => item.status === "pending" && !item.uploadId);
    if (!fresh.length) continue;
    if (!allowPartial && fresh.length < STOCK_OUT_UPLOAD_BATCH_SIZE) continue;
    return {
      sessionId: session.id,
      uploadId: newId("stock-out-upload"),
      slipId: session.slipId,
      billerName: session.billerName,
      billNo: session.billNo,
      saleMode: session.saleMode,
      items: fresh.slice(0, STOCK_OUT_UPLOAD_BATCH_SIZE),
    };
  }

  return null;
}

function isRetryable(message: string): boolean {
  return /network|timeout|session expired|not logged in|staged bales|unexpected server/i.test(message);
}

function applyUploadResult(
  session: StockOutSession,
  batch: UploadBatch,
  result: MutationResult<unknown>
): StockOutSession {
  const saved = new Set(result.processedBarcodes ?? []);
  const retry = !result.success && isRetryable(result.message);
  return {
    ...session,
    slipId: result.slipId ?? session.slipId,
    items: session.items.map((item) => {
      if (!batch.items.some((row) => row.barcode === item.barcode)) return item;
      if (saved.has(item.barcode)) {
        return { ...item, status: "saved", uploadId: batch.uploadId, error: null };
      }
      if (retry || result.success) {
        return { ...item, status: "pending", uploadId: batch.uploadId, error: null };
      }
      return {
        ...item,
        status: "failed",
        uploadId: batch.uploadId,
        error: result.message || "Could not stock out this label.",
      };
    }),
  };
}

export function stockOutCounts(items: StockOutQueueItem[]): StockOutQueueCounts {
  const active = items.filter((item) => item.status !== "failed");
  return {
    scanned: active.length,
    stockedOut: items.filter((item) => item.status === "saved").length,
    sending: items.filter((item) => item.status === "pending" || item.status === "uploading").length,
  };
}

export function clubStockOutByCode(items: StockOutQueueItem[]): Array<{
  productCode: string;
  productName: string;
  size: string | null;
  bales: number;
  bags: number;
}> {
  const grouped = new Map<string, { productCode: string; productName: string; size: string | null; bales: number; bags: number }>();
  for (const item of items) {
    if (item.status === "failed") continue;
    const code = item.productCode.trim() || "—";
    const existing = grouped.get(code);
    if (!existing) {
      grouped.set(code, {
        productCode: code,
        productName: item.productName,
        size: item.size,
        bales: 1,
        bags: item.bagsQty,
      });
      continue;
    }
    existing.bales += 1;
    existing.bags += item.bagsQty;
    if (existing.size && item.size && existing.size !== item.size) existing.size = null;
  }
  return [...grouped.values()].sort((a, b) => a.productCode.localeCompare(b.productCode));
}

export function useStockOutQueue() {
  const [store, setStore] = useState<Store>({ sessions: [] });
  const storeRef = useRef<Store>({ sessions: [] });
  const flushingRef = useRef(false);
  const hydratedRef = useRef(false);

  const commit = useCallback((next: Store) => {
    const pruned = pruneStore(next);
    storeRef.current = pruned;
    setStore(pruned);
    writeStore(pruned);
  }, []);

  const flush = useCallback(async (allowPartial: boolean) => {
    if (flushingRef.current) return;
    const batch = pickBatch(storeRef.current, allowPartial);
    if (!batch) return;

    flushingRef.current = true;
    const barcodes = new Set(batch.items.map((item) => item.barcode));
    const current = storeRef.current.sessions.find((session) => session.id === batch.sessionId);
    if (!current) {
      flushingRef.current = false;
      return;
    }
    commit(
      replaceSession(storeRef.current, batch.sessionId, {
        ...current,
        items: current.items.map((item) =>
          barcodes.has(item.barcode)
            ? { ...item, status: "uploading", uploadId: batch.uploadId, error: null }
            : item
        ),
      })
    );

    const revertToPending = () => {
      const latest = storeRef.current.sessions.find((session) => session.id === batch.sessionId);
      if (!latest) return;
      commit(
        replaceSession(storeRef.current, batch.sessionId, {
          ...latest,
          items: latest.items.map((item) =>
            barcodes.has(item.barcode) && item.status === "uploading"
              ? { ...item, status: "pending", uploadId: batch.uploadId }
              : item
          ),
        })
      );
    };

    try {
      const result = await confirmStockOutSlip({
        billerName: batch.billerName,
        billNo: batch.billNo,
        saleChannel: batch.saleMode === "retail" ? "RETAIL" : "WHOLESALE",
        items: batch.items.map((item) => ({ barcode: item.barcode, bagsQty: item.bagsQty })),
        existingSlipId: batch.slipId,
        submissionId: batch.uploadId,
      });
      const latest = storeRef.current.sessions.find((session) => session.id === batch.sessionId);
      if (!latest) return;
      commit(replaceSession(storeRef.current, batch.sessionId, applyUploadResult(latest, batch, result)));
    } catch {
      revertToPending();
    } finally {
      flushingRef.current = false;
      const more = pickBatch(storeRef.current, false);
      if (more && more.uploadId !== batch.uploadId) void flush(false);
    }
  }, [commit]);

  useEffect(() => {
    const stored = pruneStore(readStore());
    storeRef.current = stored;
    setStore(stored);
    hydratedRef.current = true;
    writeStore(stored);
    void flush(true);
  }, [flush]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void flush(true);
    }, STOCK_OUT_UPLOAD_INTERVAL_MS);

    const sendCurrentBatch = () => {
      if (flushingRef.current) return;
      const batch = pickBatch(storeRef.current, true);
      if (!batch) return;
      const session = storeRef.current.sessions.find((row) => row.id === batch.sessionId);
      if (!session) return;
      const barcodes = new Set(batch.items.map((item) => item.barcode));
      commit(
        replaceSession(storeRef.current, batch.sessionId, {
          ...session,
          items: session.items.map((item) =>
            barcodes.has(item.barcode)
              ? { ...item, status: "pending", uploadId: batch.uploadId }
              : item
          ),
        })
      );
      try {
        void fetch("/api/inventory/stock-out-slip/confirm", {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billerName: batch.billerName,
            billNo: batch.billNo,
            saleChannel: batch.saleMode === "retail" ? "RETAIL" : "WHOLESALE",
            items: batch.items.map((item) => ({ barcode: item.barcode, bagsQty: item.bagsQty })),
            existingSlipId: batch.slipId,
            submissionId: batch.uploadId,
          }),
        });
      } catch {
        // The saved queue retries the same upload id when Stock Out opens again.
      }
    };

    window.addEventListener("pagehide", sendCurrentBatch);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", sendCurrentBatch);
    };
  }, [commit, flush]);

  const active = store.sessions.find((session) => !session.closed) ?? null;
  const recovery = store.sessions.filter(
    (session) => session.closed && unfinished(session).length > 0
  );

  const containsBarcode = useCallback((barcode: string) => {
    const needle = barcode.trim();
    return storeRef.current.sessions.some((session) =>
      session.items.some((item) => item.barcode === needle)
    );
  }, []);

  const startSession = useCallback(
    (input: { billerName: string; billNo: string; saleMode: StockOutSaleMode }) => {
      const billerName = input.billerName.trim();
      const billNo = input.billNo.trim();
      if (!billerName || !billNo) return false;
      const open = storeRef.current.sessions.find((session) => !session.closed);
      if (open) {
        commit(
          replaceSession(storeRef.current, open.id, {
            ...open,
            billerName,
            billNo,
            saleMode: input.saleMode,
          })
        );
      } else {
        commit({
          sessions: [
            ...storeRef.current.sessions,
            {
              id: newId("stock-out"),
              saleMode: input.saleMode,
              billerName,
              billNo,
              slipId: null,
              openedAt: new Date().toISOString(),
              closed: false,
              items: [],
            },
          ],
        });
      }
      void flush(true);
      return true;
    },
    [commit, flush]
  );

  const enqueue = useCallback(
    (item: Omit<StockOutQueueItem, "status" | "uploadId" | "error">) => {
      const open = storeRef.current.sessions.find((session) => !session.closed);
      if (!sessionReady(open)) return false;
      const barcode = item.barcode.trim();
      if (containsBarcode(barcode)) return false;
      commit(
        replaceSession(storeRef.current, open.id, {
          ...open,
          items: [
            ...open.items,
            { ...item, barcode, status: "pending", uploadId: null, error: null },
          ],
        })
      );
      const pending = (storeRef.current.sessions.find((session) => session.id === open.id)?.items ?? [])
        .filter((row) => row.status === "pending" && !row.uploadId);
      if (pending.length >= STOCK_OUT_UPLOAD_BATCH_SIZE) void flush(false);
      return true;
    },
    [commit, containsBarcode, flush]
  );

  const closeActive = useCallback(() => {
    const open = storeRef.current.sessions.find((session) => !session.closed);
    if (!open) return;
    commit(replaceSession(storeRef.current, open.id, { ...open, closed: true }));
  }, [commit]);

  const discardActive = useCallback(() => {
    const open = storeRef.current.sessions.find((session) => !session.closed);
    if (!open) return;
    commit(replaceSession(storeRef.current, open.id, null));
  }, [commit]);

  return {
    hydrated: hydratedRef.current || store.sessions.length > 0,
    active,
    ready: sessionReady(active),
    recovery,
    items: active?.items ?? EMPTY_ITEMS,
    counts: stockOutCounts(active?.items ?? EMPTY_ITEMS),
    containsBarcode,
    startSession,
    enqueue,
    closeActive,
    discardActive,
  };
}
