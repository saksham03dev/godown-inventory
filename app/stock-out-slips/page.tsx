"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, RefreshCw, Save, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StockOutSlipPrintView } from "@/components/slips/StockOutSlipPrintView";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchStockOutSlips,
  updateStockOutSlip,
} from "@/lib/services/stockOutSlipService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { StockOutSlipWithDetails } from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60";

function formatWhen(ts: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export default function StockOutSlipsPage() {
  const { can } = useAuth();
  const canEdit = can("slips.edit");

  const [slips, setSlips] = useState<StockOutSlipWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editBiller, setEditBiller] = useState("");
  const [editBillNo, setEditBillNo] = useState("");
  const [editBags, setEditBags] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockOutSlips(80);
      setSlips(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => slips.find((s) => s.id === selectedId) ?? null,
    [slips, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    setEditBiller(selected.biller_name ?? "");
    setEditBillNo(selected.bill_no ?? "");
    setEditBags(
      Object.fromEntries(
        selected.stock_out_slip_units.map((u) => [
          u.id,
          String(Math.round(u.bags_moved)),
        ])
      )
    );
    setSaveMessage(null);
  }, [selected]);

  const handleSave = async () => {
    if (!selected || !canEdit) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const unitEdits = selected.stock_out_slip_units
        .map((u) => {
          const next = Math.floor(Number(editBags[u.id]));
          return { id: u.id, bagsMoved: next, prev: Math.round(u.bags_moved) };
        })
        .filter((u) => Number.isFinite(u.bagsMoved) && u.bagsMoved !== u.prev)
        .map(({ id, bagsMoved }) => ({ id, bagsMoved }));

      const result = await updateStockOutSlip({
        id: selected.id,
        billerName: editBiller,
        billNo: editBillNo,
        units: unitEdits.length > 0 ? unitEdits : undefined,
      });
      if (!result.success || !result.data) {
        setSaveMessage(result.message);
        return;
      }
      setSlips((prev) =>
        prev.map((s) => (s.id === result.data!.id ? result.data! : s))
      );
      setSaveMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    setPrintOpen(true);
    setTimeout(() => window.print(), 200);
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Stock Out Slips">
        <AlertBanner
          alert={{
            type: "info",
            message: "Configure Supabase in .env.local to view slips.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Stock Out Slips"
      subtitle="Session stock-outs with optional biller and bill no"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        {error && (
          <AlertBanner
            alert={{ type: "error", message: error }}
            onDismiss={() => setError(null)}
          />
        )}

        {loading ? (
          <LoadingSpinner label="Loading slips…" />
        ) : slips.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-8 text-center text-sm text-zinc-500">
            No stock-out slips yet. Confirm a stock-out session to create one.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ul className="divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
              {slips.map((slip) => {
                const active = slip.id === selectedId;
                return (
                  <li key={slip.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(slip.id)}
                      className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.03] ${
                        active ? "bg-accent/10" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {slip.biller_name?.trim() || "No biller"}
                            {slip.bill_no?.trim()
                              ? ` · ${slip.bill_no.trim()}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {slip.sale_channel} · {formatWhen(slip.confirmed_at)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold tabular-nums text-zinc-200">
                          {Math.round(slip.total_bags)} bags
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-600">
                        {slip.stock_out_slip_lines
                          .map(
                            (l) =>
                              l.products?.product_code ??
                              l.products?.name ??
                              "SKU"
                          )
                          .join(", ")}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
              {!selected ? (
                <p className="text-sm text-zinc-500">
                  Select a slip to view details.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-zinc-500">
                        {selected.sale_channel}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100">
                        {Math.round(selected.total_bags)} bags
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatWhen(selected.confirmed_at)}
                        {selected.created_by_label
                          ? ` · ${selected.created_by_label}`
                          : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                    )}
                  </div>

                  {canEdit ? (
                    <div className="space-y-3 rounded-xl border border-surface-border bg-surface-overlay/40 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-xs text-zinc-400">
                            Biller name
                          </span>
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
                      <p className="text-[11px] text-zinc-500">
                        Fix a wrong bag qty on a bale below (e.g. 1000 → 500). Extra
                        bags go back to warehouse stock.
                      </p>
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
                        {saveMessage && (
                          <span className="text-xs text-zinc-400">
                            {saveMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-zinc-500">Biller: </span>
                        {selected.biller_name?.trim() || "—"}
                      </p>
                      <p>
                        <span className="text-zinc-500">Bill No: </span>
                        {selected.bill_no?.trim() || "—"}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-3">
                    {selected.stock_out_slip_lines.map((line) => {
                      const lineUnits = selected.stock_out_slip_units
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
                            <span className="shrink-0 rounded-lg bg-danger/15 px-2.5 py-1 text-sm font-semibold tabular-nums text-danger">
                              {Math.round(line.bag_count)}
                            </span>
                          </div>
                          {lineUnits.length > 0 && (
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
                                      <span className="text-xs text-zinc-500">
                                        bags
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="text-sm tabular-nums text-zinc-200">
                                      {Math.round(u.bags_moved)} bags
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {printOpen && selected && (
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
          <StockOutSlipPrintView slip={selected} />
        </div>
      )}
    </DashboardLayout>
  );
}
