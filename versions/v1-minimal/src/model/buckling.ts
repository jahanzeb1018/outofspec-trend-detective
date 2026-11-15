// Buckling safety-margin model (Kish & Samavedam 2013, FRA) - mirrors pipeline/buckling.py.
import { gaussian, mulberry32, percentile, median } from "../stats/math";

const LB_IN = 0.1751268; // 1 lb/in in kN/m
const F2C = 5 / 9;
/** (peak lateral resistance kN/m, allowable temperature increase degC) from FRA parametric results. */
export const FRA_POINTS: [number, number][] = [
  [70 * LB_IN, 60 * F2C],
  [120 * LB_IN, 86 * F2C],
  [180 * LB_IN, 100 * F2C],
];
export const PRESET_FP: Record<Preset, number | null> = { strong: 180 * LB_IN, average: 120 * LB_IN, weak: 70 * LB_IN, unknown: null };
export const TN_DIST = { values: [60, 70, 80, 90, 100].map((f) => (f - 32) * F2C), probs: [0.04, 0.21, 0.5, 0.21, 0.04] };
export const FP_DIST = { values: [85, 100, 115, 130, 145].map((v) => v * LB_IN), probs: [0.05, 0.25, 0.4, 0.25, 0.05] };
export const BSM_THRESHOLDS = { minimum: 0, adequate: 100 / 9, desired: 200 / 9 };
export const RAIL_SIGMA = 4;
export const TENSION_KN_PER_C = (210e9 * 11.5e-6 * 11.91 * 0.00064516) / 1000;

export type Preset = "strong" | "average" | "weak" | "unknown";
export type TnSpec = { kind: "fra" } | { kind: "value"; value: number } | { kind: "range"; range: [number, number] };
export type Band = "none" | "minimum" | "adequate" | "desired";

export function dtAllow(fp: number): number {
  const [p0, p1, p2] = FRA_POINTS;
  if (fp <= p0[0]) return p0[1];
  if (fp >= p2[0]) return p2[1];
  const [a, b] = fp <= p1[0] ? [p0, p1] : [p1, p2];
  return a[1] + ((fp - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
}

export function bsmBand(bsm: number): Band {
  if (bsm < 0) return "none";
  if (bsm < BSM_THRESHOLDS.adequate) return "minimum";
  if (bsm < BSM_THRESHOLDS.desired) return "adequate";
  return "desired";
}

function sampleDiscrete(rand: () => number, values: number[], probs: number[]): number {
  const total = probs.reduce((a, b) => a + b, 0);
  let u = rand() * total;
  for (let i = 0; i < values.length; i++) {
    u -= probs[i];
    if (u <= 0) return values[i];
  }
  return values[values.length - 1];
}

export interface SimResult {
  days_mean: number;
  days_p10: number;
  days_p90: number;
  p_any: number;
  bsm_med: number;
  bsm_p10: number;
  bsm_p90: number;
  rail_am_med: number;
  /** per-sample load distribution helper: excess (T_rail - T_N) of all warm-season days, for charts */
  bsm_samples?: Float64Array;
}

function upperCount(sorted: Float64Array, thr: number): number {
  // number of values strictly greater than thr (== len - searchsorted(side="right"))
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= thr) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length - lo;
}

export function simulate(
  yearsTr: number[][],
  preset: Preset,
  opts: { n?: number; tn?: TnSpec; fp?: number | null; sigma?: number; seed?: number } = {},
): SimResult {
  const n = opts.n ?? 2000;
  const sigma = opts.sigma ?? RAIL_SIGMA;
  const rand = mulberry32(opts.seed ?? 20261114);
  const tnSpec = opts.tn ?? { kind: "fra" };
  const sorted = yearsTr.map((y) => Float64Array.from(y).sort());
  const ams = yearsTr.map((y) => Math.max(...y));
  const amMed = median(ams);
  const days = new Float64Array(n);
  const bsm = new Float64Array(n);
  let anyCount = 0;
  const ny = yearsTr.length;
  const fpFixed = opts.fp ?? PRESET_FP[preset];
  for (let s = 0; s < n; s++) {
    const tn =
      tnSpec.kind === "fra" ? sampleDiscrete(rand, TN_DIST.values, TN_DIST.probs) : tnSpec.kind === "value" ? tnSpec.value : tnSpec.range[0] + rand() * (tnSpec.range[1] - tnSpec.range[0]);
    const fp = fpFixed ?? sampleDiscrete(rand, FP_DIST.values, FP_DIST.probs);
    const allow = dtAllow(fp);
    let total = 0;
    let eps0 = 0;
    for (let j = 0; j < ny; j++) {
      const eps = sigma > 0 ? gaussian(rand) * sigma : 0;
      if (j === 0) eps0 = eps;
      const c = upperCount(sorted[j], tn + allow - eps);
      total += c;
      if (c >= 1) anyCount++;
    }
    days[s] = total / ny;
    bsm[s] = allow - (amMed + eps0 - tn);
  }
  const daysSorted = Float64Array.from(days).sort();
  const bsmSorted = Float64Array.from(bsm).sort();
  let mean = 0;
  for (const d of days) mean += d;
  return {
    days_mean: mean / n,
    days_p10: percentile(daysSorted, 10),
    days_p90: percentile(daysSorted, 90),
    p_any: anyCount / (n * ny),
    bsm_med: percentile(bsmSorted, 50),
    bsm_p10: percentile(bsmSorted, 10),
    bsm_p90: percentile(bsmSorted, 90),
    rail_am_med: amMed,
    bsm_samples: bsm,
  };
}

/** Month (5..9) of each index of a May-September daily array. */
export function warmSeasonMonth(i: number): number {
  if (i < 31) return 5;
  if (i < 61) return 6;
  if (i < 92) return 7;
  if (i < 123) return 8;
  return 9;
}

/** Shift each warm-season year by a monthly tasmax delta (12 values, Jan..Dec). */
export function shiftYears(years: number[][], delta12: number[]): number[][] {
  return years.map((y) => y.map((v, i) => v + delta12[warmSeasonMonth(i) - 1]));
}
