"""Optional validation of the heat component with real buckled-track derailments in the USA.

FRA "Rail Equipment Accident/Incident Data (Form 54)" (public domain), cause code T109 "Track alignment irregular
(buckled/sunkink)". For each derailment with coordinates we take NASA POWER T2M_MAX on that day and compute its
percentile within the local May-September climatology (1991-2020). If heat matters, percentiles crowd near 100.
Output: cache/fra_t109.json
"""
from __future__ import annotations

import json
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import requests

import climate
import config as C

API = "https://data.transportation.gov/resource/85tf-25kj.json"
OUT_DIR = C.CACHE / "power_fra"
S = requests.Session()
S.headers["User-Agent"] = "trend-detective-hackathon/0.1"


def fetch_events() -> list[dict]:
    rows, offset = [], 0
    while True:
        r = S.get(API, params={"$where": "primaryaccidentcausecode='T109'", "$select": "date,latitude,longitude,stateabbr,temperature",
                               "$limit": 5000, "$offset": offset}, timeout=120)
        r.raise_for_status()
        chunk = r.json()
        rows += chunk
        if len(chunk) < 5000:
            break
        offset += 5000
    return rows


def power_cell(lat: float, lon: float) -> pd.DataFrame | None:
    la = round(lat / C.LAT_STEP) * C.LAT_STEP
    lo = round(lon / C.LON_STEP) * C.LON_STEP
    dest = OUT_DIR / f"{la:.2f}_{lo:.3f}.json"
    if not dest.exists():
        q = {"parameters": "T2M_MAX", "community": "RE", "longitude": f"{lo:.4f}", "latitude": f"{la:.4f}", "start": "19910101",
             "end": "20251231", "format": "JSON", "time-standard": "LST"}
        for attempt in range(5):
            try:
                r = S.get(C.POWER_URL, params=q, timeout=300)
                if r.status_code == 200:
                    d = r.json()
                    dest.write_text(json.dumps({"start": "19910101", "data": {k: list(v.values()) for k, v in d["properties"]["parameter"].items()}}), encoding="utf-8")
                    break
            except requests.RequestException:
                pass
            time.sleep(8 * (attempt + 1))
        else:
            return None
    return climate.load_power(dest)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = fetch_events()
    ev = []
    seen = set()
    for r in rows:
        try:
            lat, lon = float(r.get("latitude", 0)), float(r.get("longitude", 0))
            d = pd.Timestamp(r["date"][:10])
        except (TypeError, ValueError, KeyError):
            continue
        if lon > 0:
            lon = -lon  # some records store west longitudes as positive
        if not (24 <= lat <= 50 and -125 <= lon <= -66) or not (1991 <= d.year <= 2025):
            continue
        key = (d.date(), round(lat, 2), round(lon, 2))
        if key in seen:
            continue
        seen.add(key)
        ev.append((d, lat, lon))
    print(f"T109 records {len(rows)}, unique with coordinates {len(ev)}")
    by_cell = defaultdict(list)
    for d, lat, lon in ev:
        by_cell[(round(lat / C.LAT_STEP) * C.LAT_STEP, round(lon / C.LON_STEP) * C.LON_STEP)].append(d)
    pct = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(power_cell, la, lo): (la, lo) for la, lo in by_cell}
        for i, f in enumerate(as_completed(futs)):
            df = f.result()
            if df is None:
                continue
            tx = df["T2M_MAX"]
            clim = np.sort(tx[(tx.index.year >= 1991) & (tx.index.year <= 2020) & tx.index.month.isin([5, 6, 7, 8, 9])].dropna().to_numpy())
            for d in by_cell[futs[f]]:
                if d in tx.index and np.isfinite(tx.loc[d]):
                    pct.append(100.0 * np.searchsorted(clim, tx.loc[d], side="right") / len(clim))
            if i % 50 == 0:
                print(f"  {i}/{len(by_cell)} cells", flush=True)
    p = np.array(pct)
    hist = np.histogram(p, bins=10, range=(0, 100))[0].tolist()
    out = {"events": len(rows), "with_coords": len(p), "median_percentile": float(np.median(p)), "share_above_p90": float((p > 90).mean()),
           "share_above_p75": float((p > 75).mean()), "histogram": hist, "years": [int(min(e[0].year for e in ev)), int(max(e[0].year for e in ev))],
           "source": "FRA Rail Equipment Accident/Incident Data (Form 54), data.transportation.gov 85tf-25kj, cause T109; NASA POWER T2M_MAX"}
    (C.CACHE / "fra_t109.json").write_text(json.dumps(out), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
