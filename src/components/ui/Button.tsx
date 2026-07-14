import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // near-black fill — the most legible primary action on a bright floor
  primary:
    "bg-accent text-accent-ink border border-accent hover:bg-accent-hover hover:border-accent-hover active:translate-y-px",
  // white with a strong border — clearly a button, never washed out
  secondary:
    "bg-bg text-text border border-border-strong hover:bg-surface active:translate-y-px",
  ghost:
    "bg-transparent text-text border border-transparent hover:bg-surface active:translate-y-px",
  danger:
    "bg-danger text-danger-ink border border-danger hover:brightness-95 active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  // every size clears a 44px min tap target height via min-h
  sm: "min-h-11 px-3 text-sm gap-1.5",
  md: "min-h-11 px-4 text-base gap-2",
  lg: "min-h-12 px-5 text-lg gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  icon,
  iconRight,
  className,
  children,
  ...props
}: ButtonProps) {
  const iconSize = size === "lg" ? 22 : 20;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-none font-medium select-none",
        "transition-[background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "disabled:opacity-45 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
