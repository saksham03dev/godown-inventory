"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import type { PortalUser } from "@/lib/types/database";

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    username: string;
    full_name: string;
    role: UserRole;
    password?: string;
    is_active?: boolean;
  }) => Promise<void>;
  user?: PortalUser | null;
  loading?: boolean;
}

const emptyForm = {
  username: "",
  full_name: "",
  role: "employee" as UserRole,
  password: "",
  is_active: true,
};

export function UserFormModal({
  open,
  onClose,
  onSubmit,
  user,
  loading = false,
}: UserFormModalProps) {
  const [form, setForm] = useState(emptyForm);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        password: "",
        is_active: user.is_active,
      });
    } else {
      setForm(emptyForm);
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      username: form.username,
      full_name: form.full_name,
      role: form.role,
      password: form.password || undefined,
      is_active: form.is_active,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add User"}
      description="Accounts use Supabase Auth. Staff sign in with username and password you distribute."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Username *
          </label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))
            }
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
            placeholder="e.g. john.doe"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Role *
          </label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as UserRole }))
            }
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
          >
            {(["admin", "manager", "employee"] as UserRole[]).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {!isEdit && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
              placeholder="At least 8 characters"
            />
          </div>
        )}

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
              className="rounded border-surface-border"
            />
            Account active (can sign in)
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {loading ? "Saving…" : isEdit ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
