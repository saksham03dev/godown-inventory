import type { BillWithItems } from "@/lib/types/database";

interface BillTotalsProps {
  bill: BillWithItems;
}

export function BillTotals({ bill }: BillTotalsProps) {
  const labour = Number(bill.labour_cost ?? 0);
  const transport = Number(bill.transportation_cost ?? 0);

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Subtotal</span>
          <span>₹{Number(bill.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Tax ({bill.tax_percent}%)</span>
          <span>₹{Number(bill.tax_amount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Labour</span>
          <span>₹{labour.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Transportation</span>
          <span>₹{transport.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Discount</span>
          <span>- ₹{Number(bill.discount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-surface-border pt-2 text-lg font-bold text-zinc-100">
          <span>Total</span>
          <span>₹{Number(bill.total).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
