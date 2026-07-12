import { Pencil, Trash2 } from "lucide-react";
import type { Product } from "@/lib/types/database";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  canDelete?: boolean;
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  canDelete = true,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-12 text-center">
        <p className="text-sm font-medium text-zinc-400">No products yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Add your first product to start managing inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-overlay/50">
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Name
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Backend Code
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Barcode
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Price / bag
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Size
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Stock (bags)
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Special Note
              </th>
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
                <td className="px-5 py-4 font-medium text-zinc-200">
                  {product.name}
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                    {product.product_code}
                  </span>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                  {product.barcode_id}
                </td>
                <td className="px-5 py-4 text-right font-medium text-zinc-200">
                  ₹{Number(product.retail_selling_price ?? 0).toFixed(2)}
                </td>
                <td className="px-5 py-4 text-zinc-400">
                  {product.size || "—"}
                </td>
                <td className="px-5 py-4 text-right font-semibold text-zinc-200">
                  {product.total_stock.toLocaleString()}
                </td>
                <td className="max-w-[200px] truncate px-5 py-4 text-zinc-500">
                  {product.special_note || "—"}
                </td>
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
