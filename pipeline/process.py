"""Main pipeline: indicators, trends + FDR, future (delta method), rail model, buckling Monte Carlo, calendar-day
probabilities, climate analogs, network summaries, validation and export to web/public/data.

Run after network.py, fetch_power.py, fetch_ghcn.py, fetch_nex.py and nex_process.py.
"""
from __future__ import annotations

import json
import math
import time
from collections import defaultdict

import numpy as np
import pandas as pd
from shapely.geometry import mapping, shape

import buckling
import climate
import config as C
import stats
from network import STATIONS

COUNT_INDICATORS = {"HOT35", "HOT38", "HOT40", "HOT42", "HOTSPELL", "TN20", "FROST", "COLD5", "ICE", "R20"}
HOT40_CLASSES = [(0, 0, "0"), (1, 5, "1–5"), (6, 10, "6–10"), (11, 20, "11–20"), (21, 30, "21–30"), (31, 999, ">30")]
PRESETS = ["strong", "average", "weak", "unknown"]


def rnd(x, nd=2):
    if x is None:
        return None
    if isinstance(x, (float, np.floating)):
        if not math.isfinite(float(x)):
            return None
        return round(float(x), nd)
    if isinstance(x, (np.integer,)):
        return int(x)
    return x


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def period_mean(ann: pd.DataFrame, ind: str, a: int, b: int) -> float:
    return float(ann.loc[a:b, ind].mean())


def provenance(params: list[str], extra: str = "") -> dict:
    return {
        "source": "NASA POWER (MERRA-2 meteorology; SRB/CERES radiation)" + extra,
        "product": "POWER daily point API, community RE, LST",
        "parameters": params,
        "api_url_template": C.POWER_URL + "?parameters={params}&community=RE&longitude={lon}&latitude={lat}&start=19810101&end=20251231&format=JSON&time-standard=LST",
        "retrieved_at": time.strftime("%Y-%m-%d"),
        "pipeline_version": C.PIPELINE_VERSION,
    }


def nearest_place(lat: float, lon: float) -> str:
    best = min(STATIONS.items(), key=lambda kv: (kv[1][0] - lat) ** 2 + ((kv[1][1] - lon) * math.cos(math.radians(lat))) ** 2)
    name = best[0]
    for suffix in (" Atocha", " Chamartín", " Sants"):
        name = name.replace(suffix, "")
    return name


