/// <reference lib="webworker" />
import { shiftYears, simulate, type Preset, type SimResult, type TnSpec } from "./buckling";

export interface McRequest {
  id: number;
  ref: number[][];
  recent: number[][];
  deltas: Record<string, number[]>; // model -> 12 monthly tasmax deltas for the chosen scenario/period
  preset: Preset;
  tn: TnSpec;
  fp: number | null;
}
export interface McResponse {
  id: number;
  ref: SimResult;
  recent: SimResult;
  future: { med: SimResult; daysMin: number; daysMax: number; models: number } | null;
  futureYears: number[][]; // pooled shifted years for the load chart
}

const strip = (r: SimResult): SimResult => ({ ...r, bsm_samples: undefined });

self.onmessage = (e: MessageEvent<McRequest>) => {
  const { id, ref, recent, deltas, preset, tn, fp } = e.data;
  const opts = { tn, fp };
  const refR = simulate(ref, preset, { ...opts, n: 2000, seed: 11 });
  const recR = simulate(recent, preset, { ...opts, n: 2000, seed: 12 });
  const models = Object.keys(deltas);
  let future: McResponse["future"] = null;
  const pooled: number[][] = [];
  if (models.length) {
    const per = models.map((m, i) => {
      const yrs = shiftYears(ref, deltas[m]);
      pooled.push(...yrs);
      return simulate(yrs, preset, { ...opts, n: 600, seed: 100 + i });
    });
    const med = (k: keyof SimResult) => {
      const v = per.map((r) => r[k] as number).sort((a, b) => a - b);
      const n = v.length;
      return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
    };
    future = {
      med: {
        days_mean: med("days_mean"), days_p10: med("days_p10"), days_p90: med("days_p90"), p_any: med("p_any"),
        bsm_med: med("bsm_med"), bsm_p10: med("bsm_p10"), bsm_p90: med("bsm_p90"), rail_am_med: med("rail_am_med"),
      },
      daysMin: Math.min(...per.map((r) => r.days_mean)),
      daysMax: Math.max(...per.map((r) => r.days_mean)),
      models: models.length,
    };
  }
  const res: McResponse = { id, ref: strip(refR), recent: strip(recR), future, futureYears: pooled };
  (self as unknown as Worker).postMessage(res);
};
