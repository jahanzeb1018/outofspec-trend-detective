"""Detective-mode aggregation (mirrors web/src/detective/aggregate.ts) and the offline example places.

Daily POWER values -> per-year indicator for a season. A season-year is valid with >= 90% non-missing days.
DJF of year Y = Dec (Y-1) + Jan/Feb (Y).
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import climate
import config as C
from fetch_power import EXAMPLES

SEASONS = {"annual": None, "DJF": (12, 1, 2), "MAM": (3, 4, 5), "JJA": (6, 7, 8), "SON": (9, 10, 11)}
INDICATORS = {
    "T2M_MAX": ["mean", "max", "ge:30", "ge:35"],
    "T2M_MIN": ["mean", "min", "lt:0", "ge:20"],
    "T2M": ["mean"],
    "PRECTOTCORR": ["sum", "ge:20", "drymax"],
    "RH2M": ["mean"],
    "WS2M": ["mean", "max"],
    "ALLSKY_SFC_SW_DWN": ["mean"],
    "CLOUD_AMT": ["mean"],
    "GWETROOT": ["mean"],
    "EVLAND": ["sum"],
    "SNODP": ["gt:1"],
    "QV2M": ["mean"],
}


def longest_dry(v: np.ndarray) -> int:
    return climate.longest_run(v < 1.0)


def apply(ind: str, v: np.ndarray) -> float:
    if ind == "mean":
        return float(np.mean(v))
    if ind == "sum":
        return float(np.sum(v))
    if ind == "max":
        return float(np.max(v))
    if ind == "min":
        return float(np.min(v))
    if ind == "drymax":
        return float(longest_dry(v))
    op, thr = ind.split(":")
    t = float(thr)
    return float({"ge": v >= t, "gt": v > t, "lt": v < t}[op].sum())


def aggregate(df: pd.DataFrame, years: list[int]) -> dict:
    out: dict = {}
    for var, inds in INDICATORS.items():
        if var not in df:
            continue
        s = df[var]
        out[var] = {}
        for ind in inds:
            out[var][ind] = {}
            for season, months in SEASONS.items():
                vals = []
                for y in years:
                    if months is None:
                        sel = s[s.index.year == y]
                        expected = 366 if pd.Timestamp(year=y, month=1, day=1).is_leap_year else 365
                    else:
                        if months[0] == 12:
                            sel = pd.concat([s[(s.index.year == y - 1) & (s.index.month == 12)], s[(s.index.year == y) & s.index.month.isin([1, 2])]])
                            expected = 31 + 31 + (29 if pd.Timestamp(year=y, month=1, day=1).is_leap_year else 28)
                        else:
                            sel = s[(s.index.year == y) & s.index.month.isin(months)]
                            expected = int(sum(pd.Period(f"{y}-{m:02d}").days_in_month for m in months))
                    v = sel.dropna().values
                    vals.append(round(apply(ind, v), 3) if len(v) >= 0.9 * expected else None)
                out[var][ind][season] = vals
    return out


def main() -> None:
    years = list(range(C.YEARS[0], C.YEARS[1] + 1))
    (C.OUT / "examples").mkdir(parents=True, exist_ok=True)
    index = []
    for ex_id, label, rtype, lat, lon in EXAMPLES:
        raw = json.loads((C.CACHE / "power" / f"ex_{ex_id}.json").read_text(encoding="utf-8"))
        df = climate.load_power(C.CACHE / "power" / f"ex_{ex_id}.json")
        agg = aggregate(df, years)
        units = {k: v["units"] for k, v in raw["parameters"].items()}
        doc = {"id": ex_id, "label": label, "region_type": rtype, "lat": lat, "lon": lon, "years": years, "units": units,
               "sources": raw.get("sources"), "url": raw.get("url"), "retrieved_at": raw.get("retrieved_at"), "series": agg}
        (C.OUT / "examples" / f"{ex_id}.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
        index.append({"id": ex_id, "label": label, "region_type": rtype, "lat": lat, "lon": lon})
        if ex_id == "madrid":  # parity fixture for the TS aggregator (raw daily for a few variables)
            fx = {"start": raw["start"], "data": {k: raw["data"][k] for k in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR")},
                  "years": years, "expected": {k: agg[k] for k in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR")}}
            C.GOLDEN.mkdir(parents=True, exist_ok=True)
            (C.GOLDEN / "detective_fixture.json").write_text(json.dumps(fx, separators=(",", ":")), encoding="utf-8")
    (C.OUT / "examples" / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    print("examples:", [e["id"] for e in index])


if __name__ == "__main__":
    main()
