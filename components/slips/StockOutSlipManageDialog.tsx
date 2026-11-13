"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Printer, Save, Trash2, X } from "lucide-react";
import { AddSlipGoodsDialog } from "@/components/slips/AddSlipGoodsDialog";
import { StockOutSlipPrintView } from "@/components/slips/StockOutSlipPrintView";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchStockOutSlip,
  updateStockOutSlip,
} from "@/lib/services/stockOutSlipService";
import type { StockOutSlipWithDetails } from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60";

interface StockOutSlipManageDialogProps {
  open: boolean;
  slipId: string | null;
  initialSlip?: StockOutSlipWithDetails | null;
  onClose: () => void;
  onUpdated: (slip: StockOutSlipWithDetails) => void;
}

export function StockOutSlipManageDialog({
  open,
  slipId,
  initialSlip,
  onClose,
  onUpdated,
}: StockOutSlipManageDialogProps) {
  const { can } = useAuth();
  const canEdit = can("slips.edit");

  const [slip, setSlip] = useState<StockOutSlipWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editBiller, setEditBiller] = useState("");
  const [editBillNo, setEditBillNo] = useState("");
  const [editBags, setEditBags] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeProductId, setRemoveProductId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const applySlip = useCallback((next: StockOutSlipWithDetails) => {
    setSlip(next);
    setEditBiller(next.biller_name ?? "");
    setEditBillNo(next.bill_no ?? "");
    setEditBags(
      Object.fromEntries(
        next.stock_out_slip_units.map((u) => [
          u.id,
          String(Math.round(u.bags_moved)),
        ])
      )
    );
    setSaveMessage(null);
  }, []);

  useEffect(() => {
    if (!open || !slipId) {
      setSlip(null);
      setLoadError(null);
      return;
    }
    if (initialSlip?.id === slipId) {
      applySlip(initialSlip);
      return;
    }
    setLoading(true);
    setLoadError(null);
    void fetchStockOutSlip(slipId)
      .then(applySlip)
      .catch((err) => {
        setSlip(null);
        setLoadError(err instanceof Error ? err.message : "Could not load slip.");
      })
      .finally(() => setLoading(false));
  }, [open, slipId, initialSlip, applySlip]);

  const handleSave = async () => {
    if (!slip || !canEdit) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const unitEdits = slip.stock_out_slip_units
        .map((u) => {
          const next = Math.floor(Number(editBags[u.id]));
          return { id: u.id, bagsMoved: next, prev: Math.round(u.bags_moved) };
        })
        .filter((u) => Number.isFinite(u.bagsMoved) && u.bagsMoved !== u.prev)
        .map(({ id, bagsMoved }) => ({ id, bagsMoved }));

      const result = await updateStockOutSlip({
        id: slip.id,
        billerName: editBiller,
        billNo: editBillNo,
        units: unitEdits.length > 0 ? unitEdits : undefined,
      });
      if (!result.success || !result.data) {
        setSaveMessage(result.message);
        return;
      }
      applySlip(result.data);
      onUpdated(result.data);
      setSaveMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProduct = async () => {
    if (!slip || !removeProductId || !canEdit) return;
    setRemoving(true);
    setSaveMessage(null);
    try {
      const result = await updateStockOutSlip({
        id: slip.id,
        removeProductId,
      });
      if (!result.success || !result.data) {
        setSaveMessage(result.message);
        return;
      }
      applySlip(result.data);
      onUpdated(result.data);
      setSaveMessage("Product returned to stock.");
      setRemoveProductId(null);
    } finally {
      setRemoving(false);
    }
  };

  const title =
    slip?.bill_no?.trim() ||
    slip?.biller_name?.trim() ||
    "Stock-out slip";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        description={
          slip
            ? `${slip.sale_channel} · ${Math.round(slip.total_bags)} bags`
            : undefined
        }
        size="xl"
        preserveNav
      >
        {loading ? (
          <LoadingSpinner label="Loading slip…" />
        ) : loadError ? (
          <p className="text-sm text-danger">{loadError}</p>
        ) : !slip ? (
          <p className="text-sm text-zinc-500">Slip not found.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-muted"
                  >
                    <Plus className="h-4 w-4" />
                    Add bale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                </>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-surface-border bg-white">
              <StockOutSlipPrintView slip={slip} />
            </div>

            {canEdit ? (
              <div className="space-y-3 rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Biller name</span>
                    <input
                      className={inputClass}
                      value={editBiller}
                      onChange={(e) => setEditBiller(e.target.value)}
                      disabled={saving}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-zinc-400">Bill No</span>
                    <input
                      className={inputClass}
                      value={editBillNo}
                      onChange={(e) => setEditBillNo(e.target.value)}
                      disabled={saving}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {saveMessage ? (
                    <span className="text-xs text-zinc-400">{saveMessage}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <ul className="space-y-3">
              {slip.stock_out_slip_lines.map((line) => {
                const lineUnits = slip.stock_out_slip_units
                  .filter((u) => u.product_id === line.product_id)
                  .sort((a, b) => a.unit_number - b.unit_number);
                return (
                  <li
                    key={line.id}
                    className="rounded-xl border border-surface-border px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold tabular-nums text-zinc-100">
                          {line.products?.product_code ?? "—"}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {[
                            line.products?.size?.trim()
                              ? `Size ${line.products.size.trim()}`
                              : null,
                            line.products?.name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-lg bg-danger/15 px-2.5 py-1 text-sm font-semibold tabular-nums text-danger">
                          {Math.round(line.bag_count)}
                        </span>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setRemoveProductId(line.product_id)}
                            disabled={saving || removing}
                            className="inline-flex items-center gap-1 rounded-lg border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {lineUnits.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-surface-border pt-3">
                        {lineUnits.map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-xs text-zinc-500">
                              Bale #{u.unit_number}
                            </span>
                            {canEdit ? (
                              <label className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={1000}
                                  inputMode="numeric"
                                  className="w-24 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-right text-sm tabular-nums text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
                                  value={editBags[u.id] ?? ""}
                                  onChange={(e) =>
                                    setEditBags((prev) => ({
                                      ...prev,
                                      [u.id]: e.target.value,
                                    }))
                                  }
                                  disabled={saving}
                                />
                                <span className="text-xs text-zinc-500">bags</span>
                              </label>
                            ) : (
                              <span className="text-sm tabular-nums text-zinc-200">
                                {Math.round(u.bags_moved)} bags
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>

      {slip && canEdit ? (
        <AddSlipGoodsDialog
          open={addOpen}
          slipId={slip.id}
          onClose={() => setAddOpen(false)}
          onAdded={(next) => {
            applySlip(next);
            onUpdated(next);
            setAddOpen(false);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(removeProductId)}
        onClose={() => {
          if (!removing) setRemoveProductId(null);
        }}
        onConfirm={() => void handleRemoveProduct()}
        title="Remove this product?"
        message="Every bale of this product leaves the bill and returns to warehouse stock."
        confirmLabel="Remove and restock"
        loading={removing}
        destructive
      />

      {printOpen && slip ? (
        <div className="fixed inset-0 z-[60] overflow-auto bg-white print:static print:z-auto">
          <div className="flex justify-end gap-2 p-4 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={() => setPrintOpen(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
          <StockOutSlipPrintView slip={slip} />
        </div>
      ) : null}
    </>
  );
}
