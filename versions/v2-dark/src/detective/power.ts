// Live NASA POWER requests from the browser (the API sends Access-Control-Allow-Origin: *), cached in IndexedDB.
export const DETECTIVE_PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN", "CLOUD_AMT", "GWETROOT", "EVLAND", "SNODP", "QV2M"];
export const FIRST_YEAR = 1981;
export const LAST_YEAR = 2025;

export interface PowerDaily {
  start: string;
  data: Record<string, number[]>;
  units: Record<string, string>;
  sources: string[];
  url: string;
  lat: number;
  lon: number;
}

const DB = "td-power";
function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("daily");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function cacheGet(key: string): Promise<PowerDaily | null> {
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction("daily").objectStore("daily").get(key);
      req.onsuccess = () => resolve((req.result as PowerDaily) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function cacheSet(key: string, v: PowerDaily) {
  const db = await idb();
  if (!db) return;
  try {
    db.transaction("daily", "readwrite").objectStore("daily").put(v, key);
  } catch {
    /* quota or private mode */
  }
}

export async function fetchPowerDaily(lat: number, lon: number, signal?: AbortSignal): Promise<PowerDaily> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = await cacheGet(key);
  if (hit) return hit;
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${DETECTIVE_PARAMS.join(",")}` +
    `&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=${FIRST_YEAR}0101&end=${LAST_YEAR}1231&format=JSON&time-standard=LST`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`NASA POWER answered HTTP ${r.status}`);
  const j = await r.json();
  const params = j.properties?.parameter as Record<string, Record<string, number>>;
  if (!params) throw new Error("NASA POWER returned no data for this point");
  const data: Record<string, number[]> = {};
  let start = "";
  for (const [k, obj] of Object.entries(params)) {
    const keys = Object.keys(obj).sort();
    start = keys[0];
    data[k] = keys.map((d) => obj[d]);
  }
  const units = Object.fromEntries(Object.entries(j.parameters ?? {}).map(([k, v]) => [k, (v as { units: string }).units]));
  const out: PowerDaily = { start, data, units, sources: j.header?.sources ?? [], url, lat, lon };
  cacheSet(key, out);
  return out;
}
