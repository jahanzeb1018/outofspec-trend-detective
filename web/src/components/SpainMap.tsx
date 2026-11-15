import { useEffect, useRef } from "react";
import { maplibregl } from "../maplibre";
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { dataUrl } from "../config";
import type { SegmentProps } from "../data/types";

export interface Arrow {
  from: [number, number];
  to: [number, number];
  ok: boolean;
}
export interface Pulse {
  lon: number;
  lat: number;
  color: string;
}

interface Props {
  segColors?: Record<string, string> | null; // keyed by NASA cell id
  cellColors?: Record<string, string> | null;
  cellOpacity?: number;
  stipple?: string[];
  selectedSegment?: string | null;
  selectedCell?: string | null;
  route?: [number, number][] | null;
  arrows?: Arrow[] | null;
  pulses?: Pulse[] | null;
  dimSegments?: boolean;
  lineWidth?: number;
  onSegment?: (p: SegmentProps) => void;
  onHoverSegment?: (p: SegmentProps | null) => void;
  onCell?: (cellId: string) => void;
  interactive?: boolean;
  label?: string;
  className?: string;
  /** Zoom (animated) to these bounds whenever they change; null = whole of Spain. */
  fit?: [[number, number], [number, number]] | null;
  /** Map padding for fitting, to leave room for overlays. */
  pad?: number | { top: number; bottom: number; left: number; right: number };
  /**
   * Fast animation mode: line colour per NASA cell applied with feature-state (no re-layout), so the map can change
   * many times per second. When set, `segColors` is ignored and the original segments stay only for clicking.
   */
  fastColors?: Record<string, string> | null;
  /** Fast markers: "cellId|kind" keys switched on with feature-state; kinds and colours in `markerStyle`. */
  markers?: string[] | null;
  markerStyle?: Record<string, { color: string; dx?: number; dy?: number }>;
}

interface FastIndex {
  cell: Map<string, number>;
  mk: Map<string, number>;
  last: Map<number, string | null>;
  on: Set<number>;
}

const SPAIN_BOUNDS: [[number, number], [number, number]] = [[-9.6, 35.8], [3.6, 43.9]];
const BASE_LINE = "#c3c8cf";

function matchExpr(colors: Record<string, string> | null | undefined, fallback: string): ExpressionSpecification | string {
  const entries = Object.entries(colors ?? {});
  if (!entries.length) return fallback;
  return ["match", ["get", "c"], ...entries.flat(), fallback] as unknown as ExpressionSpecification;
}

function dotsImage(): ImageData {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4);
  for (const [x, y] of [[1, 1], [5, 5]])
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = ((y + dy) * size + (x + dx)) * 4;
      data[i] = 12;
      data[i + 1] = 13;
      data[i + 2] = 15;
      data[i + 3] = 200;
    }
  return new ImageData(data, size, size);
}

