// Shared logic for the v2 "case file" experience: verdicts, plain words, clue selection.
import type { CellIndicatorSummary, Validation } from "../data/types";
import { fmt } from "../config";

export type VerdictClass = "up" | "down" | "hint-up" | "hint-down" | "none" | "rare";
export interface Verdict {
  cls: VerdictClass;
  stamp: string;
  plain: string;
}

type IndSummary = CellIndicatorSummary;

/** Verdict from the pipeline's tests: Mann-Kendall (Hamed-Rao) p < 0.05 and Benjamini-Hochberg q < 0.10 across Spain. */
export function verdictOf(r: IndSummary | undefined | null): Verdict {
  if (!r || r.rare) return { cls: "rare", stamp: "Too rare to judge", plain: "It almost never happens here, so a trend can't be tested." };
  const up = (r.sen ?? 0) > 0 || (r.sen === 0 && (r.late ?? 0) > (r.early ?? 0));
  if (r.fdr) return up ? { cls: "up", stamp: "Confirmed ↑", plain: "Rising — and very unlikely to be chance." } : { cls: "down", stamp: "Confirmed ↓", plain: "Falling — and very unlikely to be chance." };
  if (r.raw) return up ? { cls: "hint-up", stamp: "Signs ↑", plain: "Probably rising, but not proven once we account for testing many places." } : { cls: "hint-down", stamp: "Signs ↓", plain: "Probably falling, but not proven once we account for testing many places." };
  return { cls: "none", stamp: "No clear change", plain: "The ups and downs are too large to see a steady change." };
}

/** "less than 1 in 1,000" style wording for a p-value. */
export function chanceWords(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "unknown";
  if (p < 0.001) return "less than 1 in 1,000";
  if (p < 0.01) return "less than 1 in 100";
  if (p < 0.05) return "less than 1 in 20";
  if (p < 0.1) return "about 1 in 10";
  return `about 1 in ${Math.max(2, Math.round(1 / p))}`;
}

export const nf = (v: number | null | undefined, d = 0) => fmt(v, d);
/** One decimal below 10, none above. */
export const smart = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : Math.abs(v) < 10 ? fmt(v, 1) : fmt(v, 0));

export interface ClueText {
  title: string;
  unit: string;
  short: string;
  means: string;
  cold?: boolean;
}
export const CLUE: Record<string, ClueText> = {
  HOT40: { title: "Days above 40 °C", unit: "days a year at or above 40 °C", short: "Days ≥ 40 °C", means: "40 °C air puts steel rails at 55–60 °C in the sun — the range where track engineers start watching for buckling and may slow trains down." },
  HOT35: { title: "Days above 35 °C", unit: "days a year at or above 35 °C", short: "Days ≥ 35 °C", means: "35 °C air means roughly 50–55 °C rail. More of these days means more hours of thermal stress, and more shifts when track work has to stop." },
  HOT38: { title: "Days above 38 °C", unit: "days a year at or above 38 °C", short: "Days ≥ 38 °C", means: "38 °C air means roughly 52–57 °C rail on a sunny afternoon." },
  RAIL_AM: { title: "The hottest rail of the year", unit: "°C, estimated rail temperature on the hottest afternoon", short: "Hottest rail", means: "Above about 60 °C, a recently repaired track has no safety margin left against buckling (US Federal Railroad Administration model)." },
  TXX: { title: "The hottest day of the year", unit: "°C, highest air temperature of the year", short: "Hottest day", means: "The hottest day sets the highest rail temperature of the year." },
  TN20: { title: "Nights that never cool down", unit: "nights a year staying above 20 °C", short: "Tropical nights", means: "Warm nights don't let the steel cool between hot days — and night is when most track maintenance happens." },
  HOTSPELL: { title: "The longest heatwave", unit: "days in a row at or above 38 °C", short: "Longest hot spell", means: "Long spells leave no cool day for inspections and repairs." },
  FROST: { title: "Frost days", unit: "days a year below 0 °C", short: "Frost days", means: "Cold puts welded rail in tension. Fewer frost days means fewer cold-weather rail breaks — the good news in the data.", cold: true },
  COLD5: { title: "Hard-frost days", unit: "days a year at or below −5 °C", short: "Hard frost", means: "Hard frost is when welded rail is pulled hardest and breaks concentrate.", cold: true },
  R20: { title: "Heavy-rain days", unit: "days a year with 20 mm or more", short: "Heavy rain", means: "Heavy rain is what washes out embankments, cuttings and drainage." },
};

