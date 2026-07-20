import { Fragment } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { ProductTableColumnId } from "@/lib/constants/productTableColumns";
import type { Product } from "@/lib/types/database";

interface ProductTableProps {
  products: Product[];
  visibleColumns: ProductTableColumnId[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  canDelete?: boolean;
}

const COLUMN_HEADERS: Record<
  ProductTableColumnId,
  { label: string; align: "left" | "right" }
> = {
  name: { label: "Name", align: "left" },
  product_code: { label: "Backend Code", align: "left" },
  barcode_id: { label: "Barcode", align: "left" },
  retail_selling_price: { label: "Price / bag", align: "right" },
  size: { label: "Size", align: "left" },
  total_stock: { label: "Stock (bags)", align: "right" },
  notes: { label: "Notes", align: "left" },
};

function renderCell(column: ProductTableColumnId, product: Product) {
  switch (column) {
    case "name":
      return (
        <td className="px-5 py-4 font-medium text-zinc-200">{product.name}</td>
      );
    case "product_code":
      return (
        <td className="px-5 py-4">
          <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
            {product.product_code}
          </span>
        </td>
      );
    case "barcode_id":
      return (
        <td className="px-5 py-4 font-mono text-xs text-zinc-400">
          {product.barcode_id}
        </td>
      );
    case "retail_selling_price":
      return (
        <td className="px-5 py-4 text-right font-medium text-zinc-200">
          ₹{Number(product.retail_selling_price ?? 0).toFixed(2)}
        </td>
      );
    case "size":
      return (
        <td className="px-5 py-4 text-zinc-400">{product.size || "—"}</td>
      );
    case "total_stock":
      return (
        <td className="px-5 py-4 text-right font-semibold text-zinc-200">
          {product.total_stock.toLocaleString()}
        </td>
      );
    case "notes":
      return (
        <td className="max-w-[240px] truncate px-5 py-4 text-zinc-500">
          {[product.quality, product.special_note].filter(Boolean).join(" · ") ||
            "—"}
        </td>
      );
  }
}

export function ProductTable({
  products,
  visibleColumns,
  onEdit,
  onDelete,
  canDelete = true,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-accent/15 bg-accent/[0.03] p-12 text-center ring-1 ring-accent/10">
        <p className="text-sm font-medium text-zinc-400">No products yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Add your first product to start managing inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-accent/15 bg-surface-raised ring-1 ring-accent/10">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent/15 bg-accent/5">
              {visibleColumns.map((column) => {
                const { label, align } = COLUMN_HEADERS[column];
                return (
                  <th
                    key={column}
                    className={`px-5 py-3.5 text-xs font-medium uppercase tracking-wider text-zinc-500 ${
                      align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {label}
                  </th>
                );
              })}
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {products.map((product) => (
              <tr
                key={product.id}
                className="transition hover:bg-white/[0.02]"
              >
                {visibleColumns.map((column) => (
                  <Fragment key={column}>{renderCell(column, product)}</Fragment>
                ))}
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onEdit(product)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-accent"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => onDelete(product)}
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-danger"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
