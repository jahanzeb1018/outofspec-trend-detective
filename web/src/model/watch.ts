// Heat & cold watch - mirrors pipeline/watch.py (status rules) and pipeline/climate.py (rail model v1).
export interface WatchCell {
  lat: number;
  lon: number;
  tmax: number[][]; // [month][quantile]
  tmin: number[][];
}
export interface WatchData {
  quantiles: number[];
  tn_typical: number;
  allow: { strong: number; average: number; weak: number };
  g_ref: number;
  v_ref: number;
  rail_dt_ref: number;
  rail_cap: [number, number];
  cells: Record<string, WatchCell>;
}
export type Status = "ok" | "unusual-warm" | "unusual-cold" | "heat-watch" | "heat-warning" | "cold-watch" | "cold-warning";
export const STATUS_LABEL: Record<Status, string> = {
  ok: "Normal",
  "unusual-warm": "Unusually warm",
  "unusual-cold": "Unusually cold",
  "heat-watch": "Heat watch",
  "heat-warning": "Heat warning",
  "cold-watch": "Cold watch",
  "cold-warning": "Cold warning",
};
export const STATUS_COLOR: Record<Status, string> = {
  ok: "#b9c0c9",
  "unusual-warm": "#f3cf7d",
  "unusual-cold": "#9dbcf3",
  "heat-watch": "#f2a33a",
  "heat-warning": "#d63a2f",
  "cold-watch": "#3b82f6",
  "cold-warning": "#1e3a8a",
};
export const STATUS_RANK: Record<Status, number> = { ok: 0, "unusual-cold": 1, "unusual-warm": 2, "cold-watch": 3, "heat-watch": 4, "cold-warning": 5, "heat-warning": 6 };
/** A real watch/warning (physically relevant for the track), as opposed to "unusual for the season". */
export const isAlert = (s: Status) => s === "heat-watch" || s === "heat-warning" || s === "cold-watch" || s === "cold-warning";
export const isWarmSide = (s: Status) => s === "heat-watch" || s === "heat-warning" || s === "unusual-warm";
/** Rail within this many degrees of a just-repaired track's limit counts for a heat watch when the heat is also unusual. */
export const WATCH_BUFFER = 10;

export function pctFromQ(v: number, q: number[], qs: number[]): number {
  const xs = [0, ...qs, 100];
  const ys = [q[0] - (q[1] - q[0]), ...q, q[q.length - 1] + (q[q.length - 1] - q[q.length - 2])];
  if (v <= ys[0]) return 0;
  if (v >= ys[ys.length - 1]) return 100;
  for (let i = 1; i < ys.length; i++) {
    if (v <= ys[i]) {
      const f = ys[i] === ys[i - 1] ? 1 : (v - ys[i - 1]) / (ys[i] - ys[i - 1]);
      return xs[i - 1] + f * (xs[i] - xs[i - 1]);
    }
  }
  return 100;
}

const dayLength = (lat: number, doy: number) => {
  const decl = ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + doy)) / 365);
  const x = Math.min(1, Math.max(-1, -Math.tan((lat * Math.PI) / 180) * Math.tan(decl)));
  return (24 / Math.PI) * Math.acos(x);
};
const hConv = (v: number) => 5.7 + 3.8 * Math.max(v, 0);

/** Daily max rail temperature from daily max air temperature, daily solar energy (kWh/m2) and 2 m wind (m/s). */
export function railTemp(tmax: number, hKwh: number, wind2m: number, lat: number, doy: number, w: WatchData): number {
  const gPeak = (Math.PI * hKwh * 1000) / (2 * Math.max(dayLength(lat, doy), 1e-6));
  const dt = w.rail_dt_ref * (gPeak / w.g_ref) * (hConv(w.v_ref) / hConv(wind2m));
  return tmax + Math.min(w.rail_cap[1], Math.max(w.rail_cap[0], dt));
}

export function statusFor(tmax: number, tmin: number, rail: number, qmax: number[], qmin: number[], w: WatchData): Status {
  const mWeak = w.allow.weak - (rail - w.tn_typical);
  const hot99 = tmax >= qmax[w.quantiles.indexOf(99)];
  const cold1 = tmin <= qmin[w.quantiles.indexOf(1)];
  if (mWeak < 0 && hot99) return "heat-warning";
  if (mWeak < 0 || (hot99 && mWeak < WATCH_BUFFER)) return "heat-watch";
  if (tmin <= -10) return "cold-warning";
  if (tmin <= -5 || (cold1 && tmin <= 0)) return "cold-watch";
  if (hot99) return "unusual-warm";
  if (cold1) return "unusual-cold";
  return "ok";
}

export const marginFor = (rail: number, track: "strong" | "average" | "weak", w: WatchData) => w.allow[track] - (rail - w.tn_typical);

const rank = (pct: number) => (pct >= 99.9 ? "among the hottest 0.1% of days" : `hotter than ${Math.min(99, Math.floor(pct))}% of days`);

export function plainStatus(s: Status, d: { rail: number; pct: number; tmin: number }): string {
  switch (s) {
    case "heat-warning":
      return `Rail could reach ~${Math.round(d.rail)} °C, ${rank(d.pct)} here for the time of year since 1981. Recently repaired track would have no thermal margin.`;
    case "heat-watch":
      return d.rail >= 60
        ? `Rail could reach ~${Math.round(d.rail)} °C: recently repaired track would have no thermal margin.`
        : `Rail could reach ~${Math.round(d.rail)} °C on unusually hot days (${rank(d.pct)} for the season) — close to the limit for recently repaired track.`;
    case "unusual-warm":
      return `Unusually warm for the season (${rank(d.pct)} since 1981), but rails stay far from their limits (~${Math.round(d.rail)} °C).`;
    case "cold-warning":
      return `Hard frost (${Math.round(d.tmin)} °C): welded rail is in strong tension, rail breaks become more likely.`;
    case "cold-watch":
      return `Frost (${Math.round(d.tmin)} °C), unusual for this place: rails contract and pull.`;
    case "unusual-cold":
      return `Unusually cold for the season (${Math.round(d.tmin)} °C), but above freezing.`;
    default:
      return "Normal for this place and season.";
  }
}
