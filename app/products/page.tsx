"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProductTable } from "@/components/products/ProductTable";
import { ProductFormModal } from "@/components/products/ProductFormModal";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Product, ProductInput } from "@/lib/types/database";

export default function ProductsPage() {
  const { can } = useAuth();
  const canCreate = can("products.create");
  const canEditPrice = can("products.editPrice");
  const canDelete = can("products.delete");

  const {
    products,
    loading,
    mutating,
    error,
    alert,
    refresh,
    addProduct,
    editProduct,
    removeProduct,
    dismissAlert,
  } = useProducts();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const handleAdd = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (input: ProductInput) => {
    const result = editingProduct
      ? await editProduct(editingProduct.id, input, {
          preservePrice: !canEditPrice,
          existingPrice: editingProduct.retail_selling_price,
        })
      : await addProduct({
          ...input,
          retail_selling_price: canEditPrice ? input.retail_selling_price : 0,
        });

    if (result.success) {
      handleFormClose();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await removeProduct(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (!isSupabaseConfigured()) {
    return (
      <DashboardLayout title="Products" subtitle="Manage your product catalog">
        <AlertBanner
          alert={{
            type: "info",
            message:
              "Supabase is not configured. Add your keys to .env.local to manage products.",
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Products"
      subtitle="Add, edit, or remove products — each gets a unique backend code and barcode"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canCreate && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-muted"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          )}
        </div>
      }
    >
      <div className="mx-auto max-w-6xl space-y-4 animate-fade-in">
        {alert && (
          <AlertBanner alert={alert} onDismiss={dismissAlert} />
        )}

        {loading ? (
          <LoadingSpinner label="Loading products…" />
        ) : error ? (
          <AlertBanner alert={{ type: "error", message: error }} />
        ) : (
          <ProductTable
            products={products}
            onEdit={handleEdit}
            onDelete={setDeleteTarget}
            canDelete={canDelete}
          />
        )}
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleSubmit}
        product={editingProduct}
        loading={mutating}
        canEditPrice={canEditPrice}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also remove all related inventory logs.`}
        loading={mutating}
      />
    </DashboardLayout>
  );
}
