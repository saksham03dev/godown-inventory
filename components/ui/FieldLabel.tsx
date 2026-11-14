import type { ReactNode } from "react";

export function RequiredMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 align-baseline text-[1em] font-[inherit] leading-none text-inherit ${className}`}
      aria-hidden="true"
      title="Required"
    >
      *
    </span>
  );
}

interface FieldLabelProps {
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function FieldLabel({
  children,
  required,
  className = "",
}: FieldLabelProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 text-inherit ${className}`}
    >
      {required ? <RequiredMark /> : null}
      <span className="text-inherit">{children}</span>
    </span>
  );
}
