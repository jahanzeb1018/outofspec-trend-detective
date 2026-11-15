// Shared lookups used by both the rule-based assistant and the SI tools (closed catalog only).
import { loadJson } from "../data/load";
import type { Place, Route, Summary } from "../data/types";
import { REGION_TYPES } from "../content/catalog";

export interface CellPlace {
  cell: string;
  place: string;
  lat: number;
  lon: number;
  km: number;
}

export async function cellPlaces(): Promise<CellPlace[]> {
  const fc = await loadJson<GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; place: string; lat: number; lon: number; km: number }>>("cells.geojson");
  return fc.features.map((f) => ({ cell: f.properties.c, place: f.properties.place, lat: f.properties.lat, lon: f.properties.lon, km: f.properties.km }));
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Spanish place -> the cell with most track among cells named after it. */
export async function findSpanishCell(text: string): Promise<CellPlace | null> {
  const cps = await cellPlaces();
  const t = norm(text);
  const hits = cps.filter((c) => t.includes(norm(c.place)));
  if (!hits.length) return null;
  hits.sort((a, b) => b.place.length - a.place.length || b.km - a.km);
  return hits[0];
}

export async function findRoute(text: string): Promise<Route | null> {
  const routes = await loadJson<Route[]>("routes.json");
  const t = norm(text);
  const scored = routes
    .map((r) => {
      const names = r.stations.map((s) => norm(s.name.replace(/ (Atocha|Chamartín|Sants)$/, "")));
      const first = names[0];
      const last = names[names.length - 1];
      const i1 = t.indexOf(first);
      const i2 = t.indexOf(last);
      const score = (i1 >= 0 ? 1 : 0) + (i2 >= 0 ? 1 : 0) + (i1 >= 0 && i2 > i1 ? 0.5 : 0);
      return { r, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.r ?? null;
}

export async function findWorldPlace(text: string): Promise<Place | null> {
  const places = await loadJson<Place[]>("places.json");
  const t = ` ${norm(text)} `;
  let best: Place | null = null;
  for (const p of places) {
    const n = norm(p.n);
    if (n.length < 3) continue;
    if (t.includes(` ${n} `) || t.includes(` ${n}?`) || t.includes(` ${n},`) || t.includes(` ${n}.`)) {
      if (!best || n.length > norm(best.n).length) best = p;
    }
  }
  return best;
}

export function findRegionType(text: string) {
  const t = norm(text);
  const keys: Record<string, string[]> = {
    desert: ["desert", "desierto", "sahara", "arid", "arido"],
    rainforest: ["rain forest", "rainforest", "selva", "amazon", "jungla"],
    estuary: ["estuary", "estuario", "delta", "bay", "bahia"],
    city: ["big city", "city", "ciudad", "urban", "urbano"],
    mountains: ["mountain", "montana", "alps", "alpes", "pirineo", "sierra"],
    coast: ["coast", "costa", "beach", "playa", "sea", "mar "],
    polar: ["arctic", "artico", "polar", "antarctic", "glacier", "glaciar"],
  };
  for (const r of REGION_TYPES) if (keys[r.id].some((k) => t.includes(k))) return r;
  return null;
}

export async function cellNumbers(cellId: string, ind: string) {
  const s = await loadJson<Summary>("summary.json");
  const c = s.cells[cellId]?.[ind];
  if (!c) return null;
  return { cell: cellId, indicator: ind, now_1996_2025: c.now, mean_1981_1990: c.early, mean_2016_2025: c.late, sen_per_decade: c.sen, ci95_per_decade: [c.lo, c.hi], p_value: c.p, significant_single_test: c.raw, significant_after_fdr: c.fdr, too_rare: c.rare, future_median_min_max: c.fut ?? null };
}
