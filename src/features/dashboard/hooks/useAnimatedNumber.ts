import { animate, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function useAnimatedNumber(target: number, duration = 0.82) {
  const [display, setDisplay] = useState(target);
  const motionValue = useMotionValue(target);

  useEffect(() => {
    const unsubscribe = motionValue.on("change", (latest) => {
      setDisplay(latest);
    });

    const controls = animate(motionValue, target, {
      duration,
      ease: EASE
    });

    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [duration, motionValue, target]);

  return display;
}
