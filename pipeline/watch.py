"""Heat & cold watch support data (mirrors web/src/model/watch.ts).

1. watch.json  - per NASA cell and calendar month, quantiles of daily T2M_MAX and T2M_MIN (1981-2025, NASA POWER),
                 so a forecast value can be placed in the local climate ("hotter than 99% of days since 1981").
2. replays.json - the three hottest network-wide days in the NASA record, +-4 days, with the estimated rail
                 temperature, local percentile and watch status per cell (replayed on the Heat watch page).

Status rules (screening, not operational alerts), with the FRA-based model and a typical neutral temperature:
  margin(track) = allowable(track) - (T_rail - TN_TYPICAL)
  heat warning : margin(weak) < 0 and T_max >= local P99
  heat watch   : margin(weak) < 0 or  T_max >= local P99
  cold warning : T_min <= -10 C;  cold watch: T_min <= local P1 or T_min <= -5 C
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import buckling
import climate
import config as C

QS = [1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9]
TN_TYPICAL = float(np.dot(*C.TN_DIST))  # mean of the FRA "Case A" distribution, ~26.7 C
ALLOW = {k: float(buckling.dt_allow(C.PRESETS[k]["fp"])) for k in ("strong", "average", "weak")}


def pct_from_q(v: float, q: list[float]) -> float:
    """Percentile of v given the quantile values at QS (linear interpolation, clamped to [0, 100])."""
    xs = [0.0] + QS + [100.0]
    lo = q[0] - (q[1] - q[0])
    hi = q[-1] + (q[-1] - q[-2])
    ys = [lo] + list(q) + [hi]
    return float(np.interp(v, ys, xs))


WATCH_BUFFER = 10.0  # rail within this many C of a just-repaired track's limit -> heat watch if heat is also unusual


def status(tmax: float, tmin: float, rail: float, qmax: list[float], qmin: list[float]) -> str:
    """Same rules as web/src/model/watch.ts statusFor (keep in sync)."""
    m_weak = ALLOW["weak"] - (rail - TN_TYPICAL)
    hot99 = tmax >= qmax[QS.index(99)]
    cold1 = tmin <= qmin[QS.index(1)]
    if m_weak < 0 and hot99:
        return "heat-warning"
    if m_weak < 0 or (hot99 and m_weak < WATCH_BUFFER):
        return "heat-watch"
    if tmin <= -10:
        return "cold-warning"
    if tmin <= -5 or (cold1 and tmin <= 0):
        return "cold-watch"
    if hot99:
        return "unusual-warm"
    if cold1:
        return "unusual-cold"
    return "ok"


def main() -> None:
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    summary = json.loads((C.OUT / "summary.json").read_text(encoding="utf-8"))
    g_ref, v_ref = summary["meta"]["g_ref"], summary["meta"]["v_ref"]
    km = {c["cell_id"]: c["track_km"] for c in cells}
    out = {"quantiles": QS, "tn_typical": round(TN_TYPICAL, 2), "allow": {k: round(v, 2) for k, v in ALLOW.items()},
           "g_ref": g_ref, "v_ref": v_ref, "rail_dt_ref": C.RAIL_DT_REF, "rail_cap": C.RAIL_DT_CAP, "cells": {}}
    dfs, rails = {}, {}
    for c in cells:
        cid = c["cell_id"]
        df = climate.load_power(C.CACHE / "power" / f"{cid}.json").loc[f"{C.YEARS[0]}":f"{C.YEARS[1]}"]
        dfs[cid] = df
        rails[cid] = climate.rail_temperature(df, c["lat"], g_ref, v_ref)
        qx, qn = [], []
        for m in range(1, 13):
            sub = df[df.index.month == m]
            qx.append([round(float(v), 1) for v in np.percentile(sub["T2M_MAX"].dropna(), QS)])
            qn.append([round(float(v), 1) for v in np.percentile(sub["T2M_MIN"].dropna(), QS)])
        out["cells"][cid] = {"lat": c["lat"], "lon": c["lon"], "tmax": qx, "tmin": qn}
    (C.OUT / "watch.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")

    # hottest network-wide days (km-weighted mean of T2M_MAX)
    total = sum(km.values())
    mean = sum(dfs[cid]["T2M_MAX"] * km[cid] for cid in dfs) / total
    picks: list[pd.Timestamp] = []
    for day in mean.sort_values(ascending=False).index:
        if all(abs((day - p).days) > 45 for p in picks):
            picks.append(day)
        if len(picks) == 3:
            break
    replays = []
    for peak in sorted(picks):
        days = pd.date_range(peak - pd.Timedelta(days=4), peak + pd.Timedelta(days=4), freq="D")
        frames = []
        for d in days:
            cells_out = {}
            counts = {k: 0.0 for k in ("heat-warning", "heat-watch", "unusual-warm", "cold-warning", "cold-watch", "unusual-cold", "ok")}
            for cid, df in dfs.items():
                if d not in df.index:
                    continue
                tx, tn = float(df.at[d, "T2M_MAX"]), float(df.at[d, "T2M_MIN"])
                tr = float(rails[cid].at[d])
                cq = out["cells"][cid]
                qx, qn = cq["tmax"][d.month - 1], cq["tmin"][d.month - 1]
                s = status(tx, tn, tr, qx, qn)
                counts[s] += km[cid]
                cells_out[cid] = [round(tx, 1), round(tr, 1), round(pct_from_q(tx, qx), 1), s]
            frames.append({"date": d.strftime("%Y-%m-%d"), "cells": cells_out, "km": {k: round(v) for k, v in counts.items()},
                           "network_mean_tmax": round(float(mean.at[d]), 1)})
        hottest = max(frames, key=lambda f: f["network_mean_tmax"])
        top = max(hottest["cells"].items(), key=lambda kv: kv[1][1])
        replays.append({"peak": peak.strftime("%Y-%m-%d"), "frames": frames, "hottest_cell": top[0], "hottest_rail": top[1][1]})
        print("replay", peak.date(), "network mean Tmax", round(float(mean.at[peak]), 1), "hottest rail", top[1][1], top[0])
    (C.OUT / "replays.json").write_text(json.dumps({"source": "NASA POWER (MERRA-2) daily, rail model v1", "replays": replays},
                                                   separators=(",", ":")), encoding="utf-8")
    print("watch.json + replays.json written")


if __name__ == "__main__":
    main()
