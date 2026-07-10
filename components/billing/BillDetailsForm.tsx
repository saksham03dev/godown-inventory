"use client";

import type { BillInput, BillWithItems } from "@/lib/types/database";

interface BillDetailsFormProps {
  bill: BillWithItems;
  onChange: (input: BillInput) => void;
  readonly?: boolean;
}

export function BillDetailsForm({
  bill,
  onChange,
  readonly = false,
}: BillDetailsFormProps) {
  const update = (field: keyof BillInput, value: string | number) => {
    onChange({
      customer_name: bill.customer_name,
      customer_phone: bill.customer_phone,
      customer_address: bill.customer_address,
      notes: bill.notes,
      tax_percent: bill.tax_percent,
      discount: bill.discount,
      [field]: value,
    });
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-surface-border bg-surface-raised p-5 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Customer Name
        </label>
        <input
          type="text"
          value={bill.customer_name}
          onChange={(e) => update("customer_name", e.target.value)}
          disabled={readonly}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Phone
        </label>
        <input
          type="text"
          value={bill.customer_phone ?? ""}
          onChange={(e) => update("customer_phone", e.target.value)}
          disabled={readonly}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Address
        </label>
        <input
          type="text"
          value={bill.customer_address ?? ""}
          onChange={(e) => update("customer_address", e.target.value)}
          disabled={readonly}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Tax %
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={bill.tax_percent}
          onChange={(e) => update("tax_percent", Number(e.target.value))}
          disabled={readonly}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Discount (₹)
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={bill.discount}
          onChange={(e) => update("discount", Number(e.target.value))}
          disabled={readonly}
          className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Notes
        </label>
        <textarea
          value={bill.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          disabled={readonly}
          rows={2}
          className="w-full resize-none rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
    </div>
  );
}
