"""Month-by-month view of the network for the animated home map.

For every NASA cell and every month from 1981 to the latest available day (NASA POWER / MERRA-2 daily):
  tx   mean daily maximum air temperature (C)            -> line colour
  rail hottest estimated rail temperature of the month (C) -> heat problems (rail model v1)
  tn   coldest daily minimum of the month (C)              -> frost / rail-break problems
  pr   wettest day of the month (mm)                       -> heavy-rain / washout problems
After the last complete year, months are topped up to the latest available day with NASA POWER near-real-time data
(fetch_recent.py: GEOS-IT / FLASHFlux, may be revised); the current month is marked as partial.
Plus a typical year for 2041-2060 and 2081-2100 (SSP2-4.5): 1995-2014 monthly means shifted by the median
NEX-GDDP-CMIP6 monthly tasmax delta (delta method, as in process.py).

Writes web/public/data/monthly.json (integers, to keep the file small). Run after process.py.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import climate
import config as C


def main() -> None:
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    summary = json.loads((C.OUT / "summary.json").read_text(encoding="utf-8"))
    g_ref, v_ref = summary["meta"]["g_ref"], summary["meta"]["v_ref"]
    y0, y1 = C.YEARS
    frames: dict[str, pd.DataFrame] = {}
    last_days = []
    for c in cells:
        cid = c["cell_id"]
        df = climate.load_power(C.CACHE / "power" / f"{cid}.json").loc[f"{y0}":f"{y1}"]
        rec_path = C.CACHE / "power_recent" / f"{cid}.json"
        if rec_path.exists():
            rec = climate.load_power(rec_path)
            rec = rec[rec.index > df.index[-1]]
            df = pd.concat([df, rec])
        valid = df["T2M_MAX"].dropna()
        last_days.append(valid.index[-1])
        frames[cid] = df
    last_day = min(last_days)  # a day every cell has
    months = pd.date_range(f"{y0}-01-01", last_day.strftime("%Y-%m-01"), freq="MS")
    partial = (last_day + pd.Timedelta(days=1)).month == last_day.month
    out = {"start": f"{y0}-01", "n": len(months), "last_day": last_day.strftime("%Y-%m-%d"), "partial": bool(partial),
           "recent_from": f"{y1 + 1}-01", "cells": {}, "proj": {"2041-2060": {}, "2081-2100": {}}}
    for c in cells:
        cid = c["cell_id"]
        df = frames[cid].loc[:last_day]
        rail = climate.rail_temperature(df, c["lat"], g_ref, v_ref)
        tx = df["T2M_MAX"].resample("MS").mean().reindex(months)
        rmax = rail.resample("MS").max().reindex(months)
        tn = df["T2M_MIN"].resample("MS").min().reindex(months)
        pr = df["PRECTOTCORR"].resample("MS").max().reindex(months)
        ints = lambda s: [None if not np.isfinite(v) else int(round(float(v))) for v in s.values]
        out["cells"][cid] = {"tx": ints(tx), "rail": ints(rmax), "tn": ints(tn), "pr": ints(pr)}
        # typical projected year
        cell_file = C.OUT / "cells" / f"{cid}.json"
        if not cell_file.exists():
            continue
        deltas = json.loads(cell_file.read_text(encoding="utf-8"))["rail"]["deltas_tasmax"]
        base = df.loc["1995":"2014"]
        base_tx = base["T2M_MAX"].groupby(base.index.month).mean()
        r = rail.loc["1995":"2014"]
        base_r = r.resample("MS").max().groupby(lambda d: d.month).mean()
        for per in out["proj"]:
            ds = [m["ssp245"][per] for m in deltas.values() if m.get("ssp245", {}).get(per)]
            if not ds:
                continue
            d = np.median(np.array(ds, dtype=float), axis=0)  # 12 monthly deltas
            out["proj"][per][cid] = {
                "tx": [int(round(float(base_tx[m + 1] + d[m]))) for m in range(12)],
                "rail": [int(round(float(base_r[m + 1] + d[m]))) for m in range(12)],
            }
    (C.OUT / "monthly.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print("monthly.json:", len(out["cells"]), "cells x", len(months), "months, last day", out["last_day"], "partial" if partial else "")


if __name__ == "__main__":
    main()