/** Pick the heat-day indicator that actually happens here. */
export function heatIndFor(c: Record<string, IndSummary> | undefined): "HOT40" | "HOT35" | "TXX" {
  if (!c) return "HOT40";
  if ((c.HOT40?.late ?? 0) >= 2 && !c.HOT40?.rare) return "HOT40";
  if ((c.HOT35?.late ?? 0) >= 2 && !c.HOT35?.rare) return "HOT35";
  return "TXX";
}

export function nearestStation(v: Validation | null, lat: number, lon: number, maxKm = 80) {
  if (!v) return null;
  let best: (Validation["stations"][number] & { d: number }) | null = null;
  for (const s of v.stations) {
    const d = haversine(lat, lon, s.lat, s.lon);
    if (d <= maxKm && (!best || d < best.d)) best = { ...s, d };
  }
  return best;
}

export function haversine(a: number, b: number, c: number, d: number) {
  const R = 6371;
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const mean = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Mean of a yearly series over [y0, y1]. */
export function periodMean(years: number[], vals: (number | null)[], y0: number, y1: number) {
  return mean(years.map((y, i) => (y >= y0 && y <= y1 ? vals[i] : null)));
}

export const DAYS_OF_DATA = 16436; // 1981-01-01 .. 2025-12-31

export function cellBounds(cid: string, pad = 0.35): [[number, number], [number, number]] {
  const [la, lo] = cid.split("_").map(Number);
  return [
    [lo - 0.3125 - pad, la - 0.25 - pad],
    [lo + 0.3125 + pad, la + 0.25 + pad],
  ];
}

export function lineBounds(coords: [number, number][], pad = 0.15): [[number, number], [number, number]] {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const [x, y] of coords) {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  }
  return [
    [w - pad, s - pad],
    [e + pad, n + pad],
  ];
}

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const calIndex = (m: number, d: number) => DAYS_IN.slice(0, m - 1).reduce((a, b) => a + b, 0) + d - 1;
export const cleanStation = (n: string) => n.replace(/ (Atocha|Chamartín|Sants)$/, "");

/** Parse "15 July", "July 15", "15/07" or a month name into MM-DD. */
export function parseDate(text: string): string | null {
  const t = text.toLowerCase();
  const en = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const es = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mm = en.findIndex((m, i) => new RegExp(`\\b(${m}|${es[i]})`).test(t));
  const day = t.match(/\b(\d{1,2})(st|nd|rd|th)?\b/);
  if (mm >= 0) return `${String(mm + 1).padStart(2, "0")}-${String(day ? Math.min(DAYS_IN[mm], Math.max(1, Number(day[1]))) : 15).padStart(2, "0")}`;
  const dm = t.match(/\b(\d{1,2})[/.-](\d{1,2})\b/);
  if (dm && Number(dm[2]) >= 1 && Number(dm[2]) <= 12) return `${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  return null;
}

export const PRESET_LABEL: Record<string, string> = { strong: "Modern", average: "Typical", weak: "Just repaired" };
export function band(m: number) {
  if (m < 0) return { t: "No margin", c: "var(--bad)", n: "On the hottest days the track could kink sideways." };
  if (m < 100 / 9) return { t: "Tight", c: "var(--tight)", n: "Close to the limit on the hottest days." };
  if (m < 200 / 9) return { t: "Comfortable", c: "var(--ok)", n: "Holds the heat with room to spare." };
  return { t: "Very comfortable", c: "#6fd8a6", n: "Plenty of room even on the hottest days." };
}
