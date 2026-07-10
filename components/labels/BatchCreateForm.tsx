"use client";

import { useState } from "react";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import type { Product } from "@/lib/types/database";

interface BatchCreateFormProps {
  products: Product[];
  loading?: boolean;
  onSubmit: (input: {
    product_id: string;
    source_name: string;
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
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState("");

  const options: DropdownOption[] = products.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.product_code})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !sourceName.trim()) return;
    await onSubmit({
      product_id: productId,
      source_name: sourceName.trim(),
      quantity,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-surface-border bg-surface-raised p-5 space-y-4"
    >
      <div>
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
          Batch Quantity *
        </label>
        <input
          type="number"
          required
          min={1}
          max={500}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
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
          placeholder="Optional purchase reference"
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !productId || !sourceName.trim()}
        className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Barcode Labels"}
      </button>
    </form>
  );
}
