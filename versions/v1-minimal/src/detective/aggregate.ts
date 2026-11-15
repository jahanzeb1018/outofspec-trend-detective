// Detective-mode aggregation - mirrors pipeline/detective.py (parity tested).
// Daily values -> one value per season-year; a season-year is valid with >= 90% non-missing days.

export type Season = "annual" | "DJF" | "MAM" | "JJA" | "SON";
export const SEASONS: Season[] = ["annual", "DJF", "MAM", "JJA", "SON"];
const SEASON_MONTHS: Record<Exclude<Season, "annual">, number[]> = { DJF: [12, 1, 2], MAM: [3, 4, 5], JJA: [6, 7, 8], SON: [9, 10, 11] };

export type Series = Record<string, Record<string, Record<Season, (number | null)[]>>>;

function longestRun(v: number[], pred: (x: number) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const x of v) {
    cur = pred(x) ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function applyIndicator(ind: string, v: number[]): number {
  if (ind === "mean") return v.reduce((a, b) => a + b, 0) / v.length;
  if (ind === "sum") return v.reduce((a, b) => a + b, 0);
  if (ind === "max") return Math.max(...v);
  if (ind === "min") return Math.min(...v);
  if (ind === "drymax") return longestRun(v, (x) => x < 1);
  const [op, thrS] = ind.split(":");
  const t = Number(thrS);
  let c = 0;
  for (const x of v) if (op === "ge" ? x >= t : op === "gt" ? x > t : x < t) c++;
  return c;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Daily records indexed as [year][month] -> values (NaN for missing). */
export function bucketDaily(startISO: string, values: number[]): Map<number, Map<number, number[]>> {
  const out = new Map<number, Map<number, number[]>>();
  const d0 = Date.UTC(Number(startISO.slice(0, 4)), Number(startISO.slice(4, 6)) - 1, Number(startISO.slice(6, 8)));
  for (let i = 0; i < values.length; i++) {
    const d = new Date(d0 + i * 86400000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    if (!out.has(y)) out.set(y, new Map());
    const ym = out.get(y)!;
    if (!ym.has(m)) ym.set(m, []);
    const v = values[i];
    ym.get(m)!.push(v <= -998 ? NaN : v);
  }
  return out;
}

export function aggregateVariable(startISO: string, values: number[], indicators: string[], years: number[]) {
  const b = bucketDaily(startISO, values);
  const get = (y: number, m: number) => b.get(y)?.get(m) ?? [];
  const res: Record<string, Record<Season, (number | null)[]>> = {};
  for (const ind of indicators) {
    res[ind] = {} as Record<Season, (number | null)[]>;
    for (const season of SEASONS) {
      res[ind][season] = years.map((y) => {
        let sel: number[];
        let expected: number;
        if (season === "annual") {
          sel = [];
          for (let m = 1; m <= 12; m++) sel.push(...get(y, m));
          expected = isLeap(y) ? 366 : 365;
        } else if (season === "DJF") {
          sel = [...get(y - 1, 12), ...get(y, 1), ...get(y, 2)];
          expected = 31 + 31 + (isLeap(y) ? 29 : 28);
        } else {
          const ms = SEASON_MONTHS[season];
          sel = ms.flatMap((m) => get(y, m));
          expected = ms.reduce((a, m) => a + daysIn(y, m), 0);
        }
        const v = sel.filter((x) => Number.isFinite(x));
        return v.length >= 0.9 * expected ? round3(applyIndicator(ind, v)) : null;
      });
    }
  }
  return res;
}
