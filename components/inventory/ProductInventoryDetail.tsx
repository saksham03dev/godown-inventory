"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Package,
  Pencil,
} from "lucide-react";
import { LabelDetailCard } from "@/components/scan/LabelDetailCard";
import { OpenBaleBadge, OpenBaleCountBadge } from "@/components/inventory/OpenBaleBadge";
import { GodownRelocateDialog } from "@/components/inventory/GodownRelocateDialog";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { BAGS_PER_BALE } from "@/lib/constants/inventory";
import {
  fetchProductGodownBreakdown,
  updateStockBatch,
} from "@/lib/services/batchService";
import { isSealedBale } from "@/lib/utils/inventory";
import type {
  AlertState,
  Godown,
  GodownStockItem,
  ProductGodownBatchGroup,
  ProductGodownBreakdown,
  StockBatch,
  StockUnit,
  UpdateBatchInput,
} from "@/lib/types/database";

type View =
  | { level: "pick_godown" }
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
  godowns: Godown[];
  canEditBatch?: boolean;
  canRelocate?: boolean;
  onGodownPicked?: (godownId: string, godownName: string) => void;
  onInventoryChanged?: () => void;
}

export function ProductInventoryDetail({
  open,
  onClose,
  product,
  godownId,
  godownName,
  godowns,
  canEditBatch = false,
  canRelocate = false,
  onGodownPicked,
  onInventoryChanged,
}: ProductInventoryDetailProps) {
  const [breakdown, setBreakdown] = useState<ProductGodownBreakdown | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [view, setView] = useState<View>({ level: "sources" });
  const [relocateOpen, setRelocateOpen] = useState(false);

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
    if (!open || !product) return;

    const needsGodownPick =
      Boolean(product.locations && product.locations.length > 1) && !godownId;

    if (needsGodownPick) {
      setView({ level: "pick_godown" });
      setBreakdown(null);
      setError(null);
      setAlert(null);
      setRelocateOpen(false);
      return;
    }

    setView({ level: "sources" });
    setAlert(null);
    setRelocateOpen(false);
    load();
  }, [open, product, godownId, load]);

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

  const sizeLabel = product?.size?.trim() || null;
  const title = product?.product_name ?? "Product";
  const description =
    view.level === "pick_godown"
      ? [
          product?.product_code,
          sizeLabel ? `Size ${sizeLabel}` : null,
          "Choose a godown to view bales",
        ]
          .filter(Boolean)
          .join(" · ")
      : view.level === "sources"
      ? [
          product?.product_code,
          sizeLabel ? `Size ${sizeLabel}` : null,
          godownName,
          `${(product?.quantity ?? 0).toLocaleString()} bags · by source`,
        ]
          .filter(Boolean)
          .join(" · ")
      : view.level === "skus"
        ? `${view.group.batch.source_name} · ${view.group.in_godown_bags.toLocaleString()} bags (${view.group.in_godown_bales} bale(s)${view.group.open_bales > 0 ? `, ${view.group.open_bales} open` : ""})`
        : view.level === "sku"
          ? `Bale #${view.unit.unit_number}`
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

        {view.level !== "sources" && view.level !== "pick_godown" && (
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
        ) : view.level === "pick_godown" ? (
          <GodownPickerView
            product={product}
            onSelect={(godownId, godownName) => {
              onGodownPicked?.(godownId, godownName);
            }}
          />
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
            productSize={sizeLabel}
            productCode={product?.product_code ?? null}
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
          <div className="space-y-4">
            <LabelDetailCard unit={view.unit} showBatchInboundMeta />
            {canRelocate &&
              view.unit.status === "STOCKED_IN" &&
              view.unit.godown_id && (
                <button
                  type="button"
                  onClick={() => setRelocateOpen(true)}
                  className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/15"
                >
                  Correct godown location
                </button>
              )}
          </div>
        ) : (
          <BatchEditForm
            batch={view.group.batch}
            productName={product?.product_name ?? ""}
            productCode={product?.product_code ?? ""}
            inGodownCount={view.group.in_godown_bales}
            loading={mutating}
            onSubmit={(input) => handleSaveBatch(view.group.batch.id, input)}
            onCancel={() => setView({ level: "sources" })}
          />
        )}
      </div>

      <GodownRelocateDialog
        open={relocateOpen}
        unit={view.level === "sku" ? view.unit : null}
        currentGodownId={godownId}
        currentGodownName={godownName}
        godowns={godowns}
        onClose={() => setRelocateOpen(false)}
        onSuccess={() => {
          setAlert({
            type: "success",
            message: "Bale moved to the correct godown.",
          });
          onInventoryChanged?.();
          onClose();
        }}
      />
    </Modal>
  );
}

