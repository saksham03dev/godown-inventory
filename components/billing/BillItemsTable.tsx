"use client";

import { Trash2 } from "lucide-react";
import { formatUnitLabel } from "@/lib/utils/billItem";
import type { BillItem, BillWithItems } from "@/lib/types/database";

interface BillItemsTableProps {
  bill: BillWithItems;
  onEditPrice: (item: BillItem, price: number) => void;
  onRemove: (itemId: string) => void;
  readonly?: boolean;
  canEditPrice?: boolean;
}

export function BillItemsTable({
  bill,
  onEditPrice,
  onRemove,
  readonly = false,
  canEditPrice = false,
}: BillItemsTableProps) {
  if (bill.bill_items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-8 text-center sm:p-10">
        <p className="text-sm text-zinc-400">
          Scan stocked-out unit barcodes to add items to this bill
        </p>
      </div>
    );
  }

  const priceEditable = !readonly && canEditPrice;

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised [overflow-anchor:none]">
      {/* Mobile card list */}
      <ul className="divide-y divide-surface-border sm:hidden">
        {bill.bill_items.map((item) => {
          const unitLabel = formatUnitLabel(item);
          return (
            <li key={item.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-200">{item.product_name}</p>
                  <p className="text-xs text-zinc-500">{item.product_code}</p>
                  {unitLabel && (
                    <p className="mt-1 font-mono text-xs text-accent">{unitLabel}</p>
                  )}
                  <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-600">
                    {item.unit_barcode}
                  </p>
                  {item.source_name && (
                    <p className="text-xs text-zinc-500">{item.source_name}</p>
                  )}
                </div>
                {!readonly && (
                  <button
                    onClick={() => onRemove(item.id)}
                    className="shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-danger"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                {priceEditable ? (
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    Price
                    <input
                      type="text"
                      inputMode="decimal"
                      defaultValue={String(item.unit_price)}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n) && n >= 0) onEditPrice(item, n);
                      }}
                      className="w-24 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-base text-zinc-100 outline-none focus:border-accent"
                    />
                  </label>
                ) : (
                  <span className="text-sm text-zinc-400">
                    ₹{Number(item.unit_price).toFixed(2)}
                  </span>
                )}
                <span className="font-medium text-zinc-100">
                  ₹{Number(item.line_total).toFixed(2)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Unit ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Barcode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Source
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total
              </th>
              {!readonly && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {bill.bill_items.map((item) => {
              const unitLabel = formatUnitLabel(item);
              return (
                <tr key={item.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-200">{item.product_name}</p>
                    <p className="text-xs text-zinc-500">{item.product_code}</p>
                  </td>
                  <td className="px-4 py-3">
                    {unitLabel ? (
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                        {unitLabel}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {item.unit_barcode}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {item.source_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {priceEditable ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={String(item.unit_price)}
                        key={`${item.id}-${item.unit_price}`}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 0) onEditPrice(item, n);
                        }}
                        className="w-24 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-right text-base text-zinc-100 outline-none focus:border-accent sm:text-sm"
                      />
                    ) : (
                      <span>₹{Number(item.unit_price).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-200">
                    ₹{Number(item.line_total).toFixed(2)}
                  </td>
                  {!readonly && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRemove(item.id)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-danger"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
