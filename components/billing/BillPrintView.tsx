import type { BillWithItems } from "@/lib/types/database";
import { formatBillBags, formatRetailBaleNote, formatUnitLabel } from "@/lib/utils/billItem";

interface BillPrintViewProps {
  bill: BillWithItems;
}

export function BillPrintView({ bill }: BillPrintViewProps) {
  const date = new Date(bill.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div id="bill-print-area" className="mx-auto max-w-2xl bg-white p-8 text-black">
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">TAX INVOICE</h1>
        <p className="text-sm text-zinc-600">Store IMS</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Bill To</p>
          <p>{bill.customer_name}</p>
          {bill.customer_phone && <p>{bill.customer_phone}</p>}
          {bill.customer_address && <p>{bill.customer_address}</p>}
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold">Invoice:</span> {bill.bill_number}
          </p>
          <p>
            <span className="font-semibold">Date:</span> {date}
          </p>
          <p>
            <span className="font-semibold">Status:</span> {bill.status}
          </p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="py-2 text-left">#</th>
            <th className="py-2 text-left">Item</th>
            <th className="py-2 text-left">Unit</th>
            <th className="py-2 text-left">Barcode</th>
            <th className="py-2 text-left">Source</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {bill.bill_items.map((item, i) => {
            const unitLabel = formatUnitLabel(item);
            const lineNote = formatRetailBaleNote(item);
            return (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-2">{i + 1}</td>
              <td className="py-2">
                {item.product_name}
                <br />
                <span className="text-xs text-zinc-500">{item.product_code}</span>
                {lineNote && (
                  <>
                    <br />
                    <span className="text-xs text-zinc-500">{lineNote}</span>
                  </>
                )}
              </td>
              <td className="py-2 font-mono text-xs">
                {unitLabel ?? "—"}
                {item.sale_channel === "RETAIL" && (
                  <>
                    <br />
                    <span className="text-zinc-500">{formatBillBags(item)}</span>
                  </>
                )}
              </td>
              <td className="py-2 font-mono text-xs">{item.unit_barcode}</td>
              <td className="py-2 text-xs">{item.source_name || "—"}</td>
              <td className="py-2 text-right">
                ₹{Number(item.unit_price).toFixed(2)}
              </td>
              <td className="py-2 text-right">
                ₹{Number(item.line_total).toFixed(2)}
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{Number(bill.subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax ({bill.tax_percent}%)</span>
          <span>₹{Number(bill.tax_amount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span>- ₹{Number(bill.discount).toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
          <span>Total</span>
          <span>₹{Number(bill.total).toFixed(2)}</span>
        </div>
      </div>

      {bill.notes && (
        <p className="mt-6 text-xs text-zinc-600">Notes: {bill.notes}</p>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #bill-print-area,
          #bill-print-area * {
            visibility: visible;
          }
          #bill-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
