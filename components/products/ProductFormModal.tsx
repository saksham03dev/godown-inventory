"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getBarcodePreview } from "@/lib/services/productService";
import type { Product, ProductInput } from "@/lib/types/database";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<unknown>;
  product?: Product | null;
  loading?: boolean;
  canEditPrice?: boolean;
}

const emptyForm: ProductInput = {
  name: "",
  product_code: "",
  size: "",
  quality: "",
  special_note: "",
  retail_selling_price: 0,
};

export function ProductFormModal({
  open,
  onClose,
  onSubmit,
  product,
  loading = false,
  canEditPrice = true,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const isEdit = Boolean(product);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        product_code: product.product_code,
        total_stock: product.total_stock,
        size: product.size ?? "",
        quality: product.quality ?? "",
        special_note: product.special_note ?? "",
        category: product.category ?? "",
        retail_selling_price: product.retail_selling_price ?? 0,
      });
      setBarcodePreview(product.barcode_id);
    } else {
      setForm(emptyForm);
      setBarcodePreview(null);
    }
  }, [product, open]);

  useEffect(() => {
    setBarcodePreview(getBarcodePreview(form.product_code));
  }, [form.product_code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const update = (field: keyof ProductInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Product" : "Add Product"}
      description={
        isEdit
          ? "Update catalog details for this product."
          : "Register a new product in the catalog before printing labels."
      }
    >
      <form
        onSubmit={handleSubmit}
        className={`space-y-4 ${!isEdit ? "rounded-xl border border-accent/15 bg-accent/[0.03] p-4 -mx-1" : ""}`}
      >
        {!isEdit && (
          <span className="inline-block rounded-lg bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Product catalog
          </span>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Product Name *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="e.g. Widget Pro"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Backend Code *
          </label>
          <input
            type="text"
            required
            value={form.product_code}
            onChange={(e) => update("product_code", e.target.value.toUpperCase())}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 font-mono text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="e.g. WDG-001"
          />
          {barcodePreview && (
            <p className="mt-1.5 text-xs text-zinc-500">
              Linked barcode:{" "}
              <span className="font-mono text-accent">{barcodePreview}</span>
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Retail Selling Price (₹ / bag)
            {!canEditPrice && (
              <span className="ml-2 normal-case text-zinc-600">
                — admin only
              </span>
            )}
          </label>
          {canEditPrice ? (
            <input
              type="number"
              required
              min={0}
              step={0.01}
              value={form.retail_selling_price ?? 0}
              onChange={(e) =>
                update("retail_selling_price", Number(e.target.value))
              }
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
              placeholder="0.00"
            />
          ) : (
            <div className="rounded-xl border border-surface-border bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400">
              ₹{Number(product?.retail_selling_price ?? 0).toFixed(2)}
              <p className="mt-1 text-xs text-zinc-600">
                Only admins can change product prices.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Size
            </label>
            <input
              type="text"
              value={form.size ?? ""}
              onChange={(e) => update("size", e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
              placeholder="e.g. Large, 5L, M8"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Quality
            </label>
            <input
              type="text"
              value={form.quality ?? ""}
              onChange={(e) => update("quality", e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
              placeholder="e.g. A, Export, Premium"
            />
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              In-warehouse stock (bags)
            </label>
            <input
              type="text"
              value={String(product?.total_stock ?? 0)}
              disabled
              className="w-full rounded-xl border border-surface-border bg-surface-overlay/50 px-4 py-3 text-sm text-zinc-400 outline-none"
            />
          </div>
        )}

        {!isEdit && (
          <p className="text-xs text-zinc-600">
            New products start at 0 stock.
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Special Note
          </label>
          <textarea
            value={form.special_note ?? ""}
            onChange={(e) => update("special_note", e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="Any handling instructions or product-specific notes…"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
          >
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
