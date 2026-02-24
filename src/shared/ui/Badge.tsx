import { cx } from "../lib/cx";

type BadgeVariant = "neutral" | "positive" | "negative" | "accent";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  neutral: "text-textSecondary border-soft bg-slate-900/30",
  positive: "text-profit border-profit/30 bg-profit/10",
  negative: "text-loss border-loss/30 bg-loss/10",
  accent: "text-trust border-trust/35 bg-trust/15"
};

export function Badge({ label, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide",
        variantClass[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
