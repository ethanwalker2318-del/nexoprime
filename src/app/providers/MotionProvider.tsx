import { MotionConfig } from "framer-motion";
import { type PropsWithChildren } from "react";
import { springSmooth } from "../../design-system/motion";

export function AppMotionProvider({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion="user" transition={springSmooth}>
      {children}
    </MotionConfig>
  );
}
