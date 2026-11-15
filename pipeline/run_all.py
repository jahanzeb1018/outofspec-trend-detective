"""Reproduce every number in the app: python pipeline/run_all.py  (from the repository root, inside the venv).

Steps are cached in pipeline/cache/, so re-runs only redo what is missing. Downloads need internet but no accounts.
"""
from __future__ import annotations

import runpy
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = [
    ("fetch_osm.py", "railway network from OpenStreetMap"),
    ("network.py", "sections, curvature, NASA cells, routes"),
    ("fetch_ghcn.py", "validation stations (NOAA GHCN-Daily)"),
    ("fetch_power.py", "NASA POWER daily data (cells, examples, stations)"),
    ("fetch_context.py", "Natural Earth base maps and places"),
    ("detective.py", "detective-mode example places"),
    ("fetch_nex.py", "NASA NEX-GDDP-CMIP6 projections (largest download)"),
    ("nex_process.py", "projections -> NASA cells"),
    ("fra_t109.py", "optional: FRA buckled-track derailments vs NASA heat"),
    ("process.py", "indicators, trends, FDR, future, rail model, buckling, export"),
    ("watch.py", "heat/cold watch thresholds and heatwave replays"),
    ("fetch_recent.py", "NASA POWER near-real-time days after the last complete year (for the monthly map)"),
    ("monthly.py", "month-by-month map: afternoon temperature, hottest rail, coldest night, wettest day"),
    ("trip_data.py", "trip planner: every day since 1981, and the climate of any date to 2100"),
    ("journey_geo.py", "shapes for the animated How it works page"),
]


def main() -> int:
    sys.path.insert(0, str(HERE))
    only = set(sys.argv[1:])
    for script, what in STEPS:
        if only and script not in only:
            continue
        t = time.time()
        print(f"\n=== {script}: {what}", flush=True)
        try:
            runpy.run_path(str(HERE / script), run_name="__main__")
        except SystemExit as e:
            if e.code not in (0, None):
                print(f"step {script} exited with {e.code}")
                return int(e.code)
        print(f"--- {script} done in {time.time() - t:.0f} s", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
