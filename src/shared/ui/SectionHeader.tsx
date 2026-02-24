import { cx } from "../lib/cx";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <header className={cx("mb-4", className)}>
      <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-textPrimary">{title}</h2>
      <span className="mt-2 block h-[2px] w-10 rounded-full bg-trust/90" />
      {subtitle ? <p className="mt-2 text-sm text-textSecondary">{subtitle}</p> : null}
    </header>
  );
}
