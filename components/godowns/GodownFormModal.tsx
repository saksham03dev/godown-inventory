"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Godown, GodownInput } from "@/lib/types/database";

interface GodownFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: GodownInput) => Promise<unknown>;
  godown?: Godown | null;
  loading?: boolean;
}

const emptyForm: GodownInput = {
  location_name: "",
  capacity: 0,
  address: "",
  notes: "",
};

export function GodownFormModal({
  open,
  onClose,
  onSubmit,
  godown,
  loading = false,
}: GodownFormModalProps) {
  const [form, setForm] = useState<GodownInput>(emptyForm);
  const isEdit = Boolean(godown);

  useEffect(() => {
    if (godown) {
      setForm({
        location_name: godown.location_name,
        capacity: godown.capacity,
        address: godown.address ?? "",
        notes: godown.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [godown, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const update = (field: keyof GodownInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Godown" : "Add Godown"}
      description="Manage warehouse location details and capacity in bags."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Location Name *
          </label>
          <input
            type="text"
            required
            value={form.location_name}
            onChange={(e) => update("location_name", e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="e.g. Godown A"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Capacity (bags) *
          </label>
          <input
            type="number"
            required
            min={0}
            value={form.capacity}
            onChange={(e) => update("capacity", Number(e.target.value))}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Address
          </label>
          <input
            type="text"
            value={form.address ?? ""}
            onChange={(e) => update("address", e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="Physical address or area"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Notes
          </label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-accent"
            placeholder="Access instructions, manager contact, etc."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:opacity-50"
          >
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Add Godown"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
