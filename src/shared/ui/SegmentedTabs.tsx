import { motion } from "framer-motion";
import { cx } from "../lib/cx";

export interface TabItem<T extends string> {
  label: string;
  value: T;
}

interface SegmentedTabsProps<T extends string> {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

export function SegmentedTabs<T extends string>({ items, value, onChange, className }: SegmentedTabsProps<T>) {
  return (
    <div className={cx("relative flex flex-wrap gap-2 rounded-2xl p-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cx(
              "relative overflow-hidden rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-trust/45 bg-trust/20 text-textPrimary"
                : "border-soft bg-slate-900/20 text-textSecondary hover:text-textPrimary"
            )}
          >
            {active ? (
              <motion.span
                layoutId="segmented-underline"
                className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-trust"
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
