"use client";

import { Pencil, Trash2 } from "lucide-react";
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
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised p-10 text-center">
        <p className="text-sm text-zinc-400">
          Scan stocked-out unit barcodes to add items to this bill
        </p>
      </div>
    );
  }

  const priceEditable = !readonly && canEditPrice;

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Product
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
            {bill.bill_items.map((item) => (
              <tr key={item.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">{item.product_name}</p>
                  <p className="text-xs text-zinc-500">{item.product_code}</p>
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
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price}
                      onChange={(e) =>
                        onEditPrice(item, Number(e.target.value))
                      }
                      className="w-24 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1 text-right text-sm text-zinc-100 outline-none focus:border-accent"
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
