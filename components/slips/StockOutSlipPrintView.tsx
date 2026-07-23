"use client";

import type { StockOutSlipWithDetails } from "@/lib/types/database";

interface StockOutSlipPrintViewProps {
  slip: StockOutSlipWithDetails;
}

export function StockOutSlipPrintView({ slip }: StockOutSlipPrintViewProps) {
  const date = new Date(slip.confirmed_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const unitsByProduct = new Map<string, number[]>();
  for (const unit of slip.stock_out_slip_units) {
    const list = unitsByProduct.get(unit.product_id) ?? [];
    list.push(unit.unit_number);
    unitsByProduct.set(unit.product_id, list);
  }

  return (
    <div
      id="stock-out-slip-print-area"
      className="mx-auto max-w-2xl bg-white p-8 text-black"
    >
      <div className="border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">STOCK OUT SLIP</h1>
        <p className="text-sm text-zinc-600">Store IMS</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="font-semibold">Biller</p>
          <p>{slip.biller_name?.trim() || "—"}</p>
          <p className="mt-2 font-semibold">Bill No</p>
          <p>{slip.bill_no?.trim() || "—"}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-semibold">Channel:</span> {slip.sale_channel}
          </p>
          <p>
            <span className="font-semibold">Date:</span> {date}
          </p>
          {slip.created_by_label && (
            <p>
              <span className="font-semibold">By:</span> {slip.created_by_label}
            </p>
          )}
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black">
            <th className="py-2 text-left">#</th>
            <th className="py-2 text-left">Code</th>
            <th className="py-2 text-left">Size</th>
            <th className="py-2 text-left">Product</th>
            <th className="py-2 text-right">Bags</th>
            <th className="py-2 text-left">Bale nos</th>
          </tr>
        </thead>
        <tbody>
          {slip.stock_out_slip_lines.map((line, i) => {
            const product = line.products;
            const unitNos = (unitsByProduct.get(line.product_id) ?? [])
              .sort((a, b) => a - b)
              .join(", ");
            return (
              <tr key={line.id} className="border-b border-zinc-200 align-top">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 font-mono text-xs">
                  {product?.product_code ?? "—"}
                </td>
                <td className="py-2">{product?.size?.trim() || "—"}</td>
                <td className="py-2">{product?.name ?? "—"}</td>
                <td className="py-2 text-right font-semibold">
                  {Math.round(line.bag_count)}
                </td>
                <td className="py-2 text-xs text-zinc-600">{unitNos || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end text-sm font-semibold">
        <span>Total bags: {Math.round(slip.total_bags)}</span>
      </div>
    </div>
  );
}
