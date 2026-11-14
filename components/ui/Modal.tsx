"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Keep the sidebar and header menu usable (overlay covers main content only). */
  preserveNav?: boolean;
  /** When false, hide close control and ignore backdrop / Escape. */
  dismissible?: boolean;
  /** Override default modal title typography. */
  titleClassName?: string;
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  preserveNav = false,
  dismissible = true,
  titleClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (dismissible && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    if (!preserveNav) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      if (!preserveNav) document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible, preserveNav]);

  if (!open) return null;

  const shellClass = preserveNav
    ? "fixed inset-y-0 right-0 left-0 top-[4.25rem] z-40 flex items-end justify-center p-4 sm:items-center lg:left-64 lg:top-0"
    : "fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center";

  return (
    <div className={shellClass}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised shadow-2xl animate-slide-up`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-surface-border bg-surface-raised px-5 py-4">
          <div>
            <h2
              id="modal-title"
              className={
                titleClassName ?? "text-lg font-semibold text-zinc-100"
              }
            >
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
            )}
          </div>
          {dismissible ? (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
