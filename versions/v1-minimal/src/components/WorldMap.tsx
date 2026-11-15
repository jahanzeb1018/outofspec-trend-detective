import { useEffect, useRef } from "react";
import { maplibregl } from "../maplibre";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DATA_BASE } from "../config";

interface Props {
  point: { lat: number; lon: number } | null;
  examples?: { id: string; lat: number; lon: number }[];
  onPick: (lat: number, lon: number) => void;
}

export function WorldMap({ point, examples, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const latest = useRef({ point, examples });
  latest.current = { point, examples };
  const ready = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      center: [0, 25],
      zoom: 0.6,
      attributionControl: false,
      dragRotate: false,
      renderWorldCopies: false,
      style: {
        version: 8,
        sources: {
          world: { type: "geojson", data: `${DATA_BASE}/world.geojson` },
          pt: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          ex: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#eef1f4" } },
          { id: "land", type: "fill", source: "world", paint: { "fill-color": "#fbfbfc" } },
          { id: "land-line", type: "line", source: "world", paint: { "line-color": "#c3c8cf", "line-width": 0.5 } },
          { id: "ex", type: "circle", source: "ex", paint: { "circle-radius": 4, "circle-color": "#f2a33a", "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
          { id: "pt", type: "circle", source: "pt", paint: { "circle-radius": 7, "circle-color": "#d63a2f", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        ],
      },
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Natural Earth" }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("click", (e) => pickRef.current(Number(e.lngLat.lat.toFixed(3)), Number(e.lngLat.lng.toFixed(3))));
    map.on("load", () => {
      ready.current = true;
      sync(map, latest.current.point, latest.current.examples);
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current && ready.current) sync(mapRef.current, point, examples);
  }, [point, examples]);

  return <div ref={ref} style={{ position: "relative", height: "100%", minHeight: 320, borderRadius: 14, overflow: "hidden" }} role="application" aria-label="World map: click to choose a place" />;
}

function sync(map: MlMap, point: Props["point"], examples: Props["examples"]) {
  (map.getSource("pt") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: point ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [point.lon, point.lat] } }] : [],
  });
  (map.getSource("ex") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: (examples ?? []).map((e) => ({ type: "Feature", properties: { id: e.id }, geometry: { type: "Point", coordinates: [e.lon, e.lat] } })),
  });
}
