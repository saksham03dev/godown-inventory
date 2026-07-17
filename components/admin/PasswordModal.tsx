"use client";

import { Modal } from "@/components/ui/Modal";

interface PasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  username?: string;
  loading?: boolean;
}

export function PasswordModal({
  open,
  onClose,
  onSubmit,
  username,
  loading = false,
}: PasswordModalProps) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    await onSubmit(password);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Password"
      description={
        username
          ? `Set a new password for @${username}`
          : "Set a new password for this user"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            New Password *
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-xl border border-surface-border bg-surface-overlay px-4 py-3 text-sm text-zinc-100 outline-none focus:border-accent"
            placeholder="At least 8 characters"
          />
        </div>

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
            {loading ? "Updating…" : "Update Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