export function SpainMap(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const propsRef = useRef(p);
  propsRef.current = p;
  const fast = useRef<FastIndex | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const lw = p.lineWidth ?? 1;
    const map = new maplibregl.Map({
      container: ref.current,
      bounds: SPAIN_BOUNDS,
      fitBoundsOptions: { padding: p.pad ?? 18 },
      attributionControl: false,
      interactive: p.interactive !== false,
      // a click that wobbles a few pixels is still a click, not a drag
      clickTolerance: 8,
      dragRotate: false,
      pitchWithRotate: false,
      style: {
        version: 8,
        sources: {
          iberia: { type: "geojson", data: dataUrl("iberia.geojson") },
          cells: { type: "geojson", data: dataUrl("cells.geojson") },
          segments: { type: "geojson", data: dataUrl("segments.geojson") },
          route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          arrows: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          pulses: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          celllines: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          markers: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#eef1f4" } },
          { id: "land", type: "fill", source: "iberia", paint: { "fill-color": "#fbfbfc" } },
          { id: "land-line", type: "line", source: "iberia", paint: { "line-color": "#d5d8dd", "line-width": 0.8 } },
          { id: "cells-fill", type: "fill", source: "cells", paint: { "fill-color": "#dadde2", "fill-opacity": 0 } },
          { id: "cells-stipple", type: "fill", source: "cells", paint: { "fill-pattern": "dots", "fill-opacity": 0.55 }, filter: ["in", ["get", "c"], ["literal", []]] },
          { id: "cells-sel", type: "line", source: "cells", paint: { "line-color": "#0c0d0f", "line-width": 1.5, "line-dasharray": [2, 2] }, filter: ["==", ["get", "c"], ""] },
          { id: "pulse-halo", type: "circle", source: "pulses", paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": 0.25, "circle-blur": 0.4 } },
          { id: "seg-casing", type: "line", source: "segments", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4.6 * lw, 9, 9 * lw] } },
          { id: "segments", type: "line", source: "segments", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": BASE_LINE, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.4 * lw, 9, 5.5 * lw] } },
          { id: "cell-lines", type: "line", source: "celllines", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["to-color", ["coalesce", ["feature-state", "col"], BASE_LINE]], "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.4 * lw, 9, 5.5 * lw] } },
          { id: "seg-sel", type: "line", source: "segments", layout: { "line-cap": "round" }, paint: { "line-color": "#0c0d0f", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 9] }, filter: ["==", ["get", "id"], ""] },
          { id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } },
          { id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0c0d0f", "line-width": 4 } },
          { id: "arrows", type: "line", source: "arrows", layout: { "line-cap": "round" }, paint: { "line-color": "#0c0d0f", "line-width": 1.4, "line-opacity": 0.55, "line-dasharray": [1, 2] } },
          { id: "arrows-end", type: "circle", source: "arrows", filter: ["==", ["get", "end"], 1], paint: { "circle-radius": 4, "circle-color": "#0c0d0f" } },
          { id: "pulse-core", type: "circle", source: "pulses", paint: { "circle-radius": 4.5, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } },
          { id: "mk-halo", type: "circle", source: "markers", paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": ["case", ["boolean", ["feature-state", "on"], false], 0.3, 0], "circle-blur": 0.4 } },
          { id: "mk-core", type: "circle", source: "markers", paint: { "circle-radius": 4.5, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5, "circle-opacity": ["case", ["boolean", ["feature-state", "on"], false], 1, 0], "circle-stroke-opacity": ["case", ["boolean", ["feature-state", "on"], false], 1, 0] } },
        ],
      },
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenStreetMap contributors (ODbL) · Natural Earth · NASA" }), "bottom-right");
    if (p.interactive !== false) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.on("load", () => {
      if (!map.hasImage("dots")) map.addImage("dots", dotsImage());
      ready.current = true;
      apply(map, propsRef.current, fast.current);
      if (propsRef.current.fastColors !== undefined) {
        // one feature per NASA cell (all its segments) + one marker per cell and kind, all with numeric ids
        fetch(dataUrl("segments.geojson"))
          .then((r) => r.json())
          .then((fc: GeoJSON.FeatureCollection<GeoJSON.LineString, { c: string }>) => {
            if (!mapRef.current) return;
            const byCell = new Map<string, GeoJSON.Position[][]>();
            for (const f of fc.features) {
              const arr = byCell.get(f.properties.c) ?? [];
              arr.push(f.geometry.coordinates);
              byCell.set(f.properties.c, arr);
            }
            const ids = [...byCell.keys()];
            const kinds = Object.entries(propsRef.current.markerStyle ?? {});
            const idx: FastIndex = { cell: new Map(), mk: new Map(), last: new Map(), on: new Set() };
            const lines: GeoJSON.Feature[] = ids.map((c, i) => {
              idx.cell.set(c, i);
              return { type: "Feature", id: i, properties: { c }, geometry: { type: "MultiLineString", coordinates: byCell.get(c)! } };
            });
            const marks: GeoJSON.Feature[] = [];
            ids.forEach((c, i) => {
              const [la, lo] = c.split("_").map(Number);
              kinds.forEach(([k, st], j) => {
                const id = i * kinds.length + j;
                idx.mk.set(`${c}|${k}`, id);
                marks.push({ type: "Feature", id, properties: { color: st.color }, geometry: { type: "Point", coordinates: [lo + (st.dx ?? 0), la + (st.dy ?? 0)] } });
              });
            });
            (map.getSource("celllines") as GeoJSONSource).setData({ type: "FeatureCollection", features: lines });
            (map.getSource("markers") as GeoJSONSource).setData({ type: "FeatureCollection", features: marks });
            map.once("idle", () => {
              fast.current = idx;
              apply(map, propsRef.current, idx);
            });
          })
          .catch(() => undefined);
      }
    });
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = ((t - t0) % 1800) / 1800;
      if (ready.current && propsRef.current.pulses?.length) {
        map.setPaintProperty("pulse-halo", "circle-radius", 6 + 16 * k);
        map.setPaintProperty("pulse-halo", "circle-opacity", 0.45 * (1 - k));
      }
      if (ready.current && fast.current && fast.current.on.size) {
        map.setPaintProperty("mk-halo", "circle-radius", 6 + 16 * k);
        map.setPaintProperty("mk-halo", "circle-opacity", ["case", ["boolean", ["feature-state", "on"], false], 0.45 * (1 - k), 0]);
      }
      raf = requestAnimationFrame(tick);
    };
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(tick);
    const box = (e: maplibregl.MapMouseEvent, r = 6): [maplibregl.PointLike, maplibregl.PointLike] => [
      [e.point.x - r, e.point.y - r],
      [e.point.x + r, e.point.y + r],
    ];
    /** The segment nearest to the pointer within a generous radius, so thin lines are easy to hit. */
    const nearest = (e: maplibregl.MapMouseEvent, r: number) => {
      const hits = map.queryRenderedFeatures(box(e, r), { layers: ["segments"] });
      if (hits.length <= 1) return hits[0] ?? null;
      const { lng, lat } = e.lngLat;
      let best = hits[0];
      let bd = Infinity;
      for (const h of hits) {
        const g = h.geometry;
        const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
        for (const line of lines)
          for (const [x, y] of line) {
            const d = (x - lng) ** 2 + (y - lat) ** 2;
            if (d < bd) (bd = d), (best = h);
          }
      }
      return best;
    };
    map.on("click", (e) => {
      const seg = propsRef.current.onSegment ? nearest(e, 14) : null;
      if (seg && propsRef.current.onSegment) return propsRef.current.onSegment(seg.properties as unknown as SegmentProps);
      const cells = map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] });
      if (cells.length && propsRef.current.onCell) propsRef.current.onCell(String(cells[0].properties?.c));
    });
    map.on("mousemove", (e) => {
      const hit = map.queryRenderedFeatures(box(e, 12), { layers: ["segments"] });
      map.getCanvas().style.cursor = hit.length && (propsRef.current.onSegment || propsRef.current.onHoverSegment) ? "pointer" : "";
      propsRef.current.onHoverSegment?.(hit.length ? (hit[0].properties as unknown as SegmentProps) : null);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && ready.current) apply(mapRef.current, p, fast.current);
  });
  const fitKey = p.fit ? p.fit.flat().join(",") : "spain";
  const first = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (first.current) {
      first.current = false;
      if (!p.fit) return;
    }
    const go = () => {
      map.fitBounds(p.fit ?? SPAIN_BOUNDS, { padding: p.pad ?? 18, duration: 900, maxZoom: 9 });
    };
    if (ready.current) go();
    else map.once("load", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={ref} className={p.className ?? "map"} role="img" aria-label={p.label ?? "Map of Spain's railway network"} />;
}

