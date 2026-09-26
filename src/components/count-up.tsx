"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 (or its previous value) to `value`. Formatting via `format`. */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(origin + (value - origin) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
