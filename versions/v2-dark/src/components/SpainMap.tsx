import { useEffect, useRef } from "react";
import { maplibregl } from "../maplibre";
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DATA_BASE } from "../config";
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
  /** Zoom to these bounds (animated) whenever they change. */
  fit?: [[number, number], [number, number]] | null;
  /** Padding used when fitting Spain or `fit`. */
  pad?: number | { top: number; bottom: number; left: number; right: number };
  /** Soft glow under the coloured lines (cinematic intro). */
  glow?: boolean;
  nav?: "top-left" | "bottom-left" | "none";
}

const SPAIN_BOUNDS: [[number, number], [number, number]] = [[-9.6, 35.8], [3.6, 43.9]];
const BASE_LINE = "#3a3c42";

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

  useEffect(() => {
    if (!ref.current) return;
    const lw = p.lineWidth ?? 1;
    const map = new maplibregl.Map({
      container: ref.current,
      bounds: SPAIN_BOUNDS,
      fitBoundsOptions: { padding: p.pad ?? 18 },
      attributionControl: false,
      interactive: p.interactive !== false,
      dragRotate: false,
      pitchWithRotate: false,
      style: {
        version: 8,
        sources: {
          iberia: { type: "geojson", data: `${DATA_BASE}/iberia.geojson` },
          cells: { type: "geojson", data: `${DATA_BASE}/cells.geojson` },
          segments: { type: "geojson", data: `${DATA_BASE}/segments.geojson` },
          route: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          arrows: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          pulses: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#0b0b0c" } },
          { id: "land", type: "fill", source: "iberia", paint: { "fill-color": "#17171a" } },
          { id: "land-line", type: "line", source: "iberia", paint: { "line-color": "#2c2d32", "line-width": 0.8 } },
          { id: "cells-fill", type: "fill", source: "cells", paint: { "fill-color": "#dadde2", "fill-opacity": 0 } },
          { id: "cells-stipple", type: "fill", source: "cells", paint: { "fill-pattern": "dots", "fill-opacity": 0.55 }, filter: ["in", ["get", "c"], ["literal", []]] },
          { id: "cells-sel", type: "line", source: "cells", paint: { "line-color": "#7fb0ff", "line-width": 1.6, "line-dasharray": [2, 2] }, filter: ["==", ["get", "c"], ""] },
          { id: "pulse-halo", type: "circle", source: "pulses", paint: { "circle-radius": 10, "circle-color": ["get", "color"], "circle-opacity": 0.25, "circle-blur": 0.4 } },
          { id: "seg-glow", type: "line", source: "segments", layout: { "line-cap": "round", "line-join": "round", visibility: p.glow ? "visible" : "none" }, paint: { "line-color": BASE_LINE, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 9 * lw, 9, 16 * lw], "line-blur": 7, "line-opacity": 0.45 } },
          { id: "seg-casing", type: "line", source: "segments", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0b0b0c", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 4.2 * lw, 9, 9 * lw] } },
          { id: "segments", type: "line", source: "segments", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": BASE_LINE, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.4 * lw, 9, 5.5 * lw] } },
          { id: "seg-sel", type: "line", source: "segments", layout: { "line-cap": "round" }, paint: { "line-color": "#f0efec", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 9] }, filter: ["==", ["get", "id"], ""] },
          { id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0b0b0c", "line-width": 9 } },
          { id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#f0efec", "line-width": 3.5 } },
          { id: "arrows", type: "line", source: "arrows", layout: { "line-cap": "round" }, paint: { "line-color": "#f0efec", "line-width": 1.3, "line-opacity": 0.6, "line-dasharray": [1, 2] } },
          { id: "arrows-end", type: "circle", source: "arrows", filter: ["==", ["get", "end"], 1], paint: { "circle-radius": 4, "circle-color": "#ff6a3d" } },
          { id: "pulse-core", type: "circle", source: "pulses", paint: { "circle-radius": 4.5, "circle-color": ["get", "color"], "circle-stroke-color": "#0b0b0c", "circle-stroke-width": 1.5 } },
        ],
      },
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenStreetMap contributors (ODbL) · Natural Earth · NASA" }), "bottom-right");
    if (p.interactive !== false && p.nav !== "none") map.addControl(new maplibregl.NavigationControl({ showCompass: false }), p.nav ?? "top-left");
    map.on("load", () => {
      if (!map.hasImage("dots")) map.addImage("dots", dotsImage());
      ready.current = true;
      apply(map, propsRef.current);
    });
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      if (ready.current && propsRef.current.pulses?.length) {
        const k = ((t - t0) % 1800) / 1800;
        map.setPaintProperty("pulse-halo", "circle-radius", 6 + 16 * k);
        map.setPaintProperty("pulse-halo", "circle-opacity", 0.45 * (1 - k));
      }
      raf = requestAnimationFrame(tick);
    };
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) raf = requestAnimationFrame(tick);
    const box = (e: maplibregl.MapMouseEvent): [maplibregl.PointLike, maplibregl.PointLike] => [
      [e.point.x - 6, e.point.y - 6],
      [e.point.x + 6, e.point.y + 6],
    ];
    map.on("click", (e) => {
      const segs = map.queryRenderedFeatures(box(e), { layers: ["segments"] });
      if (segs.length && propsRef.current.onSegment) return propsRef.current.onSegment(segs[0].properties as unknown as SegmentProps);
      const cells = map.queryRenderedFeatures(e.point, { layers: ["cells-fill"] });
      if (cells.length && propsRef.current.onCell) propsRef.current.onCell(String(cells[0].properties?.c));
    });
    map.on("mousemove", (e) => {
      const hit = map.queryRenderedFeatures(box(e), { layers: ["segments"] });
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
    if (mapRef.current && ready.current) apply(mapRef.current, p);
  });
  const fitKey = p.fit ? p.fit.flat().join(",") : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitKey) return;
    const go = () => map.fitBounds(p.fit ?? SPAIN_BOUNDS, { padding: p.pad ?? 18, duration: 900, maxZoom: 9.5 });
    if (ready.current) go();
    else map.once("load", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={ref} className={p.className ?? "map"} role="img" aria-label={p.label ?? "Map of Spain's railway network"} />;
}

function apply(map: MlMap, p: Props) {
  map.setPaintProperty("cells-fill", "fill-color", matchExpr(p.cellColors, "rgba(0,0,0,0)"));
  map.setPaintProperty("cells-fill", "fill-opacity", p.cellColors ? (p.cellOpacity ?? 0.35) : 0);
  map.setPaintProperty("segments", "line-color", matchExpr(p.segColors, BASE_LINE));
  map.setPaintProperty("seg-glow", "line-color", matchExpr(p.segColors, "rgba(0,0,0,0)"));
  map.setPaintProperty("segments", "line-opacity", p.dimSegments ? 0.45 : 1);
  map.setFilter("cells-stipple", ["in", ["get", "c"], ["literal", p.stipple ?? []]]);
  map.setFilter("seg-sel", ["==", ["get", "id"], p.selectedSegment ?? ""]);
  map.setFilter("cells-sel", ["==", ["get", "c"], p.selectedCell ?? ""]);
  (map.getSource("route") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: p.route ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.route } }] : [],
  });
  const af: GeoJSON.Feature[] = [];
  for (const a of p.arrows ?? []) {
    if (!a.ok) continue;
    af.push({ type: "Feature", properties: { end: 0 }, geometry: { type: "LineString", coordinates: [a.from, a.to] } });
    af.push({ type: "Feature", properties: { end: 1 }, geometry: { type: "Point", coordinates: a.to } });
  }
  (map.getSource("arrows") as GeoJSONSource).setData({ type: "FeatureCollection", features: af });
  (map.getSource("pulses") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: (p.pulses ?? []).map((q) => ({ type: "Feature", properties: { color: q.color }, geometry: { type: "Point", coordinates: [q.lon, q.lat] } })),
  });
}
