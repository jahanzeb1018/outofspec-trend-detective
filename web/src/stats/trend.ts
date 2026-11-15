// Trend statistics - identical algorithms to pipeline/stats.py (parity tested against golden files).
import { median, normCdf, normPpf, tTwoSided } from "./math";

export interface TrendResult {
  n: number;
  sen_slope: number; // per time step (year)
  sen_intercept: number;
  ci_low: number;
  ci_high: number;
  mk_s: number;
  mk_var_s: number;
  mk_z: number;
  p_mk_hr: number;
  tau: number;
  ols_slope: number;
  p_ols: number;
}

function senSlopes(y: number[]): Float64Array {
  const n = y.length;
  const out = new Float64Array((n * (n - 1)) / 2);
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out[k++] = (y[j] - y[i]) / (j - i);
  return out;
}

function mkScore(y: number[]): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) for (let j = i + 1; j < y.length; j++) s += Math.sign(y[j] - y[i]);
  return s;
}

function mkVariance(y: number[]): number {
  const n = y.length;
  const counts = new Map<number, number>();
  for (const v of y) counts.set(v, (counts.get(v) ?? 0) + 1);
  let tie = 0;
  for (const tp of counts.values()) tie += tp * (tp - 1) * (2 * tp + 5);
  return (n * (n - 1) * (2 * n + 5) - tie) / 18;
}

function rankAverage(x: number[]): number[] {
  const idx = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(x.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = r;
    i = j + 1;
  }
  return ranks;
}

function acf(x: number[], nlags: number): number[] {
  const n = x.length;
  const m = x.reduce((a, b) => a + b, 0) / n;
  const y = x.map((v) => v - m);
  const out: number[] = [];
  let c0 = 0;
  for (let k = 0; k <= nlags; k++) {
    let s = 0;
    for (let i = 0; i + k < n; i++) s += y[i] * y[i + k];
    if (k === 0) c0 = s;
    out.push(c0 === 0 ? 0 : s / c0); // constant ranks: no autocorrelation correction (same as stats.py)
  }
  return out;
}

function zScore(s: number, varS: number): number {
  if (varS <= 0) return 0;
  if (s > 0) return (s - 1) / Math.sqrt(varS);
  if (s < 0) return (s + 1) / Math.sqrt(varS);
  return 0;
}

function interpRank(sorted: Float64Array, idx: number): number {
  const i = Math.min(Math.max(idx, 0), sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const f = i - lo;
  return sorted[lo] * (1 - f) + sorted[hi] * f;
}

export function trend(y: number[], alpha = 0.05): TrendResult {
  const n = y.length;
  if (n < 4 || y.some((v) => !Number.isFinite(v))) throw new Error("need >= 4 finite values");
  const slopes = senSlopes(y).sort();
  const slope = median(slopes);
  const intercept = median(y) - median(Array.from({ length: n }, (_, i) => i)) * slope;
  const s = mkScore(y);
  const varS = mkVariance(y);
  const c = varS > 0 ? normPpf(1 - alpha / 2) * Math.sqrt(varS) : 0;
  const N = slopes.length;
  const ciLow = interpRank(slopes, (N - c) / 2 - 1);
  const ciHigh = interpRank(slopes, (N + c) / 2);
  // Hamed & Rao (1998), conservative: never shrink the variance below the independent case
  const detrended = y.map((v, i) => v - (i + 1) * slope);
  const ranks = rankAverage(detrended);
  const r = acf(ranks, n - 1);
  const bound = normPpf(1 - alpha / 2) / Math.sqrt(n);
  let sni = 0;
  for (let i = 1; i < n; i++) if (!(r[i] >= -bound && r[i] <= bound)) sni += (n - i) * (n - i - 1) * (n - i - 2) * r[i];
  const nNs = Math.max(1, 1 + (2 / (n * (n - 1) * (n - 2))) * sni);
  const varMod = varS * nNs;
  const z = zScore(s, varMod);
  const pMk = 2 * (1 - normCdf(Math.abs(z)));
  // OLS
  const tm = (n - 1) / 2;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (i - tm) ** 2;
    sxy += (i - tm) * (y[i] - ym);
  }
  const b = sxy / sxx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (ym + b * (i - tm))) ** 2;
  let pOls: number;
  if (sse <= 1e-24) pOls = b !== 0 ? 0 : 1;
  else {
    const se = Math.sqrt(sse / (n - 2) / sxx);
    pOls = tTwoSided(Math.abs(b / se), n - 2);
  }
  return { n, sen_slope: slope, sen_intercept: intercept, ci_low: ciLow, ci_high: ciHigh, mk_s: s, mk_var_s: varMod, mk_z: z, p_mk_hr: pMk, tau: s / (0.5 * n * (n - 1)), ols_slope: b, p_ols: pOls };
}

/** Approximate extra years for 50% power (same closed form as pipeline/stats.py). */
export function yearsNeeded(y: number[], slope: number, intercept: number): number | null {
  const n = y.length;
  if (slope === 0) return null;
  const resid = y.map((v, i) => v - (intercept + slope * i));
  const m = resid.reduce((a, b) => a + b, 0) / n;
  let ss = 0;
  for (const v of resid) ss += (v - m) ** 2;
  const sd = Math.sqrt(ss / (n - 1));
  if (sd === 0) return 0;
  let num = 0;
  for (let i = 1; i < n; i++) num += (resid[i] - m) * (resid[i - 1] - m);
  let phi = ss > 0 ? num / ss : 0;
  phi = Math.min(Math.max(phi, 0), 0.9);
  const sig = sd * Math.sqrt((1 + phi) / (1 - phi));
  const nReq = Math.cbrt(12 * ((1.96 * sig) / Math.abs(slope)) ** 2);
  return Math.max(0, Math.ceil(nReq - n));
}

/** Benjamini-Hochberg step-up; NaN p-values are never rejected. */
export function bhFdr(p: number[], alpha: number): { rejected: boolean[]; q: number[] } {
  const idx = p.map((v, i) => [v, i] as const).filter(([v]) => Number.isFinite(v));
  const m = idx.length;
  const rejected = p.map(() => false);
  const q = p.map(() => NaN);
  if (m === 0) return { rejected, q };
  const order = [...idx].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ranked = order.map(([v], k) => (v * m) / (k + 1));
  for (let k = m - 2; k >= 0; k--) ranked[k] = Math.min(ranked[k], ranked[k + 1]);
  order.forEach(([, i], k) => (q[i] = Math.min(ranked[k], 1)));
  let last = -1;
  order.forEach(([v], k) => {
    if (v <= (alpha * (k + 1)) / m) last = k;
  });
  for (let k = 0; k <= last; k++) rejected[order[k][1]] = true;
  return { rejected, q };
}
