import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icons";

type Tone = "danger" | "warn" | "info" | "neutral";

// When ON, the toggle fills with its tone so a set flag is unmistakable at
// arm's length. When OFF, it's a plain bordered target — still a big, clear
// tap area. This is the core survey interaction (mark what's wrong on a slot).
const ON: Record<Tone, string> = {
  danger: "bg-danger text-danger-ink border-danger",
  warn: "bg-warn text-warn-ink border-warn",
  info: "bg-info text-info-ink border-info",
  neutral: "bg-accent text-accent-ink border-accent",
};

export interface FlagToggleProps {
  label: string;
  pressed: boolean;
  onToggle: (next: boolean) => void;
  tone?: Tone;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
}

export function FlagToggle({
  label,
  pressed,
  onToggle,
  tone = "danger",
  icon = "flag",
  disabled,
  className,
}: FlagToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onToggle(!pressed)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-none border px-3 text-sm font-semibold select-none",
        "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "disabled:opacity-45 disabled:pointer-events-none",
        pressed
          ? ON[tone]
          : "bg-bg text-text-muted border-border-strong hover:border-text-faint hover:text-text",
        className,
      )}
    >
      <Icon name={pressed ? "check" : icon} size={18} weight={2} />
      {label}
    </button>
  );
}
