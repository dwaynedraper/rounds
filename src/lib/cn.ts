/** Minimal class joiner — no clsx/tailwind-merge dependency (plan: no new
 *  deps without asking). Joins truthy class strings; callers avoid passing
 *  conflicting Tailwind utilities for the same property. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
