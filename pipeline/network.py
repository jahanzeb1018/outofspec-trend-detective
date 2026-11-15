"""Step 1 - railway network: OSM ways -> de-duplicated corridors -> ~8 km segments with attributes, curvature and
MERRA-2 cell; plus precomputed routes (shortest paths on the full OSM topology).

Outputs (cache/): segments.geojson, cells.json, routes.json
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
from pyproj import Transformer
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from shapely import STRtree
from shapely.geometry import LineString, MultiLineString, Point, mapping
from shapely.ops import linemerge, substring, transform

import config as C

FWD = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
INV = Transformer.from_crs("EPSG:3035", "EPSG:4326", always_xy=True)


# ----------------------------------------------------------------------------------------------- helpers
def cell_of(lat: float, lon: float) -> tuple[float, float, str]:
    la = round(lat / C.LAT_STEP) * C.LAT_STEP
    lo = round(lon / C.LON_STEP) * C.LON_STEP
    return la, lo, f"{la:.2f}_{lo:.3f}"


def on_mainland(lon: float, lat: float) -> bool:
    if not (35.9 <= lat <= 44.0 and -9.4 <= lon <= 3.4):
        return False
    return not (lon > 1.0 and lat < 40.2)  # Balearic Islands


def parse_speed(v: str | None) -> int | None:
    if not v:
        return None
    m = re.search(r"\d+", v)
    return int(m.group()) if m else None


def gauge_of(v: str | None) -> int | None:
    if not v:
        return None
    for g in (1668, 1435, 1000):
        if str(g) in v:
            return g
    return None


# ------------------------------------------------------------------------------------ opening years
# Line-level opening year of the FIRST section of each high-speed line (public sources, verified in verify_years.py).
HSL_YEARS = [
    (r"madrid\W+sevilla", 1992, "LAV Madrid-Sevilla", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Sevilla"),
    (r"madrid\W+zaragoza\W+barcelona", 2003, "LAV Madrid-Zaragoza-Barcelona-Frontera", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Zaragoza-Barcelona-Frontera_francesa"),
    (r"madrid\W+(cuenca|levante|valencia)", 2010, "LAV Madrid-Levante", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Levante"),
    (r"c[oó]rdoba\W+m[aá]laga", 2007, "LAV Córdoba-Málaga", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_C%C3%B3rdoba-M%C3%A1laga"),
    (r"antequera\W+granada|bobadilla\W+granada", 2019, "LAV Antequera-Granada", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Antequera-Granada"),
    (r"madrid\W+(segovia|valladolid)", 2007, "LAV Madrid-Segovia-Valladolid", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Segovia-Valladolid"),
    (r"(valladolid|venta de ba[nñ]os)\W+(palencia\W+)?le[oó]n", 2015, "LAV Valladolid-León", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Valladolid-Le%C3%B3n"),
    (r"(venta de ba[nñ]os|valladolid)\W+burgos", 2022, "LAV Valladolid-Burgos", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Valladolid-Burgos-Vitoria"),
    (r"olmedo\W+zamora", 2015, "LAV Olmedo-Zamora-Galicia", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Galicia"),
    (r"ourense\W+santiago", 2011, "LAV Ourense-Santiago", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Ourense-Santiago"),
    (r"(barcelona|mollet)\W+figueres|figueres\W+perpi", 2013, "LAV Barcelona-Figueres", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Zaragoza-Barcelona-Frontera_francesa"),
    (r"toledo", 2005, "LAV La Sagra-Toledo", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_La_Sagra-Toledo"),
    (r"(albacete|monforte)\W+alicante", 2013, "LAV Albacete-Alicante", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Levante"),
    (r"monforte\W+murcia|murcia", 2022, "LAV Monforte-Murcia", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Levante"),
    (r"pajares|le[oó]n\W+asturias|la robla", 2023, "Variante de Pajares", "https://es.wikipedia.org/wiki/Variante_de_Pajares"),
    (r"plasencia\W+badajoz|extremadura", 2022, "LAV Madrid-Extremadura (Plasencia-Badajoz)", "https://es.wikipedia.org/wiki/L%C3%ADnea_de_alta_velocidad_Madrid-Extremadura"),
]


def opening_for(name: str, line_type: str) -> tuple[int | None, str | None, str | None]:
    if line_type != "HSL" or not name:
        return None, None, None
    n = name.lower()
    for pat, year, label, src in HSL_YEARS:
        if re.search(pat, n):
            return year, label, src
    return None, None, None


# ---------------------------------------------------------------------------------------------- stations
STATIONS = {
    "Madrid Atocha": (40.4066, -3.6900), "Madrid Chamartín": (40.4722, -3.6828), "Sevilla": (37.3920, -5.9752),
    "Córdoba": (37.8885, -4.7895), "Ciudad Real": (38.9775, -3.9133), "Puertollano": (38.6885, -4.1095),
    "Málaga": (36.7115, -4.4318), "Antequera": (37.0405, -4.6017), "Granada": (37.1840, -3.6100),
    "Barcelona Sants": (41.3790, 2.1400), "Zaragoza": (41.6585, -0.9100), "Lleida": (41.6205, 0.6330),
    "Camp de Tarragona": (41.1550, 1.2450), "Girona": (41.9790, 2.8170), "Figueres": (42.2700, 2.9420),
    "Valencia": (39.4590, -0.3800), "Cuenca": (40.0480, -2.1550), "Albacete": (38.9990, -1.8530),
    "Alicante": (38.3445, -0.4950), "Murcia": (37.9750, -1.1270), "Valladolid": (41.6440, -4.7280),
    "Segovia": (40.9100, -4.0950), "León": (42.5950, -5.5800), "Oviedo": (43.3665, -5.8565),
    "Gijón": (43.5370, -5.6730), "Burgos": (42.3610, -3.6390), "Zamora": (41.5100, -5.7340),
    "Ourense": (42.3510, -7.8710), "Santiago": (42.8710, -8.5440), "A Coruña": (43.3530, -8.4090),
    "Huesca": (42.1350, -0.4100), "Toledo": (39.8620, -4.0130), "Cádiz": (36.5290, -6.2890),
    "Jerez": (36.6900, -6.1310), "Huelva": (37.2550, -6.9500), "Tarragona": (41.1110, 1.2530),
    "Castellón": (39.9880, -0.0520), "Badajoz": (38.8890, -6.9790), "Mérida": (38.9230, -6.3440),
    "Cáceres": (39.4600, -6.3800), "Pamplona": (42.8250, -1.6620), "Algeciras": (36.1300, -5.4480),
    "Ronda": (36.7450, -5.1580), "Bobadilla": (37.0410, -4.7150), "Almería": (36.8350, -2.4570),
    "Salamanca": (40.9720, -5.6580), "Ávila": (40.6580, -4.6830), "Xàtiva": (38.9880, -0.5190),
}

# (route_id, display name, stations in order, preference)  preference: hsl | conventional | any
ROUTES = [
    ("mad-sev", "Madrid → Sevilla", ["Madrid Atocha", "Ciudad Real", "Puertollano", "Córdoba", "Sevilla"], "hsl"),
    ("mad-mal", "Madrid → Málaga", ["Madrid Atocha", "Córdoba", "Antequera", "Málaga"], "hsl"),
    ("mad-bcn", "Madrid → Barcelona", ["Madrid Atocha", "Zaragoza", "Lleida", "Camp de Tarragona", "Barcelona Sants"], "hsl"),
    ("bcn-fig", "Barcelona → Figueres", ["Barcelona Sants", "Girona", "Figueres"], "hsl"),
    ("mad-vlc", "Madrid → Valencia", ["Madrid Atocha", "Cuenca", "Valencia"], "hsl"),
    ("mad-ali", "Madrid → Alicante", ["Madrid Atocha", "Albacete", "Alicante"], "hsl"),
    ("mad-mur", "Madrid → Murcia", ["Madrid Atocha", "Albacete", "Murcia"], "hsl"),
    ("mad-gra", "Madrid → Granada", ["Madrid Atocha", "Córdoba", "Antequera", "Granada"], "hsl"),
    ("mad-leo", "Madrid → León", ["Madrid Chamartín", "Segovia", "Valladolid", "León"], "hsl"),
    ("leo-gij", "León → Gijón", ["León", "Oviedo", "Gijón"], "any"),
    ("mad-bur", "Madrid → Burgos", ["Madrid Chamartín", "Segovia", "Valladolid", "Burgos"], "hsl"),
    ("mad-cor", "Madrid → A Coruña", ["Madrid Chamartín", "Zamora", "Ourense", "Santiago", "A Coruña"], "hsl"),
    ("mad-hue", "Madrid → Huesca", ["Madrid Atocha", "Zaragoza", "Huesca"], "hsl"),
    ("mad-tol", "Madrid → Toledo", ["Madrid Atocha", "Toledo"], "hsl"),
    ("sev-cad", "Sevilla → Cádiz", ["Sevilla", "Jerez", "Cádiz"], "conventional"),
    ("sev-hue", "Sevilla → Huelva", ["Sevilla", "Huelva"], "conventional"),
    ("bcn-vlc", "Barcelona → Valencia", ["Barcelona Sants", "Tarragona", "Castellón", "Valencia"], "conventional"),
    ("vlc-ali", "Valencia → Alicante", ["Valencia", "Xàtiva", "Alicante"], "conventional"),
    ("mad-bad", "Madrid → Badajoz", ["Madrid Atocha", "Cáceres", "Mérida", "Badajoz"], "any"),
    ("zgz-pam", "Zaragoza → Pamplona", ["Zaragoza", "Pamplona"], "conventional"),
    ("alg-bob", "Algeciras → Bobadilla", ["Algeciras", "Ronda", "Bobadilla"], "conventional"),
    ("alm-gra", "Almería → Granada", ["Almería", "Granada"], "conventional"),
    ("mad-sal", "Madrid → Salamanca", ["Madrid Chamartín", "Ávila", "Salamanca"], "conventional"),
    ("cad-mad", "Cádiz → Madrid", ["Cádiz", "Jerez", "Sevilla", "Córdoba", "Madrid Atocha"], "any"),
]


# --------------------------------------------------------------------------------------------- main steps
def load_ways() -> list[dict]:
    d = json.loads((C.CACHE / "osm_rail.json").read_text(encoding="utf-8"))
    ways = []
    for e in d["elements"]:
        g = e.get("geometry") or []
        if len(g) < 2:
            continue
        lon = np.array([p["lon"] for p in g])
        lat = np.array([p["lat"] for p in g])
        if not on_mainland(float(lon.mean()), float(lat.mean())):
            continue
        t = e.get("tags", {})
        gauge = gauge_of(t.get("gauge"))
        if t.get("gauge") and gauge is None:
            continue  # exotic gauges
        x, y = FWD.transform(lon, lat)
        ways.append({"id": e["id"], "tags": t, "lon": lon, "lat": lat, "x": np.asarray(x), "y": np.asarray(y)})
    return ways


def way_len(w: dict) -> float:
    return float(np.hypot(np.diff(w["x"]), np.diff(w["y"])).sum())


def densify(x: np.ndarray, y: np.ndarray, step: float) -> np.ndarray:
    seg = np.hypot(np.diff(x), np.diff(y))
    cum = np.concatenate([[0], np.cumsum(seg)])
    if cum[-1] == 0:
        return np.column_stack([x[:1], y[:1]])
    s = np.arange(0, cum[-1] + 1e-9, step)
    return np.column_stack([np.interp(s, cum, x), np.interp(s, cum, y)])


def dedupe(ways: list[dict], tol: float = 35.0, cover: float = 0.8) -> list[dict]:
    """Greedy removal of parallel tracks: a way is dropped if >=80% of it lies within 35 m of already kept ways."""
    grid: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    kept = []
    order = sorted(ways, key=lambda w: (-(w["tags"].get("highspeed") == "yes"), -way_len(w)))
    for w in order:
        pts = densify(w["x"], w["y"], 25.0)
        near = 0
        for px, py in pts:
            gx, gy = int(px // tol), int(py // tol)
            hit = False
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for qx, qy in grid.get((gx + dx, gy + dy), ()):
                        if (qx - px) ** 2 + (qy - py) ** 2 <= tol * tol:
                            hit = True
                            break
                    if hit:
                        break
                if hit:
                    break
            near += hit
        if near / len(pts) >= cover:
            continue
        kept.append(w)
        for px, py in densify(w["x"], w["y"], 15.0):
            grid[(int(px // tol), int(py // tol))].append((px, py))
    return kept


def curvature_min_radius(line: LineString) -> float | None:
    pts = densify(np.asarray(line.xy[0]), np.asarray(line.xy[1]), C.CURVE_SPACING_M)
    k = int(C.CURVE_HALF_CHORD_M // C.CURVE_SPACING_M)
    if len(pts) < 2 * k + 1:
        return None
    a, b, c = pts[:-2 * k], pts[k:-k], pts[2 * k:]
    ab = np.hypot(*(b - a).T)
    bc = np.hypot(*(c - b).T)
    ca = np.hypot(*(a - c).T)
    cross = np.abs((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1]) - (b[:, 1] - a[:, 1]) * (c[:, 0] - a[:, 0]))
    with np.errstate(divide="ignore", invalid="ignore"):
        r = ab * bc * ca / (2 * cross)
    r = r[np.isfinite(r)]
    if r.size == 0:
        return 100000.0
    return float(min(np.percentile(r, C.CURVE_PERCENTILE), 100000.0))


def build_segments(kept: list[dict]) -> list[dict]:
    lines = [LineString(np.column_stack([w["x"], w["y"]])) for w in kept]
    tree = STRtree(lines)
    merged = linemerge(MultiLineString(lines))
    chains = list(merged.geoms) if hasattr(merged, "geoms") else [merged]
    segs = []
    for chain in chains:
        L = chain.length
        if L < 300:
            continue
        n = max(1, math.ceil(L / (C.SEGMENT_KM * 1000)))
        for i in range(n):
            piece = substring(chain, L * i / n, L * (i + 1) / n)
            if piece.length < 50:
                continue
            # attributes by majority over 7 sample points
            votes: dict[str, Counter] = defaultdict(Counter)
            for f in np.linspace(0.05, 0.95, 7):
                p = piece.interpolate(f, normalized=True)
                j = tree.nearest(p)
                t = kept[int(j)]["tags"]
                votes["name"][t.get("name", "")] += 1
                votes["hs"][t.get("highspeed", "no") == "yes"] += 1
                votes["gauge"][gauge_of(t.get("gauge"))] += 1
                votes["el"][t.get("electrified", "") not in ("", "no")] += 1
                votes["usage"][t.get("usage", "")] += 1
                sp = parse_speed(t.get("maxspeed"))
                if sp:
                    votes["speed"][sp] += 1
            names = [n_ for n_, _ in votes["name"].most_common() if n_]
            name = names[0] if names else ""
            gauge = votes["gauge"].most_common(1)[0][0]
            speed = max(votes["speed"]) if votes["speed"] else None
            hs = votes["hs"].most_common(1)[0][0] or (gauge == 1435 and (speed or 0) >= 200)
            line_type = "HSL" if hs else ("metric" if gauge == 1000 else "conventional")
            mid = piece.interpolate(0.5, normalized=True)
            mlon, mlat = INV.transform(mid.x, mid.y)
            la, lo, cid = cell_of(mlat, mlon)
            rmin = curvature_min_radius(piece)
            cls = "tangent" if rmin is None or rmin >= 2000 else ("medium" if rmin >= 800 else "tight")
            year, label, src = opening_for(name, line_type)
            segs.append({
                "geom": piece, "line_name": name, "line_type": line_type, "gauge_mm": gauge,
                "electrified": votes["el"].most_common(1)[0][0], "maxspeed_kmh": speed,
                "usage": votes["usage"].most_common(1)[0][0], "length_km": round(piece.length / 1000, 3),
                "min_radius_m": None if rmin is None else round(rmin), "curve_class": cls,
                "cell_id": cid, "cell_lat": la, "cell_lon": lo,
                "opened_year": year, "opened_line": label, "opened_source": src,
            })
    for i, s in enumerate(sorted(segs, key=lambda s: (s["cell_lat"], s["cell_lon"]))):
        s["segment_id"] = f"s{i:05d}"
    return segs


def to_lonlat(geom):
    return transform(lambda x, y, z=None: INV.transform(x, y), geom)


# ----------------------------------------------------------------------------------------------- routing
def build_graph(ways: list[dict]):
    keys: dict[tuple[int, int], int] = {}
    xs, ys, src, dst, wlen, hsl = [], [], [], [], [], []

    def nid(lon: float, lat: float, x: float, y: float) -> int:
        k = (round(lon * 1e7), round(lat * 1e7))
        if k not in keys:
            keys[k] = len(keys)
            xs.append(x)
            ys.append(y)
        return keys[k]

    node_hs: dict[int, bool] = {}
    for w in ways:
        is_hs = w["tags"].get("highspeed") == "yes"
        ids = [nid(lo, la, x, y) for lo, la, x, y in zip(w["lon"], w["lat"], w["x"], w["y"])]
        for i in ids:
            node_hs[i] = node_hs.get(i, False) or is_hs
        for a, b in zip(ids, ids[1:]):
            if a == b:
                continue
            src.append(a)
            dst.append(b)
            wlen.append(math.hypot(xs[a] - xs[b], ys[a] - ys[b]))
            hsl.append(is_hs)
    # Connect nodes of different ways that are very close but not shared (switches, mapping gaps).
    pts = np.column_stack([xs, ys])
    pairs = cKDTree(pts).query_pairs(r=40.0, output_type="ndarray")
    for a, b in pairs:
        src.append(int(a))
        dst.append(int(b))
        wlen.append(float(np.hypot(*(pts[a] - pts[b]))) + 20.0)  # small penalty for jumping between ways
        hsl.append(False)
    hs_flag = np.array([node_hs.get(i, False) for i in range(len(xs))])
    return np.array(xs), np.array(ys), np.array(src), np.array(dst), np.array(wlen), np.array(hsl), hs_flag


def compute_routes(ways: list[dict], segs: list[dict]) -> list[dict]:
    xs, ys, src, dst, wlen, hsl, hs_node = build_graph(ways)
    n = len(xs)
    kd = cKDTree(np.column_stack([xs, ys]))
    kd_hs = cKDTree(np.column_stack([xs[hs_node], ys[hs_node]]))
    hs_index = np.flatnonzero(hs_node)
    # keep only the largest connected component for snapping
    from scipy.sparse.csgraph import connected_components

    adj = csr_matrix((np.ones(len(src)), (src, dst)), shape=(n, n))
    _, labels = connected_components(adj, directed=False)
    main_label = np.bincount(labels).argmax()
    in_main = labels == main_label
    kd_main = cKDTree(np.column_stack([xs[in_main], ys[in_main]]))
    main_index = np.flatnonzero(in_main)
    seg_lines = [s["geom"] for s in segs]
    seg_tree = STRtree(seg_lines)
    mats = {}
    for pref, mult in {"hsl": (0.7, 1.0), "conventional": (1.6, 1.0), "any": (1.0, 1.0)}.items():
        w = wlen * np.where(hsl, mult[0], mult[1]) + 1e-3
        mats[pref] = csr_matrix((np.concatenate([w, w]), (np.concatenate([src, dst]), np.concatenate([dst, src]))), shape=(n, n))
    out = []
    for rid, name, stations, pref in ROUTES:
        pts_idx = []
        for st in stations:
            lat, lon = STATIONS[st]
            x, y = FWD.transform(lon, lat)
            i = None
            if pref == "hsl":
                d, j = kd_hs.query([x, y])
                if d < 3000 and in_main[hs_index[j]]:
                    i = int(hs_index[j])
            if i is None:
                d, j = kd_main.query([x, y])
                i = int(main_index[j])
            if d > 6000:
                print(f"  ! station {st} is {d:.0f} m from the network")
            pts_idx.append(int(i))
        path: list[int] = []
        ok = True
        for a, b in zip(pts_idx, pts_idx[1:]):
            dist, pred = dijkstra(mats[pref], directed=False, indices=a, return_predecessors=True)
            if not np.isfinite(dist[b]):
                print(f"  ! route {rid}: no path between nodes")
                ok = False
                break
            p = [b]
            while p[-1] != a:
                p.append(int(pred[p[-1]]))
            p.reverse()
            path.extend(p if not path else p[1:])
        if not ok:
            continue
        coords = np.column_stack([xs[path], ys[path]])
        line = LineString(coords)
        L = line.length
        samples = []
        for km in np.arange(0, L / 1000 + 1e-9, 1.0):
            p = line.interpolate(min(km * 1000, L))
            lon, lat = INV.transform(p.x, p.y)
            j = int(seg_tree.nearest(p))
            samples.append({"km": round(float(km), 1), "cell_id": cell_of(lat, lon)[2], "segment_id": segs[j]["segment_id"]})
        st_km = []
        for st, i in zip(stations, pts_idx):
            st_km.append({"name": st, "km": round(line.project(Point(xs[i], ys[i])) / 1000, 1)})
        simp = to_lonlat(line.simplify(150))
        out.append({
            "route_id": rid, "name": name, "preference": pref, "length_km": round(L / 1000, 1),
            "stations": st_km, "samples": samples,
            "geometry": [[round(x, 4), round(y, 4)] for x, y in simp.coords],
        })
        print(f"  route {rid}: {L / 1000:.0f} km")
    return out


def main() -> None:
    ways = load_ways()
    total = sum(way_len(w) for w in ways) / 1000
    kept = dedupe(ways)
    kept_km = sum(way_len(w) for w in kept) / 1000
    print(f"ways {len(ways)} ({total:.0f} km) -> kept {len(kept)} ({kept_km:.0f} km) after removing parallel tracks")
    segs = build_segments(kept)
    print(f"segments {len(segs)}; total {sum(s['length_km'] for s in segs):.0f} km")
    feats = []
    for s in segs:
        g = to_lonlat(s["geom"])
        props = {k: v for k, v in s.items() if k != "geom"}
        feats.append({"type": "Feature", "geometry": mapping(g), "properties": props})
    (C.CACHE / "segments.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}), encoding="utf-8")
    cells: dict[str, dict] = {}
    for s in segs:
        c = cells.setdefault(s["cell_id"], {"cell_id": s["cell_id"], "lat": s["cell_lat"], "lon": s["cell_lon"], "track_km": 0.0})
        c["track_km"] = round(c["track_km"] + s["length_km"], 3)
    (C.CACHE / "cells.json").write_text(json.dumps(sorted(cells.values(), key=lambda c: c["cell_id"]), indent=0), encoding="utf-8")
    print(f"cells {len(cells)}")
    routes = compute_routes(ways, segs)
    (C.CACHE / "routes.json").write_text(json.dumps(routes), encoding="utf-8")
    hs = Counter(s["line_type"] for s in segs)
    print("line types (segments):", dict(hs), "| curve classes:", dict(Counter(s["curve_class"] for s in segs)))
    print("opening years assigned:", sum(1 for s in segs if s["opened_year"]))


if __name__ == "__main__":
    main()
