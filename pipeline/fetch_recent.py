"""Near-real-time NASA POWER daily data after the last complete year, up to today, for every railway cell.

Trends and significance tests use complete years only (config.YEARS). This step tops up the month-by-month map with
the current year: POWER serves recent days from NASA GEOS-IT (meteorology) and FLASHFlux (sunshine) with a latency of
a few days; those values may be revised when MERRA-2 catches up. Re-run any day to refresh (cached for 12 hours).
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import requests

import config as C

RECENT_DIR = C.CACHE / "power_recent"
S = requests.Session()
S.headers["User-Agent"] = "trend-detective-hackathon/0.1 (NASA Space Apps 2026)"


def fetch(cid: str, lat: float, lon: float, start: str, end: str) -> str:
    dest = RECENT_DIR / f"{cid}.json"
    if dest.exists() and time.time() - dest.stat().st_mtime < 12 * 3600:
        return "cached"
    q = {"parameters": ",".join(C.POWER_PARAMS), "community": "RE", "longitude": f"{lon:.4f}", "latitude": f"{lat:.4f}",
         "start": start, "end": end, "format": "JSON", "time-standard": "LST"}
    for attempt in range(5):
        try:
            r = S.get(C.POWER_URL, params=q, timeout=180)
            if r.status_code == 200:
                d = r.json()
                slim = {"geometry": d["geometry"], "sources": d.get("header", {}).get("sources"),
                        "data": {k: list(v.values()) for k, v in d["properties"]["parameter"].items()},
                        "start": start, "url": r.url, "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                dest.write_text(json.dumps(slim, separators=(",", ":")), encoding="utf-8")
                return "ok"
            print("HTTP", r.status_code, cid, r.text[:120], flush=True)
        except (requests.RequestException, ValueError) as e:
            print("retry", cid, e.__class__.__name__, flush=True)
        time.sleep(5 * (attempt + 1))
    return "failed"


def main() -> int:
    RECENT_DIR.mkdir(parents=True, exist_ok=True)
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    start = f"{C.YEARS[1] + 1}0101"
    end = date.today().strftime("%Y%m%d")
    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(lambda c: fetch(c["cell_id"], c["lat"], c["lon"], start, end), cells))
    print({k: res.count(k) for k in set(res)}, "from", start, "to", end)
    return 0 if "failed" not in res else 1


if __name__ == "__main__":
    raise SystemExit(main())
