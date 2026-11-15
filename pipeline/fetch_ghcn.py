"""Validation stations: NOAA GHCN-Daily (the data behind NOAA Climate Data Online, a resource listed by the challenge).
Picks long-record Spanish stations near target cities and downloads their daily CSVs. No token needed.
Output: cache/ghcn/{id}.csv, cache/ghcn/stations.json, cache/extra_points.json (POWER points to compare with).
"""
from __future__ import annotations

import json
import math

import requests

import config as C

BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily"
ACCESS = "https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access"
TARGETS = {
    "Sevilla": (37.39, -5.98), "Córdoba": (37.88, -4.78), "Granada": (37.18, -3.60), "Badajoz": (38.88, -6.97),
    "Madrid": (40.41, -3.68), "Zaragoza": (41.65, -0.88), "Valladolid": (41.65, -4.72), "Valencia": (39.47, -0.38),
    "Barcelona": (41.39, 2.17), "Bilbao": (43.26, -2.93),
}
H = {"User-Agent": "trend-detective-hackathon/0.1"}


def main() -> None:
    d = C.CACHE / "ghcn"
    d.mkdir(parents=True, exist_ok=True)
    inv = requests.get(f"{BASE}/ghcnd-inventory.txt", headers=H, timeout=300).text
    span: dict[str, dict[str, tuple[int, int, float, float]]] = {}
    for line in inv.splitlines():
        if not line.startswith("SP"):
            continue
        sid, lat, lon, el, y0, y1 = line[:11], float(line[12:20]), float(line[21:30]), line[31:35], int(line[36:40]), int(line[41:45])
        span.setdefault(sid, {})[el] = (y0, y1, lat, lon)
    names = {}
    for line in requests.get(f"{BASE}/ghcnd-stations.txt", headers=H, timeout=300).text.splitlines():
        if line.startswith("SP"):
            names[line[:11]] = line[41:71].strip()
    good = {
        s: v["TMAX"][2:] for s, v in span.items()
        if all(e in v and v[e][0] <= C.YEARS[0] and v[e][1] >= C.YEARS[1] - 1 for e in ("TMAX", "TMIN"))
    }
    chosen = []
    for city, (la, lo) in TARGETS.items():
        best = min(good.items(), key=lambda kv: math.hypot(kv[1][0] - la, (kv[1][1] - lo) * math.cos(math.radians(la))))
        dist = math.hypot(best[1][0] - la, (best[1][1] - lo) * math.cos(math.radians(la))) * 111
        if dist > 60 or any(c["id"] == best[0] for c in chosen):
            continue
        sid = best[0]
        csv = requests.get(f"{ACCESS}/{sid}.csv", headers=H, timeout=300)
        csv.raise_for_status()
        (d / f"{sid}.csv").write_bytes(csv.content)
        chosen.append({"id": sid, "name": names.get(sid, sid), "city": city, "lat": best[1][0], "lon": best[1][1], "dist_km": round(dist, 1)})
        print("station", city, sid, names.get(sid), f"{dist:.0f} km")
    (d / "stations.json").write_text(json.dumps(chosen, ensure_ascii=False, indent=1), encoding="utf-8")
    (C.CACHE / "extra_points.json").write_text(
        json.dumps([{"id": f"st_{c['id']}", "lat": c["lat"], "lon": c["lon"]} for c in chosen]), encoding="utf-8")


if __name__ == "__main__":
    main()
