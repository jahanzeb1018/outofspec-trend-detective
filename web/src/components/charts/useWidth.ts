import { useCallback, useEffect, useState } from "react";

/** Measure a container so SVG charts draw at real pixel size (readable text at any width). Returns a callback ref, so
 *  it also works when the container only appears after the data has loaded. */
export function useWidth<T extends HTMLElement>(fallback = 640) {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(fallback);
  const ref = useCallback((node: T | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const width = Math.round(e[0].contentRect.width);
      if (width > 0) setW(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [ref, Math.max(300, w)] as const;
}