function GodownPickerView({
  product,
  onSelect,
}: {
  product: GodownStockItem | null;
  onSelect: (godownId: string, godownName: string) => void;
}) {
  const locations = product?.locations ?? [];

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-overlay/40 p-8 text-center">
        <Package className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">
          No godown locations found for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        This SKU is stocked in multiple godowns. Pick one to view bales and
        batches.
      </p>
      <ul className="space-y-2">
        {locations.map((loc) => (
          <li key={loc.godown_id}>
            <button
              type="button"
              onClick={() => onSelect(loc.godown_id, loc.godown_name)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-left transition hover:border-accent/40 hover:bg-accent/5"
            >
              <span className="font-medium text-zinc-200">{loc.godown_name}</span>
              <div className="flex items-center gap-2">
                <OpenBaleCountBadge count={loc.open_bales} />
                <span className="text-sm font-semibold text-accent">
                  {loc.quantity.toLocaleString()} bags
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
          No stocked-in unit SKUs in this godown for this product.
        </p>
      </div>
    );
  }

  const bySource = new Map<string, ProductGodownBatchGroup[]>();
  for (const group of breakdown.batches) {
    const key = group.batch.source_name ?? "";
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
              {breakdown.total_bags.toLocaleString()}
            </span>{" "}
            bags ({breakdown.total_bales} bale label
            {breakdown.total_bales === 1 ? "" : "s"})
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <OpenBaleCountBadge
            count={breakdown.batches.reduce((sum, g) => sum + g.open_bales, 0)}
          />
          {product?.size ? (
            <span className="rounded-lg bg-zinc-100/10 px-2.5 py-1 text-xs font-semibold text-zinc-100">
              Size {product.size}
            </span>
          ) : null}
          <span className="rounded-lg bg-accent/10 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
            {product?.product_code}
          </span>
          {product?.quality ? (
            <span className="text-xs text-zinc-600">{product.quality}</span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {Array.from(bySource.entries()).map(([source, groups]) => {
          const sourceTotal = groups.reduce(
            (sum, g) => sum + g.in_godown_bags,
            0
          );
          return (
            <div key={source} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-medium text-zinc-200">{source}</h3>
                <span className="rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                  {sourceTotal.toLocaleString()} bags
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
                          <OpenBaleCountBadge count={group.open_bales} />
                          <span className="text-sm font-semibold text-zinc-200">
                            {group.in_godown_bags.toLocaleString()}
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
  productSize,
  productCode,
  onSelect,
  onEdit,
}: {
  group: ProductGodownBatchGroup;
  productSize?: string | null;
  productCode?: string | null;
  onSelect: (unit: StockUnit) => void;
  onEdit?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-overlay/40 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-zinc-200">
              {group.batch.source_name}
            </p>
            {productCode ? (
              <span className="rounded-lg bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                {productCode}
              </span>
            ) : null}
            {productSize ? (
              <span className="rounded-lg bg-zinc-100/10 px-2 py-0.5 text-xs font-semibold text-zinc-100">
                Size {productSize}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            {group.batch.batch_code}
            {group.batch.purchase_no ? ` · ${group.batch.purchase_no}` : ""}
            {group.batch.notes ? ` · ${group.batch.notes}` : ""}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {group.in_godown_bags.toLocaleString()} bags · {group.in_godown_bales}{" "}
            bale{group.in_godown_bales === 1 ? "" : "s"}
            {group.open_bales > 0 ? (
              <>
                {" "}
                · <OpenBaleCountBadge count={group.open_bales} />
              </>
            ) : null}
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
                  Bale #{unit.unit_number}{" "}
                  <OpenBaleBadge
                    remainingBags={unit.remaining_bags}
                    className="ml-1 align-middle"
                  />
                  {isSealedBale(unit.remaining_bags) && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      Sealed · {BAGS_PER_BALE.toLocaleString()} bags
                    </span>
                  )}
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
  const [sourceName, setSourceName] = useState(batch.source_name ?? "");
  const [purchaseNo, setPurchaseNo] = useState(batch.purchase_no ?? "");
  const [notes, setNotes] = useState(batch.notes ?? "");

  useEffect(() => {
    setSourceName(batch.source_name ?? "");
    setPurchaseNo(batch.purchase_no ?? "");
    setNotes(batch.notes ?? "");
  }, [batch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      source_name: sourceName.trim() || null,
      purchase_no: purchaseNo.trim() || null,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Source / Buyer
          </label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="e.g. Anand Traders, Mumbai"
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
            disabled={loading}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Purchase No.
          </label>
          <input
            type="text"
            value={purchaseNo}
            onChange={(e) => setPurchaseNo(e.target.value)}
            placeholder="e.g. PO-2026-0142"
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Batch Quantity
        </label>
        <input
          type="text"
          value={`${batch.quantity} bale label${batch.quantity === 1 ? "" : "s"} · ${inGodownCount} bale${inGodownCount === 1 ? "" : "s"} in this godown`}
          disabled
          className="w-full rounded-xl border border-surface-border bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400 outline-none"
        />
        <p className="mt-1 text-xs text-zinc-600">
          Set when labels are printed.
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
          placeholder="Optional extra notes"
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
          disabled={loading}
          className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save Batch"}
        </button>
      </div>
    </form>
  );
}
