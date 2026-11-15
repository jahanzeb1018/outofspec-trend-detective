// 7-day forecast for every NASA cell of the network (Open-Meteo, free, CORS-enabled, CC BY 4.0), turned into a
// rail heat & cold watch with the NASA-based climatology and rail model.
import { useEffect, useState } from "react";
import { loadJson } from "./load";
import { pctFromQ, railTemp, statusFor, STATUS_RANK, type Status, type WatchData } from "../model/watch";

export interface WatchDay {
  date: string;
  cells: Record<string, { tmax: number; tmin: number; rail: number; pct: number; status: Status }>;
}
export interface WatchResult {
  days: WatchDay[];
  issued: string;
  source: string;
}

const KEY = "td-watch-v1";

type Daily = Record<string, (number | string)[]>;

async function fetchChunk(cells: [string, { lat: number; lon: number }][]): Promise<Daily[]> {
  const lat = cells.map(([, c]) => c.lat.toFixed(2)).join(",");
  const lon = cells.map(([, c]) => c.lon.toFixed(3)).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,wind_speed_10m_mean&timezone=Europe%2FMadrid&forecast_days=7`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      return ((Array.isArray(j) ? j : [j]) as { daily: Daily }[]).map((x) => x.daily);
    }
    if (attempt >= 1 || (r.status !== 429 && r.status < 500)) throw new Error(`forecast HTTP ${r.status}`);
    await new Promise((res) => setTimeout(res, 2500));
  }
}

/** Shared, CDN-cached copy from our own /api/forecast (one upstream call per hour for everyone). */
async function fetchShared(ids: string[]): Promise<Daily[] | null> {
  try {
    const r = await fetch(new URL("./api/forecast", window.location.href).href);
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null;
    const j = (await r.json()) as { ids: string[]; daily: Daily[] };
    if (j.ids.length !== ids.length || j.ids.some((id, i) => id !== ids[i])) return null;
    return j.daily;
  } catch {
    return null;
  }
}

export async function computeWatch(): Promise<WatchResult> {
  try {
    const hit = sessionStorage.getItem(KEY);
    if (hit) {
      const v = JSON.parse(hit) as WatchResult & { t: number };
      if (Date.now() - v.t < 3600_000) return v;
    }
  } catch {
    /* storage unavailable */
  }
  const w = await loadJson<WatchData>("watch.json");
  const entries = Object.entries(w.cells);
  let results = await fetchShared(entries.map(([id]) => id));
  if (!results) {
    results = [];
    for (let i = 0; i < entries.length; i += 80) results.push(...(await fetchChunk(entries.slice(i, i + 80))));
  }
  const all = results;
  const days: WatchDay[] = (all[0].time as string[]).map((d) => ({ date: d, cells: {} }));
  entries.forEach(([cid, c], k) => {
    const daily = all[k];
    days.forEach((day, i) => {
      const tmax = Number(daily.temperature_2m_max[i]);
      const tmin = Number(daily.temperature_2m_min[i]);
      const h = Number(daily.shortwave_radiation_sum[i]) / 3.6; // MJ -> kWh per m2
      const v2 = (Number(daily.wind_speed_10m_mean[i]) / 3.6) * 0.748; // km/h at 10 m -> m/s at 2 m (FAO-56 log law)
      if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) return;
      const dt = new Date(day.date + "T12:00:00");
      const month = dt.getMonth();
      const doy = Math.floor((dt.getTime() - new Date(dt.getFullYear(), 0, 0).getTime()) / 86400000);
      const rail = railTemp(tmax, Number.isFinite(h) ? h : 0, Number.isFinite(v2) ? v2 : w.v_ref, c.lat, doy, w);
      const qx = c.tmax[month];
      const qn = c.tmin[month];
      day.cells[cid] = { tmax, tmin, rail, pct: pctFromQ(tmax, qx, w.quantiles), status: statusFor(tmax, tmin, rail, qx, qn, w) };
    });
  });
  const out: WatchResult = { days, issued: new Date().toISOString(), source: "Open-Meteo forecast (CC BY 4.0) + NASA POWER climatology" };
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...out, t: Date.now() }));
  } catch {
    /* storage unavailable */
  }
  return out;
}

export function useWatch() {
  const [state, setState] = useState<{ data: WatchResult | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    computeWatch()
      .then((d) => alive && setState({ data: d, error: null }))
      .catch((e) => alive && setState({ data: null, error: String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Worst status over the forecast days for each cell. */
export function worstByCell(days: WatchDay[]): Record<string, { status: Status; day: string; rail: number; pct: number; tmin: number }> {
  const out: Record<string, { status: Status; day: string; rail: number; pct: number; tmin: number }> = {};
  for (const d of days)
    for (const [cid, c] of Object.entries(d.cells)) {
      const cur = out[cid];
      const better = !cur || STATUS_RANK[c.status] > STATUS_RANK[cur.status] || (STATUS_RANK[c.status] === STATUS_RANK[cur.status] && c.rail > cur.rail);
      if (better) out[cid] = { status: c.status, day: d.date, rail: c.rail, pct: c.pct, tmin: c.tmin };
    }
  return out;
}
