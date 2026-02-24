import { motion } from "framer-motion";
import { cx } from "../lib/cx";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cx("overflow-hidden rounded-md bg-slate-800/60", className)}
      animate={{ opacity: [0.45, 0.8, 0.45] }}
      transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
    />
  );
}
