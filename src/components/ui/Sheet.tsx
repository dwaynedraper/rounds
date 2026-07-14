"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** sticky footer, e.g. a submit/confirm action row */
  footer?: ReactNode;
}

/** Bottom sheet — the survey's detail/entry surface on a phone. Slides up
 *  from the bottom (thumb-reachable), scrim behind, Escape + scrim close,
 *  body scroll locked while open. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--overlay)] motion-safe:animate-[fade_var(--dur)_var(--ease-out)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative w-full max-h-[85vh] flex flex-col rounded-none border-t border-border-strong bg-bg",
          "shadow-[var(--shadow-pop)] outline-none",
          "motion-safe:animate-[slideUp_var(--dur)_var(--ease-out)]",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-text-muted hover:text-text"
          >
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-border px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}
