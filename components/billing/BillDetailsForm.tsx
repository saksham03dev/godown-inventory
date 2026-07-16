"use client";

import { useEffect, useRef, useState } from "react";
import type { BillInput, BillWithItems } from "@/lib/types/database";

interface BillDetailsFormProps {
  bill: BillWithItems;
  onChange: (input: BillInput) => void;
  readonly?: boolean;
  /** Wholesale: emphasize sold-to customer name (stamped on bales at finalize). */
  soldToMode?: boolean;
}

interface LocalForm {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  tax_percent: string;
  discount: string;
  labour_cost: string;
  transportation_cost: string;
}

function toLocal(bill: BillWithItems): LocalForm {
  return {
    customer_name: bill.customer_name ?? "",
    customer_phone: bill.customer_phone ?? "",
    customer_address: bill.customer_address ?? "",
    notes: bill.notes ?? "",
    tax_percent: String(bill.tax_percent ?? 0),
    discount: String(bill.discount ?? 0),
    labour_cost: String(bill.labour_cost ?? 0),
    transportation_cost: String(bill.transportation_cost ?? 0),
  };
}

function toInput(form: LocalForm): BillInput {
  const tax = Number(form.tax_percent);
  const discount = Number(form.discount);
  const labour = Number(form.labour_cost);
  const transport = Number(form.transportation_cost);
  return {
    customer_name: form.customer_name,
    customer_phone: form.customer_phone,
    customer_address: form.customer_address,
    notes: form.notes,
    tax_percent: Number.isFinite(tax) ? tax : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    labour_cost: Number.isFinite(labour) ? Math.max(0, labour) : 0,
    transportation_cost: Number.isFinite(transport)
      ? Math.max(0, transport)
      : 0,
  };
}

const inputClass =
  "w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-2.5 text-base text-zinc-100 outline-none focus:border-accent disabled:opacity-60 sm:text-sm";

export function BillDetailsForm({
  bill,
  onChange,
  readonly = false,
  soldToMode = false,
}: BillDetailsFormProps) {
  const [form, setForm] = useState<LocalForm>(() => toLocal(bill));
  const formRef = useRef(form);
  const onChangeRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  formRef.current = form;
  onChangeRef.current = onChange;

  // Sync from server only when switching bills (not after every autosave)
  useEffect(() => {
    setForm(toLocal(bill));
  }, [bill.id]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: local form owns edits

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleSave = (next: LocalForm) => {
    if (readonly) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeRef.current(toInput(next));
    }, 700);
  };

  const flushSave = () => {
    if (readonly) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onChangeRef.current(toInput(formRef.current));
  };

  const updateField = <K extends keyof LocalForm>(field: K, value: LocalForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      formRef.current = next;
      scheduleSave(next);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-surface-border bg-surface-raised p-4 sm:grid-cols-2 sm:p-5">
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          {soldToMode ? "Sold to (customer)" : "Customer Name"}
          {soldToMode && !readonly ? (
            <span className="ml-1 text-danger">*</span>
          ) : null}
        </label>
        <input
          type="text"
          autoComplete="name"
          value={form.customer_name}
          onChange={(e) => updateField("customer_name", e.target.value)}
          onBlur={flushSave}
          disabled={readonly}
          className={inputClass}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Phone
        </label>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.customer_phone}
          onChange={(e) => updateField("customer_phone", e.target.value)}
          onBlur={flushSave}
          disabled={readonly}
          className={inputClass}
        />
      </div>
      <div className="min-w-0 sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Address
        </label>
        <input
          type="text"
          autoComplete="street-address"
          value={form.customer_address}
          onChange={(e) => updateField("customer_address", e.target.value)}
          onBlur={flushSave}
          disabled={readonly}
          className={inputClass}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Tax %
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={form.tax_percent}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) {
              updateField("tax_percent", v);
            }
          }}
          onBlur={flushSave}
          disabled={readonly}
          className={inputClass}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Discount (₹)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={form.discount}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) {
              updateField("discount", v);
            }
          }}
          onBlur={flushSave}
          disabled={readonly}
          className={inputClass}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Labour cost (₹)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={form.labour_cost}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) {
              updateField("labour_cost", v);
            }
          }}
          onBlur={flushSave}
          disabled={readonly}
          placeholder="0 if none"
          className={inputClass}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Transportation cost (₹)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={form.transportation_cost}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) {
              updateField("transportation_cost", v);
            }
          }}
          onBlur={flushSave}
          disabled={readonly}
          placeholder="0 if none"
          className={inputClass}
        />
      </div>
      <div className="min-w-0 sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          onBlur={flushSave}
          disabled={readonly}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );
}
