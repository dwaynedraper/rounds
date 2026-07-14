import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

export type BrandKey = "sony" | "canon" | "nikon";
type Tone = "neutral" | "danger" | "warn" | "success" | "info";

const BRAND: Record<BrandKey, string> = {
  sony: "bg-sony text-sony-ink border-sony",
  canon: "bg-canon text-canon-ink border-canon",
  nikon: "bg-nikon text-nikon-ink border-nikon",
};

// Status chips: solid fill so they read at a glance on a bright floor.
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text border-border-strong",
  danger: "bg-danger text-danger-ink border-danger",
  warn: "bg-warn text-warn-ink border-warn",
  success: "bg-success text-success-ink border-success",
  info: "bg-info text-info-ink border-info",
};

const base =
  "inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide whitespace-nowrap";

export interface BrandChipProps extends HTMLAttributes<HTMLSpanElement> {
  brand: BrandKey;
}

/** Brand identification tag — the ONLY decorative use of brand color. */
export function BrandChip({ brand, className, children, ...props }: BrandChipProps) {
  return (
    <span className={cn(base, BRAND[brand], className)} {...props}>
      {children ?? brand}
    </span>
  );
}

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: IconName;
}

/** Status/flag tag — solid fill = meaning (broken, missing, resolved). */
export function StatusChip({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: StatusChipProps) {
  return (
    <span className={cn(base, TONE[tone], className)} {...props}>
      {icon && <Icon name={icon} size={12} weight={2} />}
      {children}
    </span>
  );
}
