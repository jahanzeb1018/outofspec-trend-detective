"""Aggregate the NEX-GDDP-CMIP6 NetCDF subsets to the MERRA-2 cells of the network.

Output cache/nex_cells.json:
{cell_id: {model: {"historical": {"tasmax": [12], "tasmin": [12], "txp95": {year: v}, "hot35": {year: v}},
                   "ssp245": {"2041-2060": {"tasmax": [12], "tasmin": [12]}, ...}, ...}}}
Monthly means (degC) over each period; raw model annual TXP95/HOT35 for 1981-2014 (historical trend check).
"""
from __future__ import annotations

import json
from collections import defaultdict

import numpy as np
import xarray as xr

import config as C

NEX_DIR = C.CACHE / "nex"


def cell_index(lat: np.ndarray, lon: np.ndarray, cells: list[dict]) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    out = {}
    for c in cells:
        li = np.flatnonzero(np.abs(lat - c["lat"]) <= C.LAT_STEP / 2 + 1e-9)
        lj = np.flatnonzero(np.abs(lon - c["lon"]) <= C.LON_STEP / 2 + 1e-9)
        out[c["cell_id"]] = (li, lj)
    return out


def main() -> None:
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    models = json.loads((NEX_DIR / "models.json").read_text())["models"]
    # sums[cell][model][scenario][period][var] -> [12 sums], counts
    def acc_factory():
        return {"s": np.zeros(12), "n": np.zeros(12)}

    def nested(depth):
        return defaultdict(acc_factory) if depth == 0 else defaultdict(lambda: nested(depth - 1))

    sums = nested(4)  # cell -> model -> scenario -> period -> var -> accumulator
    annual = defaultdict(lambda: defaultdict(lambda: {"txp95": {}, "hot35": {}}))
    idx_cache = None
    nearest_cache: dict[str, tuple[int, int]] = {}
    missing = 0
    for model in models:
        if not (NEX_DIR / model).exists():
            print("missing model directory", model)
            continue
        for scen_dir in sorted((NEX_DIR / model).iterdir()):
            scen = scen_dir.name
            for f in sorted(scen_dir.glob("*.nc")):
                var, year = f.stem.split("_")
                year = int(year)
                if scen == "historical":
                    period = "ref" if C.REF[0] <= year <= C.REF[1] else None
                else:
                    period = next((k for k, (a, b) in C.FUTURE_PERIODS.items() if a <= year <= b), None)
                try:
                    ds = xr.open_dataset(f)
                except Exception as e:  # noqa: BLE001
                    print("bad file", f, e)
                    missing += 1
                    continue
                da = ds[var] - 273.15
                lat = da["lat"].values
                lon = ((da["lon"].values + 180) % 360) - 180
                if idx_cache is None:
                    idx_cache = cell_index(lat, lon, cells)
                vals = da.values  # time, lat, lon
                months = da["time"].dt.month.values
                for c in cells:
                    cid = c["cell_id"]
                    li, lj = idx_cache[cid]
                    block = vals[:, li][:, :, lj].reshape(vals.shape[0], -1) if li.size and lj.size else np.empty((vals.shape[0], 0))
                    series = np.nanmean(block, axis=1) if block.size and np.isfinite(block).any() else None
                    if series is None or not np.isfinite(series).all():
                        if cid not in nearest_cache:
                            finite = np.isfinite(vals[0])
                            ii, jj = np.nonzero(finite)
                            d = (lat[ii] - c["lat"]) ** 2 + ((lon[jj] - c["lon"]) * np.cos(np.radians(c["lat"]))) ** 2
                            k = int(np.argmin(d))
                            nearest_cache[cid] = (int(ii[k]), int(jj[k]))
                        i0, j0 = nearest_cache[cid]
                        series = vals[:, i0, j0]
                    if period:
                        acc = sums[cid][model][scen][period][var]
                        for m in range(12):
                            sel = months == m + 1
                            acc["s"][m] += float(series[sel].sum())
                            acc["n"][m] += int(sel.sum())
                    if scen == "historical" and var == "tasmax" and C.HIST_TREND[0] <= year <= C.HIST_TREND[1]:
                        annual[cid][model]["txp95"][year] = float(np.percentile(series, 95))
                        annual[cid][model]["hot35"][year] = int((series >= 35).sum())
                ds.close()
            print("done", model, scen, flush=True)
    out: dict = {}
    for c in cells:
        cid = c["cell_id"]
        out[cid] = {}
        for model in models:
            m_out: dict = {"historical": dict(annual[cid][model])}
            for scen, periods in sums[cid][model].items():
                for period, vars_ in periods.items():
                    tgt = m_out["historical"] if scen == "historical" else m_out.setdefault(scen, {}).setdefault(period, {})
                    for var, acc in vars_.items():
                        tgt[var] = [round(float(s / n), 3) if n else None for s, n in zip(acc["s"], acc["n"])]
            out[cid][model] = m_out
    (C.CACHE / "nex_cells.json").write_text(json.dumps(out), encoding="utf-8")
    print("cells", len(out), "models", models, "bad files", missing)


if __name__ == "__main__":
    main()
