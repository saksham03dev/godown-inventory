"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Pencil,
} from "lucide-react";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import {
  fetchProductGodownBreakdown,
  updateStockBatch,
} from "@/lib/services/batchService";
import type {
  AlertState,
  GodownStockItem,
  ProductGodownBatchGroup,
  ProductGodownBreakdown,
  StockBatch,
  StockUnit,
  UpdateBatchInput,
} from "@/lib/types/database";

type View =
  | { level: "sources" }
  | { level: "skus"; group: ProductGodownBatchGroup }
  | { level: "sku"; group: ProductGodownBatchGroup; unit: StockUnit }
  | { level: "edit"; group: ProductGodownBatchGroup };

interface ProductInventoryDetailProps {
  open: boolean;
  onClose: () => void;
  product: GodownStockItem | null;
  godownId: string;
  godownName: string;
  canEditBatch?: boolean;
}

export function ProductInventoryDetail({
  open,
  onClose,
  product,
  godownId,
  godownName,
  canEditBatch = false,
}: ProductInventoryDetailProps) {
  const [breakdown, setBreakdown] = useState<ProductGodownBreakdown | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [view, setView] = useState<View>({ level: "sources" });

  const load = useCallback(async () => {
    if (!product || !godownId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductGodownBreakdown(
        product.product_id,
        godownId
      );
      setBreakdown(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load product breakdown"
      );
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  }, [product, godownId]);

  useEffect(() => {
    if (!open) return;
    setView({ level: "sources" });
    setAlert(null);
    load();
  }, [open, load]);

  const handleSaveBatch = async (batchId: string, input: UpdateBatchInput) => {
    setMutating(true);
    setAlert(null);
    const result = await updateStockBatch(batchId, input);
    if (result.success) {
      setAlert({ type: "success", message: result.message });
      await load();
      setView({ level: "sources" });
    } else {
      setAlert({ type: "error", message: result.message });
    }
    setMutating(false);
  };

  const title = product?.product_name ?? "Product";
  const description =
    view.level === "sources"
      ? `${godownName} · qty ${product?.quantity ?? 0} · by source`
      : view.level === "skus"
        ? `${view.group.batch.source_name} · ${view.group.in_godown_count} SKU(s)`
        : view.level === "sku"
          ? `Unit #${view.unit.unit_number}`
          : `Edit batch ${view.group.batch.batch_code}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="xl"
    >
      <div className="space-y-4">
        {alert && (
          <AlertBanner alert={alert} onDismiss={() => setAlert(null)} />
        )}

        {view.level !== "sources" && (
          <button
            type="button"
            onClick={() => {
              if (view.level === "sku") {
                setView({ level: "skus", group: view.group });
              } else {
                setView({ level: "sources" });
              }
            }}
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {loading ? (
          <LoadingSpinner label="Loading source breakdown…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : view.level === "sources" ? (
          <SourcesView
            product={product}
            breakdown={breakdown}
            onSelect={(group) => setView({ level: "skus", group })}
            onEdit={
              canEditBatch
                ? (group) => setView({ level: "edit", group })
                : undefined
            }
          />
        ) : view.level === "skus" ? (
          <SkusView
            group={view.group}
            onSelect={(unit) =>
              setView({ level: "sku", group: view.group, unit })
            }
            onEdit={
              canEditBatch
                ? () => setView({ level: "edit", group: view.group })
                : undefined
            }
          />
        ) : view.level === "sku" ? (
          <LabelDetailCard unit={view.unit} />
        ) : (
          <BatchEditForm
            batch={view.group.batch}
            productName={product?.product_name ?? ""}
            productCode={product?.product_code ?? ""}
            inGodownCount={view.group.in_godown_count}
            loading={mutating}
            onSubmit={(input) => handleSaveBatch(view.group.batch.id, input)}
            onCancel={() => setView({ level: "sources" })}
          />
        )}
      </div>
    </Modal>
  );
}

function SourcesView({
  product,
  breakdown,
  onSelect,
  onEdit,
}: {
  product: GodownStockItem | null;
  breakdown: ProductGodownBreakdown | null;
  onSelect: (group: ProductGodownBatchGroup) => void;
  onEdit?: (group: ProductGodownBatchGroup) => void;
}) {
  if (!breakdown || breakdown.batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-overlay/40 p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          No labelled unit SKUs stocked in for this product.
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Ledger quantity is {product?.quantity ?? 0}. Bulk product-barcode
          stock-ins won&apos;t appear here until units are labelled and scanned
          in.
        </p>
      </div>
    );
  }

  const bySource = new Map<string, ProductGodownBatchGroup[]>();
  for (const group of breakdown.batches) {
    const key = group.batch.source_name;
    const list = bySource.get(key) ?? [];
    list.push(group);
    bySource.set(key, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            In this godown
          </p>
          <p className="text-sm text-zinc-300">
            <span className="font-semibold text-accent">
              {breakdown.total_units}
            </span>{" "}
            labelled SKU(s) · ledger qty{" "}
            <span className="font-medium text-zinc-200">
              {product?.quantity ?? 0}
            </span>
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          {product?.product_code}
        </p>
      </div>

      <div className="space-y-3">
        {Array.from(bySource.entries()).map(([source, groups]) => {
          const sourceTotal = groups.reduce(
            (sum, g) => sum + g.in_godown_count,
            0
          );
          return (
            <div key={source} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-medium text-zinc-200">{source}</h3>
                <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                  {sourceTotal}
                </span>
              </div>
              <ul className="space-y-1.5">
                {groups.map((group) => (
                  <li key={group.batch.id}>
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(group)}
                        className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-accent">
                            {group.batch.batch_code}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            Batch size {group.batch.quantity}
                            {group.batch.notes
                              ? ` · ${group.batch.notes}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-200">
                            {group.in_godown_count}
                          </span>
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        </div>
                      </button>
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(group)}
                          className="rounded-xl border border-surface-border px-3 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
                          aria-label={`Edit batch ${group.batch.batch_code}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkusView({
  group,
  onSelect,
  onEdit,
}: {
  group: ProductGodownBatchGroup;
  onSelect: (unit: StockUnit) => void;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {group.batch.source_name}
          </p>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            {group.batch.batch_code}
            {group.batch.notes ? ` · ${group.batch.notes}` : ""}
          </p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-xl border border-surface-border px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit batch
          </button>
        )}
      </div>

      <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border">
        {group.units.map((unit) => (
          <li key={unit.id}>
            <button
              type="button"
              onClick={() => onSelect(unit)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  Unit #{unit.unit_number}
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                  {unit.unit_barcode}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {unit.stocked_in_at
                    ? new Date(unit.stocked_in_at).toLocaleDateString()
                    : "—"}
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BatchEditForm({
  batch,
  productName,
  productCode,
  inGodownCount,
  loading,
  onSubmit,
  onCancel,
}: {
  batch: StockBatch;
  productName: string;
  productCode: string;
  inGodownCount: number;
  loading?: boolean;
  onSubmit: (input: UpdateBatchInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [sourceName, setSourceName] = useState(batch.source_name);
  const [notes, setNotes] = useState(batch.notes ?? "");

  useEffect(() => {
    setSourceName(batch.source_name);
    setNotes(batch.notes ?? "");
  }, [batch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim()) return;
    await onSubmit({
      source_name: sourceName.trim(),
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-zinc-500">
        Same fields as label batch creation. Product and quantity stay fixed
        after labels are generated.
      </p>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Registered Product
        </label>
        <input
          type="text"
          value={`${productName} (${productCode})`}
          disabled
          className="w-full rounded-xl border border-surface-border bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400 outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Source / Buyer *
        </label>
        <input
          type="text"
          required
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="e.g. Anand Traders, Mumbai"
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Batch Quantity
        </label>
        <input
          type="text"
          value={`${batch.quantity} labelled · ${inGodownCount} in this godown`}
          disabled
          className="w-full rounded-xl border border-surface-border bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400 outline-none"
        />
        <p className="mt-1 text-xs text-zinc-600">
          Quantity is set when labels are printed and cannot be changed here.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Batch Notes
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional purchase reference"
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
          disabled={loading}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-xl border border-surface-border py-3 text-sm text-zinc-400 transition hover:bg-white/5 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !sourceName.trim()}
          className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Batch"}
        </button>
      </div>
    </form>
  );
}
