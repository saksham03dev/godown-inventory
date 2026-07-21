"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BatchCreateForm } from "@/components/labels/BatchCreateForm";
import { LabelSheet } from "@/components/labels/LabelSheet";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useLabels } from "@/hooks/useLabels";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { balesToBags } from "@/lib/utils/inventory";
import type { LabelSize } from "@/lib/types/database";

const labelSizes: { value: LabelSize; label: string }[] = [
  { value: "square", label: "4×4 in (100×100 mm)" },
  { value: "wide", label: "3×5 in (75×125 mm)" },
];

export default function LabelsPage() {
  const {
    products,
    batches,
    activeBatch,
    loading,
    creating,
    error,
    alert,
    createBatch,
    loadBatch,
    dismissAlert,
  } = useLabels();

  const [labelSize, setLabelSize] = useState<LabelSize>("square");

  const handlePrint = () => window.print();

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Label Printing" subtitle="Batch barcode labels">
        <AlertBanner
          alert={{
            type: "info",
            message: "Configure Supabase in .env.local to use label printing.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Label Printing"
      subtitle="Create unique unit barcodes per batch and print stock-in labels"
      actions={
        activeBatch ? (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-xl bg-labels px-3 py-2 text-sm font-medium text-white hover:bg-labels-muted"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print Labels</span>
          </button>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
        <div className="rounded-xl border border-labels/20 bg-labels/5 px-4 py-3 text-sm text-zinc-400">
          <span className="font-medium text-labels">Label printing</span> — pick a
          registered product, generate bale barcodes, then print and stock in.
        </div>

        {alert && <AlertBanner alert={alert} onDismiss={dismissAlert} />}

        {loading ? (
          <LoadingSpinner label="Loading products…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <BatchCreateForm
              products={products}
              loading={creating}
              onSubmit={createBatch}
            />

            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
                <h3 className="font-medium text-zinc-100">Label Size</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {labelSizes.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setLabelSize(s.value)}
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                        labelSize === s.value
                          ? "bg-labels/15 text-labels"
                          : "border border-surface-border text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
                <h3 className="mb-3 font-medium text-zinc-100">Recent Batches</h3>
                {batches.length === 0 ? (
                  <p className="text-sm text-zinc-500">No batches yet</p>
                ) : (
                  <ul className="space-y-2">
                    {batches.map((b) => (
                      <li key={b.id}>
                        <button
                          onClick={() => loadBatch(b.id)}
                          className="w-full rounded-xl border border-surface-border px-3 py-2.5 text-left text-sm transition hover:bg-white/5"
                        >
                          <span className="font-mono text-labels">{b.batch_code}</span>
                          <span className="ml-2 text-zinc-400">
                            · {b.quantity} bale{b.quantity === 1 ? "" : "s"} (
                            {balesToBags(b.quantity).toLocaleString()} bags)
                            {b.source_name ? ` · ${b.source_name}` : ""}
                            {b.purchase_no ? ` · PO ${b.purchase_no}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {activeBatch && activeBatch.stock_units?.length > 0 && (
          <div className="rounded-2xl border border-labels/20 bg-surface-overlay p-4 ring-1 ring-labels/10">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-zinc-100">
                  Batch {activeBatch.batch_code}
                </h3>
                <p className="text-xs text-zinc-500">
                  {activeBatch.products?.name}
                  {activeBatch.source_name
                    ? ` · Source: ${activeBatch.source_name}`
                    : ""}
                  {activeBatch.purchase_no
                    ? ` · Purchase no.: ${activeBatch.purchase_no}`
                    : ""}{" "}
                  · {activeBatch.stock_units.length} bale label
                  {activeBatch.stock_units.length === 1 ? "" : "s"} (
                  {balesToBags(activeBatch.stock_units.length).toLocaleString()}{" "}
                  bags)
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
            <LabelSheet
              units={activeBatch.stock_units}
              productName={activeBatch.products?.name ?? "Product"}
              productCode={activeBatch.products?.product_code ?? ""}
              productSize={activeBatch.products?.size}
              description={
                activeBatch.notes?.trim() ||
                activeBatch.products?.special_note ||
                null
              }
              batchCode={activeBatch.batch_code}
              labelSize={labelSize}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