def main() -> None:
    t0 = time.time()
    out = C.OUT
    (out / "cells").mkdir(parents=True, exist_ok=True)
    cells = json.loads((C.CACHE / "cells.json").read_text(encoding="utf-8"))
    cell_by = {c["cell_id"]: c for c in cells}
    segs = json.loads((C.CACHE / "segments.geojson").read_text(encoding="utf-8"))
    routes = json.loads((C.CACHE / "routes.json").read_text(encoding="utf-8"))
    nex_path = C.CACHE / "nex_cells.json"
    nex = json.loads(nex_path.read_text(encoding="utf-8")) if nex_path.exists() else {}
    models = json.loads((C.CACHE / "nex" / "models.json").read_text())["models"] if nex else []

    def complete(model: str) -> bool:
        for cid in nex:
            m = nex[cid].get(model, {})
            h = m.get("historical", {})
            if "tasmax" not in h or "tasmin" not in h or len(h.get("txp95", {})) < 30:
                return False
            for s in C.SCENARIOS:
                for p in C.FUTURE_PERIODS:
                    f = m.get(s, {}).get(p, {})
                    if "tasmax" not in f or "tasmin" not in f or any(v is None for v in f["tasmax"] + f["tasmin"]):
                        return False
        return True

    dropped = [m for m in models if not complete(m)]
    models = [m for m in models if m not in dropped]
    if dropped:
        print("models skipped (incomplete downloads):", dropped)
    print(f"{len(cells)} cells, {len(models)} models, nex={'yes' if nex else 'no'}")

    # ---------------------------------------------------------------- pass 1: load + rail-model anchor
    dfs = {}
    gps, vs = [], []
    for c in cells:
        df = climate.load_power(C.CACHE / "power" / f"{c['cell_id']}.json").loc[f"{C.YEARS[0]}":f"{C.YEARS[1]}"]
        dfs[c["cell_id"]] = df
        gp, v = climate.anchor_stats(df, c["lat"])
        gps.append(gp)
        vs.append(v)
    g_ref = float(np.median(np.concatenate(gps)))
    v_ref = float(np.median(np.concatenate(vs)))
    print(f"rail anchor: G_ref={g_ref:.0f} W/m2, v_ref={v_ref:.2f} m/s (days with Tmax>=35C)")

    # ---------------------------------------------------------------- pass 2: indicators + trends
    years = list(range(C.YEARS[0], C.YEARS[1] + 1))
    R: dict[str, dict] = {}
    for c in cells:
        cid = c["cell_id"]
        df = dfs[cid]
        tr = climate.rail_temperature(df, c["lat"], g_ref, v_ref)
        ann = climate.annual_indicators(df["T2M_MAX"], df["T2M_MIN"], df["PRECTOTCORR"], tr)
        tr_dict = {}
        for ind in C.INDICATORS:
            y = ann[ind].values.astype(float)
            t = stats.trend(y)
            rare = ind in COUNT_INDICATORS and float((y == 0).mean()) > C.TOO_RARE_ZERO_SHARE
            yn = stats.years_needed(y, t.sen_slope, t.sen_intercept) if t.p_mk_hr >= C.ALPHA and t.sen_slope != 0 else None
            tr_dict[ind] = {"t": t, "rare": rare, "years_needed": yn}
        R[cid] = {"ann": ann, "trends": tr_dict, "tr": tr}

    # ---------------------------------------------------------------- FDR per indicator across cells
    fdr_counts = {}
    for ind in C.INDICATORS:
        ids = [c["cell_id"] for c in cells]
        p = np.array([R[i]["trends"][ind]["t"].p_mk_hr for i in ids])
        rej, q = stats.bh_fdr(p, C.ALPHA_FDR)
        raw = p < C.ALPHA
        for i, cid in enumerate(ids):
            R[cid]["trends"][ind]["sig_raw"] = bool(raw[i])
            R[cid]["trends"][ind]["sig_fdr"] = bool(rej[i])
            R[cid]["trends"][ind]["q"] = float(q[i]) if np.isfinite(q[i]) else None
        km = np.array([cell_by[i]["track_km"] for i in ids])
        fdr_counts[ind] = {
            "tests": len(ids), "raw": int(raw.sum()), "fdr": int(rej.sum()),
            "raw_km": round(float(km[raw].sum())), "fdr_km": round(float(km[rej].sum())),
        }

    # ---------------------------------------------------------------- future (delta method) + rail + buckling
    warm = lambda s: s[s.index.month.isin(C.RAIL_SEASON_MONTHS)]  # noqa: E731
    fut_keys = [(s, p) for s in C.SCENARIOS for p in C.FUTURE_PERIODS]
    for ci, c in enumerate(cells):
        cid = c["cell_id"]
        df = dfs[cid]
        ann = R[cid]["ann"]
        tr = R[cid]["tr"]
        a, b = C.REF
        tx_ref, tn_ref, tr_ref = df["T2M_MAX"].loc[f"{a}":f"{b}"], df["T2M_MIN"].loc[f"{a}":f"{b}"], tr.loc[f"{a}":f"{b}"]
        fut = {ind: {s: {p: {} for p in C.FUTURE_PERIODS} for s in C.SCENARIOS} for ind in C.FUTURE_INDICATORS}
        deltas = {}
        fut_tr_years = {k: {} for k in fut_keys}
        windows = {k: {"heat": [], "cold": []} for k in fut_keys}
        doy_fut = {k: {thr: [] for thr in C.HOT_THRESHOLDS} for k in fut_keys}
        ref_am = float(tr_ref.groupby(tr_ref.index.year).max().median())
        ref_tnn = float(tn_ref.groupby(tn_ref.index.year).min().median())
        for model in models:
            m = nex.get(cid, {}).get(model)
            if not m:
                continue
            hist_x, hist_n = np.array(m["historical"]["tasmax"], float), np.array(m["historical"]["tasmin"], float)
            for s, p in fut_keys:
                f = m[s][p]
                dtx = np.array(f["tasmax"], float) - hist_x
                dtn = np.array(f["tasmin"], float) - hist_n
                deltas.setdefault(model, {}).setdefault(s, {})[p] = [round(float(v), 2) for v in dtx]
                txf = climate.shift_by_month(tx_ref, dtx)
                tnf = climate.shift_by_month(tn_ref, dtn)
                trf = climate.shift_by_month(tr_ref, dtx)
                annf = climate.annual_indicators(txf, tnf, None, trf)
                for ind in C.FUTURE_INDICATORS:
                    fut[ind][s][p][model] = float(annf[ind].mean())
                wf = warm(trf)
                fut_tr_years[(s, p)][model] = [wf[wf.index.year == y].values for y in sorted(set(wf.index.year))]
                windows[(s, p)]["heat"].append(float(trf.groupby(trf.index.year).max().median()) - ref_am)
                windows[(s, p)]["cold"].append(float(tnf.groupby(tnf.index.year).min().median()) - ref_tnn)
                if p == "2041-2060":
                    for thr in C.HOT_THRESHOLDS:
                        doy_fut[(s, p)][thr].append(climate.doy_probability(txf, thr))
        R[cid]["fut"] = fut
        R[cid]["deltas"] = deltas
        R[cid]["windows"] = {
            f"{s}|{p}": {
                k: ({"med": rnd(np.median(v)), "min": rnd(np.min(v)), "max": rnd(np.max(v))} if v else None)
                for k, v in w.items()
            } for (s, p), w in windows.items()
        }
        # buckling Monte Carlo per preset and period
        wr = warm(tr)
        years_of = lambda a_, b_: [wr[wr.index.year == y].values for y in range(a_, b_ + 1)]  # noqa: E731
        buck = {}
        for preset in PRESETS:
            bp = {
                "ref": buckling.simulate(years_of(*C.REF), preset, seed=C.SEED + ci),
                "recent": buckling.simulate(years_of(*C.RECENT), preset, seed=C.SEED + ci + 1),
            }
            for s, p in fut_keys:
                per_model = [
                    buckling.simulate(yrs, preset, n=600, seed=C.SEED + ci + 7 * j)
                    for j, yrs in enumerate(fut_tr_years[(s, p)].values())
                ]
                if per_model:
                    agg = {k: float(np.median([r_[k] for r_ in per_model])) for k in per_model[0]}
                    agg["days_mean_min"] = float(min(r_["days_mean"] for r_ in per_model))
                    agg["days_mean_max"] = float(max(r_["days_mean"] for r_ in per_model))
                    bp[f"{s}|{p}"] = agg
            buck[preset] = {k: {kk: rnd(vv) for kk, vv in v.items()} for k, v in bp.items()}
        R[cid]["buckling"] = buck
        # calendar-day probabilities of a day >= threshold within +-7 days
        doy = {}
        for thr in C.HOT_THRESHOLDS:
            e = climate.doy_probability(df["T2M_MAX"].loc[f"{C.EARLY[0]}":f"{C.EARLY[1]}"], thr)
            l_ = climate.doy_probability(df["T2M_MAX"].loc[f"{C.LATE[0]}":f"{C.LATE[1]}"], thr)
            d_thr = {"1981-1990": [int(round(v * 100)) for v in e], "2016-2025": [int(round(v * 100)) for v in l_]}
            for s, p in fut_keys:
                arr = doy_fut[(s, p)][thr]
                if arr:
                    d_thr[f"{s}|{p}"] = [int(round(v * 100)) for v in np.mean(arr, axis=0)]
            doy[str(thr)] = d_thr
        R[cid]["doy"] = doy
        if ci % 20 == 0:
            print(f"  cell {ci + 1}/{len(cells)} ({time.time() - t0:.0f} s)", flush=True)

    # ---------------------------------------------------------------- per-cell summary for maps
    def ens(d: dict):
        v = list(d.values())
        return [rnd(np.median(v)), rnd(np.min(v)), rnd(np.max(v))] if v else None

    summary = {}
    for c in cells:
        cid = c["cell_id"]
        ann = R[cid]["ann"]
        cs = {}
        for ind in C.INDICATORS:
            tt = R[cid]["trends"][ind]
            t = tt["t"]
            row = {
                "now": rnd(period_mean(ann, ind, *C.NOW)), "ref": rnd(period_mean(ann, ind, *C.REF)),
                "early": rnd(period_mean(ann, ind, *C.EARLY)), "late": rnd(period_mean(ann, ind, *C.LATE)),
                "sen": rnd(t.sen_slope * 10, 3), "lo": rnd(t.ci_low * 10, 3), "hi": rnd(t.ci_high * 10, 3),
                "p": rnd(t.p_mk_hr, 4), "q": rnd(tt["q"], 4), "raw": tt["sig_raw"], "fdr": tt["sig_fdr"], "rare": tt["rare"],
            }
            if ind in C.FUTURE_INDICATORS and models:
                row["fut"] = {s: {p: ens(R[cid]["fut"][ind][s][p]) for p in C.FUTURE_PERIODS} for s in C.SCENARIOS}
            cs[ind] = row
        cs["_bsm"] = {pr: {k: [v["bsm_med"], v["days_mean"]] for k, v in R[cid]["buckling"][pr].items()} for pr in PRESETS}
        summary[cid] = cs

    # ---------------------------------------------------------------- analogs
    vec_inds = ["HOT40", "TXP95", "TN20", "FROST"]
    ids = [c["cell_id"] for c in cells]
    present = np.array([[summary[i][k]["now"] for k in vec_inds] for i in ids], float)
    mu, sd = present.mean(axis=0), present.std(axis=0)
    sd[sd == 0] = 1
    zp = (present - mu) / sd
    pair = np.sqrt(((zp[:, None, :] - zp[None, :, :]) ** 2).sum(-1))
    dstar = float(np.percentile(pair[np.triu_indices(len(ids), 1)], 10))
    analogs = {}
    if models:
        for s, p in fut_keys:
            fv = np.array([[summary[i][k]["fut"][s][p][0] for k in vec_inds] for i in ids], float)
            zf = (fv - mu) / sd
            dist = np.sqrt(((zf[:, None, :] - zp[None, :, :]) ** 2).sum(-1))
            res = []
            for a_i, cid in enumerate(ids):
                j = int(np.argmin(dist[a_i]))
                ok = bool(dist[a_i, j] <= dstar)
                ca, cb = cell_by[cid], cell_by[ids[j]]
                res.append({
                    "from": cid, "to": ids[j] if ok else None, "d": rnd(dist[a_i, j], 3), "ok": ok,
                    "from_place": nearest_place(ca["lat"], ca["lon"]), "to_place": nearest_place(cb["lat"], cb["lon"]) if ok else None,
                })
            analogs[f"{s}|{p}"] = res

    # ---------------------------------------------------------------- network summaries
    km_of = {c["cell_id"]: c["track_km"] for c in cells}
    total_km = sum(km_of.values())

    def class_km(values: dict[str, float]) -> list[float]:
        out_ = [0.0] * len(HOT40_CLASSES)
        for cid, v in values.items():
            vv = round(v)
            for k, (lo, hi, _) in enumerate(HOT40_CLASSES):
                if lo <= vv <= hi:
                    out_[k] += km_of[cid]
                    break
        return [round(x) for x in out_]

    stacked = {"classes": [c_[2] for c_ in HOT40_CLASSES], "years": years,
               "observed": [class_km({cid: float(R[cid]["ann"].loc[y, "HOT40"]) for cid in ids}) for y in years],
               "ref": class_km({cid: summary[cid]["HOT40"]["ref"] for cid in ids}), "future": {}}
    if models:
        for s, p in fut_keys:
            stacked["future"][f"{s}|{p}"] = class_km({cid: summary[cid]["HOT40"]["fut"][s][p][0] for cid in ids})

    def kmw(vals: dict[str, float]) -> float:
        return float(sum(v * km_of[k] for k, v in vals.items()) / total_km)

    headline = {
        "total_km": round(total_km), "cells": len(ids),
        "hot40_sig_up_km": round(sum(km_of[i] for i in ids if summary[i]["HOT40"]["fdr"] and summary[i]["HOT40"]["sen"] > 0)),
        "hot40_sig_up_km_raw": round(sum(km_of[i] for i in ids if summary[i]["HOT40"]["raw"] and summary[i]["HOT40"]["sen"] > 0)),
        "hot35_sig_up_km": round(sum(km_of[i] for i in ids if summary[i]["HOT35"]["fdr"] and summary[i]["HOT35"]["sen"] > 0)),
        "frost_sig_down_km": round(sum(km_of[i] for i in ids if summary[i]["FROST"]["fdr"] and summary[i]["FROST"]["sen"] < 0)),
        "hot40_early_kmw": rnd(kmw({i: summary[i]["HOT40"]["early"] for i in ids})),
        "hot40_late_kmw": rnd(kmw({i: summary[i]["HOT40"]["late"] for i in ids})),
        "frost_early_kmw": rnd(kmw({i: summary[i]["FROST"]["early"] for i in ids})),
        "frost_late_kmw": rnd(kmw({i: summary[i]["FROST"]["late"] for i in ids})),
    }
    nomargin = {}
    for pr in PRESETS:
        nomargin[pr] = {k: round(sum(km_of[i] for i in ids if R[i]["buckling"][pr].get(k, {}).get("bsm_med") is not None
                                     and R[i]["buckling"][pr][k]["bsm_med"] < 0))
                        for k in ["ref", "recent"] + [f"{s}|{p}" for s, p in fut_keys]}
    future_cards = {}
    if models:
        for s, p in fut_keys:
            k = f"{s}|{p}"
            heat = {i: R[i]["windows"][k]["heat"]["med"] for i in ids if R[i]["windows"][k]["heat"]}
            frost_ref = kmw({i: summary[i]["FROST"]["ref"] for i in ids})
            frost_f = kmw({i: summary[i]["FROST"]["fut"][s][p][0] for i in ids})
            km10_ref = round(sum(km_of[i] for i in ids if summary[i]["HOT40"]["ref"] > 10))
            km10_f = round(sum(km_of[i] for i in ids if summary[i]["HOT40"]["fut"][s][p][0] > 10))
            hv = sorted(heat.items(), key=lambda kv: kv[1])
            acc, med_shift = 0.0, None
            for cid, v in hv:
                acc += km_of[cid]
                if acc >= total_km / 2:
                    med_shift = v
                    break
            future_cards[k] = {
                "km_hot40_gt10_ref": km10_ref, "km_hot40_gt10": km10_f,
                "km_nomargin_average_ref": nomargin["average"]["ref"], "km_nomargin_average": nomargin["average"][k],
                "frost_days_ref_kmw": rnd(frost_ref), "frost_days_kmw": rnd(frost_f),
                "frost_change_pct": rnd(100 * (frost_f - frost_ref) / frost_ref if frost_ref else None, 1),
                "neutral_shift_median": rnd(med_shift),
            }
    # age matrix
    seg_props = [f["properties"] for f in segs["features"]]
    groups = defaultdict(lambda: {"km": 0.0, "d40": 0.0, "dram": 0.0, "year": None, "src": None})
    for sp in seg_props:
        key = sp["opened_line"] if sp["line_type"] == "HSL" and sp["opened_line"] else ("Conventional lines" if sp["line_type"] != "HSL" else None)
        if not key or not models:
            continue
        g = groups[key]
        cs = summary[sp["cell_id"]]
        fut40 = cs["HOT40"]["fut"]["ssp245"]["2041-2060"][0]
        futram = cs["RAIL_AM"]["fut"]["ssp245"]["2041-2060"][0]
        g["km"] += sp["length_km"]
        g["d40"] += (fut40 - cs["HOT40"]["ref"]) * sp["length_km"]
        g["dram"] += (futram - cs["RAIL_AM"]["ref"]) * sp["length_km"]
        g["year"], g["src"] = sp.get("opened_year"), sp.get("opened_source")
    age = [{"line": k, "year": v["year"], "source": v["src"], "km": round(v["km"]),
            "d_hot40": rnd(v["d40"] / v["km"]), "d_rail_am": rnd(v["dram"] / v["km"])} for k, v in groups.items() if v["km"] > 20]
    # top-10 fastest changing (HOT40 Sen slope, significant after FDR), unique cells
    cand = []
    for sp in seg_props:
        cs = summary[sp["cell_id"]]["HOT40"]
        if cs["fdr"] and cs["sen"] > 0:
            cand.append((cs["sen"], sp))
    cand.sort(key=lambda x: -x[0])
    top, seen = [], set()
    for sen, sp in cand:
        if sp["cell_id"] in seen:
            continue
        seen.add(sp["cell_id"])
        cs = summary[sp["cell_id"]]["HOT40"]
        c_ = cell_by[sp["cell_id"]]
        top.append({"segment_id": sp["segment_id"], "line": sp["line_name"] or "Unnamed line", "cell_id": sp["cell_id"],
                    "place": nearest_place(c_["lat"], c_["lon"]), "sen": sen, "lo": cs["lo"], "hi": cs["hi"],
                    "early": cs["early"], "late": cs["late"]})
        if len(top) == 10:
            break

    # ---------------------------------------------------------------- model historical vs observed (1981-2014)
    hist_check = []
    if models:
        for cid in ids:
            obs = R[cid]["ann"].loc[C.HIST_TREND[0]:C.HIST_TREND[1]]
            row = {"cell_id": cid}
            for ind, key in (("TXP95", "txp95"), ("HOT35", "hot35")):
                o = stats.trend(obs[ind].values).sen_slope * 10
                ms = []
                for model in models:
                    series = nex[cid][model]["historical"].get(key, {})
                    yrs = sorted(int(y) for y in series)
                    if len(yrs) >= 30:
                        ms.append(stats.trend(np.array([series[str(y)] if str(y) in series else series[y] for y in yrs], float)).sen_slope * 10)
                row[ind] = {"obs": rnd(o, 3), "model_med": rnd(np.median(ms), 3) if ms else None,
                            "model_min": rnd(np.min(ms), 3) if ms else None, "model_max": rnd(np.max(ms), 3) if ms else None}
            hist_check.append(row)

    # ---------------------------------------------------------------- validation: GHCN-Daily stations vs POWER
    validation = {"stations": [], "hist_check": hist_check}
    st_meta = json.loads((C.CACHE / "ghcn" / "stations.json").read_text(encoding="utf-8"))
    for st in st_meta:
        g = pd.read_csv(C.CACHE / "ghcn" / f"{st['id']}.csv", usecols=lambda c_: c_ in ("DATE", "TMAX", "TMIN"), parse_dates=["DATE"],
                        low_memory=False)
        g = g.set_index("DATE").sort_index()
        for col in ("TMAX", "TMIN"):
            g[col] = pd.to_numeric(g[col], errors="coerce") / 10.0
        pw = climate.load_power(C.CACHE / "power" / f"st_{st['id']}.json").loc[f"{C.YEARS[0]}":f"{C.YEARS[1]}"]
        j = pd.concat([g["TMAX"].rename("obs"), pw["T2M_MAX"].rename("power")], axis=1, sort=True).dropna()
        j = j.loc[f"{C.YEARS[0]}":f"{C.YEARS[1]}"]
        cnt = j.groupby(j.index.year).size()
        good_years = cnt[cnt >= 330].index
        jy = j[j.index.year.isin(good_years)]
        a_obs = jy["obs"].groupby(jy.index.year).agg(lambda s_: (s_ >= 35).sum())
        a_pw = jy["power"].groupby(jy.index.year).agg(lambda s_: (s_ >= 35).sum())
        x_obs = jy["obs"].groupby(jy.index.year).max()
        x_pw = jy["power"].groupby(jy.index.year).max()
        t_obs = stats.trend(a_obs.values.astype(float)) if len(a_obs) >= 10 else None
        t_pw = stats.trend(a_pw.values.astype(float)) if len(a_pw) >= 10 else None
        validation["stations"].append({
            **st, "days": int(len(j)), "years": int(len(good_years)),
            "daily_r": rnd(j["obs"].corr(j["power"]), 3), "daily_bias": rnd((j["power"] - j["obs"]).mean()),
            "hot35_obs_mean": rnd(a_obs.mean(), 1), "hot35_power_mean": rnd(a_pw.mean(), 1),
            "hot35_r": rnd(a_obs.corr(a_pw), 3), "txx_bias": rnd((x_pw - x_obs).mean()),
            "hot35_sen_obs": rnd(t_obs.sen_slope * 10, 2) if t_obs else None,
            "hot35_sen_power": rnd(t_pw.sen_slope * 10, 2) if t_pw else None,
            "series": {"years": [int(y) for y in a_obs.index], "hot35_obs": [int(v) for v in a_obs.values],
                       "hot35_power": [int(v) for v in a_pw.values]},
        })
    fra_path = C.CACHE / "fra_t109.json"
    if fra_path.exists():
        validation["fra_t109"] = json.loads(fra_path.read_text(encoding="utf-8"))
    gio_path = C.CACHE / "giovanni.json"
    if gio_path.exists():
        validation["giovanni"] = json.loads(gio_path.read_text(encoding="utf-8"))

    # ---------------------------------------------------------------- golden files for TS parity
    gold = []
    rng = np.random.default_rng(C.SEED)
    for i, cid in enumerate(ids[:: max(1, len(ids) // 8)][:8]):
        for ind in ("HOT40", "TXP95", "FROST"):
            gold.append({"name": f"{cid}-{ind}", "y": [float(v) for v in R[cid]["ann"][ind].values]})
    for k in range(8):
        n = int(rng.integers(12, 50))
        y = 0.04 * k * np.arange(n) + rng.normal(0, 1, n)
        if k % 2:
            y = np.round(y)
        gold.append({"name": f"synthetic-{k}", "y": [float(v) for v in y]})
    for gd in gold:
        t = stats.trend(np.array(gd["y"]))
        gd["expected"] = {**t.to_dict(), "years_needed": stats.years_needed(np.array(gd["y"]), t.sen_slope, t.sen_intercept)}
    pv = rng.uniform(0, 0.2, 40)
    rej, q = stats.bh_fdr(pv, C.ALPHA_FDR)
    bucket = {"fra_points": C.FRA_POINTS, "cases": []}
    for fp in (8.0, 12.26, 15.0, 21.0, 25.0, 31.52, 40.0):
        bucket["cases"].append({"fp": fp, "dt_allow": float(buckling.dt_allow(fp))})
    det = buckling.simulate([np.array([40.0, 50.0, 60.0, 70.0]), np.array([55.0, 65.0])], "average", n=10, tn_spec={"kind": "value", "value": 20.0}, sigma=0.0)
    bucket["deterministic"] = {"years": [[40, 50, 60, 70], [55, 65]], "tn": 20.0, "preset": "average", "result": det}
    C.GOLDEN.mkdir(parents=True, exist_ok=True)
    dump(C.GOLDEN / "trend_golden.json", {"series": gold, "bh": {"p": pv.tolist(), "alpha": C.ALPHA_FDR, "rej": rej.tolist(), "q": q.tolist()}, "buckling": bucket})

    # ---------------------------------------------------------------- export
    # segments (simplified)
    feats = []
    for f in segs["features"]:
        p = f["properties"]
        g = shape(f["geometry"]).simplify(0.0003, preserve_topology=False)
        coords = [[round(x, 5), round(y, 5)] for x, y in g.coords]
        feats.append({"type": "Feature", "id": int(p["segment_id"][1:]), "geometry": {"type": "LineString", "coordinates": coords},
                      "properties": {"id": p["segment_id"], "n": p["line_name"], "t": p["line_type"], "g": p["gauge_mm"],
                                     "e": int(bool(p["electrified"])), "v": p["maxspeed_kmh"], "r": p["min_radius_m"],
                                     "k": p["curve_class"], "c": p["cell_id"], "L": p["length_km"], "y": p["opened_year"],
                                     "yl": p["opened_line"], "ys": p["opened_source"]}})
    dump(out / "segments.geojson", {"type": "FeatureCollection", "features": feats})
    cell_feats = []
    for c in cells:
        la, lo = c["lat"], c["lon"]
        hy, hx = C.LAT_STEP / 2, C.LON_STEP / 2
        ring = [[lo - hx, la - hy], [lo + hx, la - hy], [lo + hx, la + hy], [lo - hx, la + hy], [lo - hx, la - hy]]
        cell_feats.append({"type": "Feature", "id": ids.index(c["cell_id"]), "geometry": {"type": "Polygon", "coordinates": [[[round(x, 4), round(y, 4)] for x, y in ring]]},
                           "properties": {"c": c["cell_id"], "km": c["track_km"], "lat": la, "lon": lo, "place": nearest_place(la, lo)}})
    dump(out / "cells.geojson", {"type": "FeatureCollection", "features": cell_feats})
    dump(out / "summary.json", {"indicators": C.INDICATORS, "future_indicators": C.FUTURE_INDICATORS, "scenarios": C.SCENARIOS,
                                "periods": list(C.FUTURE_PERIODS), "models": models, "cells": summary,
                                "meta": {"years": C.YEARS, "now": C.NOW, "ref": C.REF, "early": C.EARLY, "late": C.LATE,
                                         "alpha": C.ALPHA, "alpha_fdr": C.ALPHA_FDR, "g_ref": round(g_ref, 1), "v_ref": round(v_ref, 2),
                                         "pipeline_version": C.PIPELINE_VERSION, "generated": time.strftime("%Y-%m-%d")}})
    timeline_inds = ["HOT35", "HOT38", "HOT40", "HOT42", "TN20", "FROST", "TXP95", "RAIL_AM", "TXX"]
    dump(out / "annual.json", {"years": years, "values": {ind: {cid: [rnd(v, 1) for v in R[cid]["ann"][ind].values] for cid in ids} for ind in timeline_inds}})
    for c in cells:
        cid = c["cell_id"]
        ann = R[cid]["ann"]
        tr = R[cid]["tr"]
        wr = tr[tr.index.month.isin(C.RAIL_SEASON_MONTHS)].loc[f"{C.REF[0]}":f"{C.YEARS[1]}"]
        rail_years = sorted(set(wr.index.year))
        trends_out = {}
        for ind in C.INDICATORS:
            tt = R[cid]["trends"][ind]
            trends_out[ind] = {**{k: rnd(v, 5) for k, v in tt["t"].to_dict().items()}, "rare": tt["rare"], "sig_raw": tt["sig_raw"],
                               "sig_fdr": tt["sig_fdr"], "q": rnd(tt["q"], 5), "years_needed": tt["years_needed"]}
        detail = {
            "cell_id": cid, "lat": c["lat"], "lon": c["lon"], "track_km": c["track_km"], "place": nearest_place(c["lat"], c["lon"]),
            "years": years, "indicators": {ind: [rnd(v, 2) for v in ann[ind].values] for ind in C.INDICATORS},
            "trends": trends_out,
            "future": {ind: {s: {p: {m: rnd(v) for m, v in R[cid]["fut"][ind][s][p].items()} for p in C.FUTURE_PERIODS} for s in C.SCENARIOS}
                       for ind in C.FUTURE_INDICATORS} if models else {},
            "rail": {
                "season_months": C.RAIL_SEASON_MONTHS, "years": rail_years,
                "daily_x10": [[int(round(v * 10)) for v in wr[wr.index.year == y].values] for y in rail_years],
                "deltas_tasmax": R[cid]["deltas"], "windows": R[cid]["windows"],
                "ref_am": rnd(float(tr.loc[f"{C.REF[0]}":f"{C.REF[1]}"].groupby(tr.loc[f"{C.REF[0]}":f"{C.REF[1]}"].index.year).max().median())),
                "tnn_ref": rnd(float(ann.loc[C.REF[0]:C.REF[1], "TNN"].median())),
            },
            "buckling": R[cid]["buckling"], "doy": R[cid]["doy"],
            "provenance": provenance(C.POWER_PARAMS, "; NASA NEX-GDDP-CMIP6 (future)" if models else ""),
        }
        dump(out / "cells" / f"{cid}.json", detail)
    for rt in routes:
        rt.pop("preference", None)
    dump(out / "routes.json", routes)
    dump(out / "network.json", {"headline": headline, "fdr_counts": fdr_counts, "stacked": stacked, "analogs": analogs,
                                "analog_threshold": round(dstar, 3), "analog_vars": vec_inds, "age": age, "top10": top,
                                "nomargin_km": nomargin, "future_cards": future_cards,
                                "tension_kn_per_degc": round(buckling.tension_kn_per_degc(), 2)})
    dump(out / "validation.json", validation)
    print(f"export done in {time.time() - t0:.0f} s -> {out}")


if __name__ == "__main__":
    main()
