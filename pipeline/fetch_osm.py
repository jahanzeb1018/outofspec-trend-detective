"""Download Spain's operational railway lines from OpenStreetMap (Overpass API) into cache/osm_rail.json.

OSM data (c) OpenStreetMap contributors, ODbL. One query; retried on busy servers.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

CACHE = Path(__file__).parent / "cache"
OUT = CACHE / "osm_rail.json"
SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
QUERY = """
[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-1"="ES"][admin_level=2]->.es;
(
  way["railway"="rail"][!"service"]["usage"!~"industrial|military|tourism|test"](area.es);
);
out tags geom;
"""


def main() -> int:
    CACHE.mkdir(exist_ok=True)
    if OUT.exists() and OUT.stat().st_size > 1_000_000:
        print("cached:", OUT)
        return 0
    headers = {"User-Agent": "trend-detective-hackathon/0.1 (NASA Space Apps 2026 project)"}
    for attempt in range(6):
        url = SERVERS[attempt % len(SERVERS)]
        try:
            print(f"[{attempt}] querying {url} ...", flush=True)
            r = requests.post(url, data={"data": QUERY}, headers=headers, timeout=1000)
            if r.status_code == 200 and r.content.startswith(b"{"):
                data = r.json()
                n = len(data.get("elements", []))
                if n < 1000:
                    raise RuntimeError(f"too few elements: {n}")
                OUT.write_text(json.dumps(data), encoding="utf-8")
                print(f"saved {n} ways to {OUT}")
                return 0
            print("status", r.status_code, r.text[:200])
        except Exception as e:  # noqa: BLE001 - retry on any network/server error
            print("error:", e)
        time.sleep(20 * (attempt + 1))
    return 1


if __name__ == "__main__":
    sys.exit(main())

