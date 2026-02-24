import { motion, type HTMLMotionProps } from "framer-motion";
import { cx } from "../lib/cx";

type CardVariant = "surface" | "elevated" | "interactive";

interface CardProps extends HTMLMotionProps<"div"> {
  variant?: CardVariant;
}

const variantClass: Record<CardVariant, string> = {
  surface: "border border-soft bg-surfaceBg/80 shadow-surface",
  elevated: "premium-card",
  interactive: "premium-card transition-transform duration-200 hover:-translate-y-1 hover:shadow-interactive"
};

export function Card({ className, variant = "surface", ...props }: CardProps) {
  return <motion.div className={cx("rounded-lgx", variantClass[variant], className)} {...props} />;
}
