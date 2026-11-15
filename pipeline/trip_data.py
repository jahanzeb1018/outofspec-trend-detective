"""Day-level data for the trip planner: pick one date, any year from 1981 to 2100.

past    web/public/data/daily/YYYY-MM.json  one value per day and NASA cell (NASA POWER daily, MERRA-2; the current
        year from POWER near-real-time data as in monthly.py): [tx, tn, rail, pr] = max air (C), min air (C),
        estimated hottest rail (C, rail model v1), rain (mm). Integers.
        web/public/data/daily/index.json    first and last day available.
future  web/public/data/clim/<cid>.json     the climate of a calendar date, every 5 days of the year (73 steps), for
        three anchor climates. Each step uses the days within +-7 days of it:
          now   measured 2016-2025 (NASA POWER)
          2050  measured 1995-2014 + median NEX-GDDP-CMIP6 monthly change, SSP2-4.5, 2041-2060 (delta method, as in
                process.py: tasmax change added to max air and rail, tasmin change to min air)
          2090  the same with 2081-2100
        values: rail50 / rail90 (typical / 1-in-10 hottest-afternoon rail), tx50 / tx90, tn50 / tn10.
The web page blends the anchors linearly in time for any year in between.

Run after process.py and fetch_recent.py.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import climate
import config as C

STEP = 5
WIN = 7
SCEN = "ssp245"
ANCHORS = {"now": ((2016, 2025), None), "2050": (C.REF, "2041-2060"), "2090": (C.REF, "2081-2100")}


def median_delta(nex_cell: dict, var: str, per: str) -> np.ndarray | None:
    ds = []
    for m in nex_cell.values():
        h, f = m.get("historical", {}).get(var), m.get(SCEN, {}).get(per, {}).get(var)
        if h and f:
            ds.append(np.array(f, float) - np.array(h, float))
    return np.median(np.array(ds), axis=0) if ds else None


def window_stats(doy: np.ndarray, vals: dict[str, np.ndarray]) -> dict[str, list[int]]:
    out = {k: [] for k in ("rail50", "rail90", "tx50", "tx90", "tn50", "tn10")}
    for k in range(73):
        centre = 1 + STEP * k
        d = np.abs(doy - centre)
        mask = np.minimum(d, 366 - d) <= WIN
        r, tx, tn = vals["rail"][mask], vals["tx"][mask], vals["tn"][mask]
        out["rail50"].append(int(round(np.nanpercentile(r, 50))))
        out["rail90"].append(int(round(np.nanpercentile(r, 90))))
        out["tx50"].append(int(round(np.nanpercentile(tx, 50))))
        out["tx90"].append(int(round(np.nanpercentile(tx, 90))))
        out["tn50"].append(int(round(np.nanpercentile(tn, 50))))
        out["tn10"].append(int(round(np.nanpercentile(tn, 10))))
    return out


def main() -> None:
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    summary = json.loads((C.OUT / "summary.json").read_text(encoding="utf-8"))
    nex = json.loads((C.CACHE / "nex_cells.json").read_text(encoding="utf-8"))
    g_ref, v_ref = summary["meta"]["g_ref"], summary["meta"]["v_ref"]
    y0, y1 = C.YEARS
    frames, last_days = {}, []
    for c in cells:
        cid = c["cell_id"]
        df = climate.load_power(C.CACHE / "power" / f"{cid}.json").loc[f"{y0}":f"{y1}"]
        rec_path = C.CACHE / "power_recent" / f"{cid}.json"
        if rec_path.exists():
            rec = climate.load_power(rec_path)
            df = pd.concat([df, rec[rec.index > df.index[-1]]])
        last_days.append(df["T2M_MAX"].dropna().index[-1])
        frames[cid] = df
    last_day = min(last_days)

    daily_dir, clim_dir = C.OUT / "daily", C.OUT / "clim"
    daily_dir.mkdir(exist_ok=True)
    clim_dir.mkdir(exist_ok=True)
    months = pd.date_range(f"{y0}-01-01", last_day.strftime("%Y-%m-01"), freq="MS")
    by_month: dict[str, dict[str, list]] = {m.strftime("%Y-%m"): {} for m in months}
    ints = lambda s: [None if not np.isfinite(v) else int(round(float(v))) for v in s]  # noqa: E731

    for c in cells:
        cid = c["cell_id"]
        df = frames[cid].loc[:last_day]
        rail = climate.rail_temperature(df, c["lat"], g_ref, v_ref)
        tx, tn, pr = df["T2M_MAX"], df["T2M_MIN"], df["PRECTOTCORR"]
        key = df.index.strftime("%Y-%m")
        for m in by_month:
            sel = key == m
            by_month[m][cid] = [ints(tx.values[sel]), ints(tn.values[sel]), ints(rail.values[sel]), ints(pr.values[sel])]

        clim = {"step": STEP, "window": WIN}
        for name, ((a, b), per) in ANCHORS.items():
            base = df.loc[f"{a}":f"{b}"]
            r = rail.loc[f"{a}":f"{b}"].values
            vx, vn = base["T2M_MAX"].values, base["T2M_MIN"].values
            if per:
                dtx, dtn = median_delta(nex.get(cid, {}), "tasmax", per), median_delta(nex.get(cid, {}), "tasmin", per)
                if dtx is None or dtn is None:
                    continue
                mi = base.index.month.values - 1
                vx, r, vn = vx + dtx[mi], r + dtx[mi], vn + dtn[mi]
            clim[name] = window_stats(base.index.dayofyear.values, {"rail": r, "tx": vx, "tn": vn})
        (clim_dir / f"{cid}.json").write_text(json.dumps(clim, separators=(",", ":")), encoding="utf-8")

    for m, cellvals in by_month.items():
        (daily_dir / f"{m}.json").write_text(json.dumps({"cells": cellvals}, separators=(",", ":")), encoding="utf-8")
    (daily_dir / "index.json").write_text(json.dumps({"first": f"{y0}-01-01", "last_day": last_day.strftime("%Y-%m-%d")}), encoding="utf-8")
    size = sum(p.stat().st_size for p in daily_dir.glob("*.json")) / 1e6
    print(f"daily: {len(by_month)} months to {last_day.date()} ({size:.1f} MB); clim: {len(cells)} cells")


if __name__ == "__main__":
    main()
