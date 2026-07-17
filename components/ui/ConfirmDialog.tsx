"use client";

import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="whitespace-pre-line text-sm text-zinc-300">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
            destructive
              ? "bg-danger hover:bg-danger-muted"
              : "bg-accent hover:bg-accent-muted"
          }`}
        >
          {loading ? "Processing…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
