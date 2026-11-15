"""Download NASA POWER daily data (MERRA-2 meteorology, SRB/CERES radiation): one request per MERRA-2 cell of the
rail network, plus the detective-mode example places. No account needed. Output: cache/power/{id}.json
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import config as C

POWER_DIR = C.CACHE / "power"
DETECTIVE_PARAMS = [
    "T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN",
    "CLOUD_AMT", "GWETROOT", "EVLAND", "SNODP", "QV2M",
]
EXAMPLES = [
    # id, label, region type, lat, lon
    ("madrid", "Madrid, Spain", "big city", 40.42, -3.70),
    ("sahara", "Tamanrasset, Sahara", "desert", 22.79, 5.52),
    ("amazon", "Manaus, Amazon rainforest", "rainforest", -3.12, -60.02),
    ("chesapeake", "Chesapeake Bay, USA", "tidal estuary", 38.97, -76.49),
    ("delhi", "Delhi, India", "big city", 28.61, 77.21),
    ("alps", "Zermatt, Swiss Alps", "mountains", 46.02, 7.75),
    ("svalbard", "Longyearbyen, Svalbard", "polar", 78.22, 15.65),
    ("lisbon", "Lisbon coast, Portugal", "coast", 38.72, -9.14),
]
S = requests.Session()
S.headers["User-Agent"] = "trend-detective-hackathon/0.1 (NASA Space Apps 2026)"


def fetch(item_id: str, lat: float, lon: float, params: list[str], community: str) -> str:
    dest = POWER_DIR / f"{item_id}.json"
    if dest.exists() and dest.stat().st_size > 200_000:
        return "cached"
    q = {
        "parameters": ",".join(params), "community": community, "longitude": f"{lon:.4f}", "latitude": f"{lat:.4f}",
        "start": f"{C.YEARS[0]}0101", "end": f"{C.YEARS[1]}1231", "format": "JSON", "time-standard": "LST",
    }
    for attempt in range(6):
        try:
            r = S.get(C.POWER_URL, params=q, timeout=300)
            if r.status_code == 200:
                d = r.json()
                slim = {
                    "geometry": d["geometry"], "parameters": d["parameters"], "sources": d.get("header", {}).get("sources"),
                    "data": {k: list(v.values()) for k, v in d["properties"]["parameter"].items()},
                    "start": q["start"], "url": r.url, "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                dest.write_text(json.dumps(slim, separators=(",", ":")), encoding="utf-8")
                return "ok"
            print("HTTP", r.status_code, item_id, r.text[:120], flush=True)
        except (requests.RequestException, ValueError) as e:
            print("retry", item_id, e.__class__.__name__, flush=True)
        time.sleep(10 * (attempt + 1))
    raise RuntimeError(item_id)


def main() -> int:
    POWER_DIR.mkdir(parents=True, exist_ok=True)
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    jobs = [(c["cell_id"], c["lat"], c["lon"], C.POWER_PARAMS, "RE") for c in cells]
    jobs += [(f"ex_{e[0]}", e[3], e[4], DETECTIVE_PARAMS, "AG") for e in EXAMPLES]
    extra = C.CACHE / "extra_points.json"  # validation stations etc. (written by other steps)
    if extra.exists():
        for p in json.loads(extra.read_text(encoding="utf-8")):
            jobs.append((p["id"], p["lat"], p["lon"], ["T2M_MAX", "T2M_MIN"], "RE"))
    done = 0
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(fetch, *j): j[0] for j in jobs}
        for f in as_completed(futs):
            done += 1
            try:
                f.result()
            except Exception as e:  # noqa: BLE001
                print("FAILED", futs[f], e, flush=True)
            if done % 25 == 0:
                print(f"{done}/{len(jobs)}", flush=True)
    print("finished", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
