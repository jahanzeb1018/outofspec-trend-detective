import { useEffect, useRef, useState } from "react";

/** Measure a container so SVG charts draw at real pixel size (readable text at any width). */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => {
      const width = Math.round(e[0].contentRect.width);
      if (width > 0) setW(width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, Math.max(300, w)] as const;
}
