"use client";

import { useState } from "react";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import type { Product } from "@/lib/types/database";

interface BatchCreateFormProps {
  products: Product[];
  loading?: boolean;
  onSubmit: (input: {
    product_id: string;
    source_name?: string | null;
    purchase_no?: string | null;
    quantity: number;
    notes?: string;
  }) => Promise<unknown>;
}

export function BatchCreateForm({
  products,
  loading,
  onSubmit,
}: BatchCreateFormProps) {
  const [productId, setProductId] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [purchaseNo, setPurchaseNo] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState("");

  const options: DropdownOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.product_code})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    await onSubmit({
      product_id: productId,
      source_name: sourceName.trim() || null,
      purchase_no: purchaseNo.trim() || null,
      quantity,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-labels/25 bg-labels/5 p-5 space-y-4 ring-1 ring-labels/10"
    >
      <div>
        <span className="mb-2 inline-block rounded-lg bg-labels/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-labels">
          Label printing
        </span>
        <h3 className="font-medium text-zinc-100">Create Label Batch</h3>
        <p className="text-xs text-zinc-500">
          Product bought from a source → generate unique barcodes per unit
        </p>
      </div>

      <Dropdown
        label="Registered Product"
        options={options}
        value={productId}
        onChange={setProductId}
        placeholder="Select product…"
        disabled={loading}
      />

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
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-labels"
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
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-labels"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Batch Quantity *
        </label>
        <input
          type="number"
          required
          min={1}
          max={500}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-labels"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-zinc-600">
          Each unit gets a unique scannable barcode (max 500 per batch)
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
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-labels"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !productId}
        className="w-full rounded-xl bg-labels py-3 text-sm font-medium text-white transition hover:bg-labels-muted disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Barcode Labels"}
      </button>
    </form>
  );
}
