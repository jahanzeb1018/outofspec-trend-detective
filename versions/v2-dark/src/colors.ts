import { scaleLinear } from "d3-scale";
import type { IndicatorKind } from "./config";
import type { Summary } from "./data/types";

export const PALETTES: Record<string, string[]> = {
  heat: ["#fff3c4", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026", "#6b0021"],
  cold: ["#eef6ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c", "#08306b"],
  rain: ["#f0f9e8", "#bae4bc", "#7bccc4", "#43a2ca", "#0868ac", "#084081"],
  div: ["#2f7bd6", "#6aa6e0", "#a9c8ea", "#4a4c52", "#f3b39a", "#ef7a55", "#e0352b"],
};
export const BAND_COLOR: Record<string, string> = { none: "#c62828", minimum: "#e3a43b", adequate: "#1e8e4e", desired: "#146c3a" };
export const NO_DATA = "#3a3c42";

/** Stepped heat palette for "days >= threshold per year" (the house colour scale). */
export const HEAT_STEPS: { max: number; color: string; label: string }[] = [
  { max: 0, color: "#3a3c42", label: "0" },
  { max: 5, color: "#fde7b0", label: "1–5" },
  { max: 10, color: "#fbb868", label: "6–10" },
  { max: 20, color: "#f2783a", label: "11–20" },
  { max: 30, color: "#d63a2f", label: "21–30" },
  { max: Infinity, color: "#8a1c2b", label: "30+" },
];
export function heatColor(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NO_DATA;
  const r = Math.round(v);
  return (HEAT_STEPS.find((s) => r <= s.max) ?? HEAT_STEPS[HEAT_STEPS.length - 1]).color;
}

export interface ColorScale {
  domain: [number, number];
  colors: string[];
  color: (v: number | null | undefined) => string;
  diverging: boolean;
}

function make(domain: [number, number], colors: string[], diverging = false): ColorScale {
  const [a, b] = domain;
  const stops = colors.map((_, i) => a + ((b - a) * i) / (colors.length - 1));
  const s = scaleLinear<string>().domain(stops).range(colors).clamp(true);
  return { domain, colors, diverging, color: (v) => (v === null || v === undefined || !Number.isFinite(v) ? NO_DATA : s(v)) };
}

function paletteFor(kind: IndicatorKind): string[] {
  if (kind === "cold") return PALETTES.cold;
  if (kind === "temp-cold") return [...PALETTES.cold].reverse();
  if (kind === "rain") return PALETTES.rain;
  return PALETTES.heat;
}

const niceMax = (x: number) => {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  return Math.ceil(x / p) * p;
};

/** Value scale shared by Now, Future and the timeline so colours are comparable. */
export function valueScale(summary: Summary, ind: string, kind: IndicatorKind): ColorScale {
  const vals: number[] = [];
  for (const c of Object.values(summary.cells)) {
    const r = c[ind];
    if (!r) continue;
    for (const v of [r.now, r.late, r.ref]) if (v !== null && v !== undefined) vals.push(v);
    if (r.fut) for (const s of Object.values(r.fut)) for (const e of Object.values(s)) if (e[0] !== null) vals.push(e[0]);
  }
  vals.sort((x, y) => x - y);
  const lo = vals[Math.floor(vals.length * 0.02)] ?? 0;
  const hi = vals[Math.floor(vals.length * 0.98)] ?? 1;
  if (kind === "heat" || kind === "cold" || kind === "rain") return make([0, niceMax(hi)], paletteFor(kind));
  return make([Math.floor(lo), Math.ceil(hi)], paletteFor(kind));
}

export function trendScale(summary: Summary, ind: string): ColorScale {
  const vals = Object.values(summary.cells)
    .map((c) => Math.abs(c[ind]?.sen ?? 0))
    .sort((a, b) => a - b);
  const m = vals[Math.floor(vals.length * 0.97)] || 1;
  const lim = Number(m.toPrecision(2));
  return make([-lim, lim], PALETTES.div, true);
}
