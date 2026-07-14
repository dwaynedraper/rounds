import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** render the value in tabular mono — for SKUs, store numbers, counts */
  mono?: boolean;
}

export function Field({
  label,
  hint,
  error,
  mono = false,
  className,
  id,
  ...props
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 w-full rounded-none border bg-bg px-3 text-base text-text",
          "placeholder:text-text-faint",
          "transition-[border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
          "disabled:opacity-45 disabled:pointer-events-none",
          error
            ? "border-danger focus-visible:outline-danger"
            : "border-border-strong hover:border-text-faint",
          mono && "tabular",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
