"""Daily NASA POWER data -> annual indicators (spec section 8) and the rail temperature model (spec section 11)."""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

import config as C


def load_power(path: Path) -> pd.DataFrame:
    d = json.loads(path.read_text(encoding="utf-8"))
    start = pd.Timestamp(d["start"])
    cols = {k: np.asarray(v, dtype=float) for k, v in d["data"].items()}
    n = len(next(iter(cols.values())))
    df = pd.DataFrame(cols, index=pd.date_range(start, periods=n, freq="D"))
    return df.where(df > -998)


# ------------------------------------------------------------------------------------------- rail model
def day_length_hours(lat: float, doy: np.ndarray) -> np.ndarray:
    decl = np.radians(23.44) * np.sin(2 * np.pi * (284 + doy) / 365.0)
    x = np.clip(-np.tan(np.radians(lat)) * np.tan(decl), -1, 1)
    return 24.0 / np.pi * np.arccos(x)


def g_peak(h_kwh: np.ndarray, lat: float, doy: np.ndarray) -> np.ndarray:
    """Peak irradiance (W/m2) of a half-sine daylight profile with daily total H (kWh/m2/day)."""
    n = day_length_hours(lat, doy)
    return np.pi * h_kwh * 1000.0 / (2.0 * np.maximum(n, 1e-6))


def h_conv(v: np.ndarray) -> np.ndarray:
    return 5.7 + 3.8 * np.maximum(v, 0.0)  # W/m2K, McAdams forced-convection correlation


def radiation_filled(df: pd.DataFrame) -> pd.Series:
    """ALLSKY_SFC_SW_DWN with gaps (1981-1983 before SRB) filled by the cell's day-of-year climatology."""
    h = df["ALLSKY_SFC_SW_DWN"]
    doy = df.index.dayofyear
    clim = h.groupby(doy).mean()
    clim = clim.reindex(range(1, 367)).interpolate(limit_direction="both")
    return h.fillna(pd.Series(clim.loc[doy].values, index=df.index))


def anchor_stats(df: pd.DataFrame, lat: float) -> tuple[np.ndarray, np.ndarray]:
    hot = df["T2M_MAX"] >= C.RAIL_REF_HOT_DAY
    sub = df[hot & df["ALLSKY_SFC_SW_DWN"].notna()]
    gp = g_peak(sub["ALLSKY_SFC_SW_DWN"].values, lat, sub.index.dayofyear.values)
    return gp, sub["WS2M"].values


def rail_temperature(df: pd.DataFrame, lat: float, g_ref: float, v_ref: float) -> pd.Series:
    """Daily maximum rail temperature, model v1: T_air,max + dT_ref*(G/G_ref)*(h(v_ref)/h(v)), capped to [0, 25]."""
    h = radiation_filled(df).values
    gp = g_peak(h, lat, df.index.dayofyear.values)
    dt = C.RAIL_DT_REF * (gp / g_ref) * (h_conv(np.array(v_ref)) / h_conv(df["WS2M"].values))
    dt = np.clip(dt, *C.RAIL_DT_CAP)
    return pd.Series(df["T2M_MAX"].values + dt, index=df.index)


# -------------------------------------------------------------------------------------------- indicators
def longest_run(mask: np.ndarray) -> int:
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best


def annual_indicators(tmax: pd.Series, tmin: pd.Series, prec: pd.Series | None = None, trail: pd.Series | None = None) -> pd.DataFrame:
    rows = {}
    for year, tx in tmax.groupby(tmax.index.year):
        tn = tmin[tmin.index.year == year]
        txv, tnv = tx.values, tn.values
        r = {f"HOT{t}": int((txv >= t).sum()) for t in C.HOT_THRESHOLDS}
        r["TXP95"] = float(np.percentile(txv, 95))
        r["TXX"] = float(txv.max())
        r["HOTSPELL"] = longest_run(txv >= C.HOTSPELL_T)
        r["TN20"] = int((tnv >= C.TROPICAL_NIGHT_T).sum())
        r["FROST"] = int((tnv < 0).sum())
        r["COLD5"] = int((tnv <= -5).sum())
        r["ICE"] = int((txv < 0).sum())
        r["TNN"] = float(tnv.min())
        if prec is not None:
            r["R20"] = int((prec[prec.index.year == year].values >= C.HEAVY_RAIN_MM).sum())
        if trail is not None:
            r["RAIL_AM"] = float(trail[trail.index.year == year].max())
        rows[year] = r
    return pd.DataFrame.from_dict(rows, orient="index")


# -------------------------------------------------------------------------------- calendar day probability
def cal_index(idx: pd.DatetimeIndex) -> np.ndarray:
    """Index 0..365 on a leap-year calendar (Feb 29 = 59) so every month-day maps to the same slot."""
    doy = idx.dayofyear.values - 1
    leap = idx.is_leap_year
    return np.where(~leap & (idx.month > 2), doy + 1, doy)


def doy_probability(tmax: pd.Series, thr: float, window: int = 7) -> np.ndarray:
    """Share of years with at least one day >= thr within +-window days of each calendar day (366 values)."""
    years = sorted(set(tmax.index.year))
    hits = np.zeros(366)
    for y in years:
        s = tmax[tmax.index.year == y]
        flag = np.zeros(366, dtype=bool)
        flag[cal_index(s.index)[s.values >= thr]] = True
        k = np.ones(2 * window + 1)
        hits += np.convolve(np.concatenate([flag[-window:], flag, flag[:window]]), k, "valid") > 0
    return hits / max(len(years), 1)


def shift_by_month(series: pd.Series, delta12: np.ndarray) -> pd.Series:
    return series + delta12[series.index.month.values - 1]


def day_length_check() -> float:  # used in tests
    return float(day_length_hours(40.0, np.array([172]))[0])


if __name__ == "__main__":
    print("day length 40N, June 21:", round(day_length_check(), 2), "h")
    print("h(1 m/s) =", h_conv(np.array(1.0)), "W/m2K")
    print(math.pi)