/** Last values applied per map, so unchanged layers and sources are not touched on every render. */
const applied = new WeakMap<MlMap, Record<string, string>>();
function changed(map: MlMap, key: string, value: unknown): boolean {
  const memo = applied.get(map) ?? {};
  applied.set(map, memo);
  const s = JSON.stringify(value ?? null);
  if (memo[key] === s) return false;
  memo[key] = s;
  return true;
}

function apply(map: MlMap, p: Props, fast: FastIndex | null) {
  const fastMode = p.fastColors !== undefined;
  if (changed(map, "cellColors", [p.cellColors, p.cellOpacity])) {
    map.setPaintProperty("cells-fill", "fill-color", matchExpr(p.cellColors, "rgba(0,0,0,0)"));
    map.setPaintProperty("cells-fill", "fill-opacity", p.cellColors ? (p.cellOpacity ?? 0.35) : 0);
  }
  if (!fastMode && changed(map, "segColors", p.segColors)) map.setPaintProperty("segments", "line-color", matchExpr(p.segColors, BASE_LINE));
  if (changed(map, "segOpacity", [p.dimSegments, fastMode])) map.setPaintProperty("segments", "line-opacity", fastMode ? 0 : p.dimSegments ? 0.45 : 1);
  if (changed(map, "stipple", p.stipple)) map.setFilter("cells-stipple", ["in", ["get", "c"], ["literal", p.stipple ?? []]]);
  if (changed(map, "selSeg", p.selectedSegment)) map.setFilter("seg-sel", ["==", ["get", "id"], p.selectedSegment ?? ""]);
  if (changed(map, "selCell", p.selectedCell)) map.setFilter("cells-sel", ["==", ["get", "c"], p.selectedCell ?? ""]);
  if (changed(map, "route", p.route))
    (map.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: p.route ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.route } }] : [],
    });
  if (changed(map, "arrows", p.arrows)) {
    const af: GeoJSON.Feature[] = [];
    for (const a of p.arrows ?? []) {
      if (!a.ok) continue;
      af.push({ type: "Feature", properties: { end: 0 }, geometry: { type: "LineString", coordinates: [a.from, a.to] } });
      af.push({ type: "Feature", properties: { end: 1 }, geometry: { type: "Point", coordinates: a.to } });
    }
    (map.getSource("arrows") as GeoJSONSource).setData({ type: "FeatureCollection", features: af });
  }
  if (changed(map, "pulses", p.pulses))
    (map.getSource("pulses") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (p.pulses ?? []).map((q) => ({ type: "Feature", properties: { color: q.color }, geometry: { type: "Point", coordinates: [q.lon, q.lat] } })),
    });
  if (fastMode && fast) {
    for (const [cid, id] of fast.cell) {
      const col = p.fastColors?.[cid] ?? null;
      if (fast.last.get(id) !== col) {
        map.setFeatureState({ source: "celllines", id }, { col });
        fast.last.set(id, col);
      }
    }
    const on = new Set<number>();
    for (const k of p.markers ?? []) {
      const id = fast.mk.get(k);
      if (id !== undefined) on.add(id);
    }
    for (const id of fast.on) if (!on.has(id)) map.setFeatureState({ source: "markers", id }, { on: false });
    for (const id of on) if (!fast.on.has(id)) map.setFeatureState({ source: "markers", id }, { on: true });
    fast.on = on;
  }
}
