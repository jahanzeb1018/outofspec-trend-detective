"""Base-map context from Natural Earth (public domain): world countries (110m), Iberia and neighbours (50m) and a
small gazetteer of populated places for the detective search. Output in web/public/data/."""
from __future__ import annotations

import json

import requests

import config as C

NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
H = {"User-Agent": "trend-detective-hackathon/0.1"}


def get(name: str) -> dict:
    r = requests.get(f"{NE}/{name}", headers=H, timeout=300)
    r.raise_for_status()
    return r.json()


def rnd_coords(g, nd=3):
    if isinstance(g, list):
        if g and isinstance(g[0], (int, float)):
            return [round(g[0], nd), round(g[1], nd)]
        return [rnd_coords(x, nd) for x in g]
    return g


def main() -> None:
    C.OUT.mkdir(parents=True, exist_ok=True)
    world = get("ne_110m_admin_0_countries.geojson")
    feats = [{"type": "Feature", "properties": {"name": f["properties"].get("NAME")},
              "geometry": {"type": f["geometry"]["type"], "coordinates": rnd_coords(f["geometry"]["coordinates"], 2)}}
             for f in world["features"]]
    (C.OUT / "world.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
    c50 = get("ne_50m_admin_0_countries.geojson")
    keep = {"Spain", "Portugal", "France", "Andorra", "Morocco", "Algeria", "Gibraltar"}
    feats = [{"type": "Feature", "properties": {"name": f["properties"].get("NAME")},
              "geometry": {"type": f["geometry"]["type"], "coordinates": rnd_coords(f["geometry"]["coordinates"], 3)}}
             for f in c50["features"] if f["properties"].get("NAME") in keep]
    (C.OUT / "iberia.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
    places = get("ne_50m_populated_places_simple.geojson")
    out = sorted(({"n": f["properties"]["name"], "c": f["properties"].get("adm0name"), "lat": round(f["geometry"]["coordinates"][1], 3),
                   "lon": round(f["geometry"]["coordinates"][0], 3), "p": f["properties"].get("pop_max", 0)} for f in places["features"]),
                 key=lambda x: -x["p"])
    (C.OUT / "places.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("world", len(world["features"]), "iberia", len(feats), "places", len(out))


if __name__ == "__main__":
    main()
