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

  /* onClose is held in a ref, and the effect below depends ONLY on `open`.
   *
   * This is load-bearing, not tidiness. Every caller passes an inline arrow
   * (`onClose={() => setPickFor(null)}`), which is a new function identity on
   * every render. With `onClose` in the dependency array, the effect tore down
   * and re-ran on EVERY render of the parent — including the re-render caused
   * by typing one character into a field inside the sheet. Re-running it hit
   * `panelRef.current.focus()`, which yanked focus off the input.
   *
   * Symptom: type one character, the field blurs. Click back in, type one more
   * character, blurs again. Reported by Dean from the field, 2026-07-24, in the
   * layout-edit search box; the note field had it too.
   *
   * Fixed HERE rather than by wrapping each caller's handler in useCallback,
   * because that would leave the trap armed for the next person to add a
   * <Sheet> with an inline handler — which is the natural way to write one. */
  const onCloseRef = useRef(onClose);
  // Kept current in an effect, not during render — React 19's react-hooks/refs
  // rule rejects writing a ref while rendering, and it is right to.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus moves into the dialog once, when it opens — never again while the
    // user is typing in it.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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
