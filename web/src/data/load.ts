import { useEffect, useState } from "react";
import { dataUrl } from "../config";
import type { CellDetail, Network, Route, Summary, Validation, ExampleIndex, Place } from "./types";

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export function useJson<T>(path: string | null): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null; path: string | null }>({ data: null, error: null, path: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    loadJson<T>(path)
      .then((d) => alive && setState({ data: d, error: null, path }))
      .catch((e: unknown) => alive && setState({ data: null, error: String(e), path }));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path || state.path !== path) return { data: null, error: null };
  return { data: state.data, error: state.error };
}

export const useSummary = () => useJson<Summary>("summary.json");
export const useNetwork = () => useJson<Network>("network.json");
export const useRoutes = () => useJson<Route[]>("routes.json");
export const useValidation = () => useJson<Validation>("validation.json");
export const useCell = (cid: string | null) => useJson<CellDetail>(cid ? `cells/${cid}.json` : null);
export const useExamples = () => useJson<ExampleIndex[]>("examples/index.json");
export const usePlaces = () => useJson<Place[]>("places.json");
export const useAnnual = () => useJson<{ years: number[]; values: Record<string, Record<string, (number | null)[]>> }>("annual.json");
export type SegmentFC = GeoJSON.FeatureCollection<GeoJSON.LineString, import("./types").SegmentProps>;
export const useSegments = () => useJson<SegmentFC>("segments.geojson");
export const loadCell = (cid: string) => loadJson<CellDetail>(`cells/${cid}.json`);
