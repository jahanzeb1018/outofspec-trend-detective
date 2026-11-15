"""Buckling safety-margin model (spec section 12), based on Kish & Samavedam (2013), DOT/FRA/ORD-13/16.
Mirrors web/src/model/buckling.ts.

load      = T_rail - T_neutral
dT_all    = allowable temperature increase, interpolated from FRA parametric results vs peak lateral resistance
BSM       = dT_all - (T_rail - T_neutral)       (bands: <0 none, 0-11 minimum, 11-22 adequate, >22 desired, degC)
Monte Carlo over neutral temperature, lateral resistance and rail-temperature model error (one draw per year).
"""
from __future__ import annotations

import numpy as np

import config as C


def dt_allow(fp_kn_m: np.ndarray | float) -> np.ndarray:
    xs = np.array([p[0] for p in C.FRA_POINTS])
    ys = np.array([p[1] for p in C.FRA_POINTS])
    return np.interp(fp_kn_m, xs, ys)  # clamps outside the FRA range


def bsm_band(bsm: float) -> str:
    if bsm < 0:
        return "none"
    if bsm < C.BSM_BANDS[1][0]:
        return "minimum"
    if bsm < C.BSM_BANDS[2][0]:
        return "adequate"
    return "desired"


def sample_discrete(rng: np.random.Generator, values, probs, n: int) -> np.ndarray:
    return rng.choice(np.asarray(values, dtype=float), size=n, p=np.asarray(probs) / np.sum(probs))


def sample_tn(rng, n, spec: dict | None) -> np.ndarray:
    if not spec or spec.get("kind") == "fra":
        return sample_discrete(rng, *C.TN_DIST, n)
    if spec["kind"] == "value":
        return np.full(n, float(spec["value"]))
    lo, hi = spec["range"]
    return rng.uniform(lo, hi, n)


def sample_fp(rng, n, preset: str, fp_value: float | None = None) -> np.ndarray:
    if fp_value is not None:
        return np.full(n, float(fp_value))
    fp = C.PRESETS[preset]["fp"]
    if fp is None:
        return sample_discrete(rng, *C.FP_DIST, n)
    return np.full(n, float(fp))


def simulate(years_tr: list[np.ndarray], preset: str, n: int = C.MC_SAMPLES, tn_spec: dict | None = None,
             fp_value: float | None = None, sigma: float = C.RAIL_SIGMA, seed: int = C.SEED) -> dict:
    """years_tr: list of arrays with daily max rail temperature for the warm season of each year."""
    rng = np.random.default_rng(seed)
    tn = sample_tn(rng, n, tn_spec)
    allow = dt_allow(sample_fp(rng, n, preset, fp_value))
    ny = len(years_tr)
    eps = rng.normal(0.0, sigma, size=(n, ny)) if sigma > 0 else np.zeros((n, ny))
    counts = np.zeros((n, ny))
    ams = np.array([float(np.max(y)) for y in years_tr])
    for j, y in enumerate(years_tr):
        s = np.sort(y)
        thr = tn + allow - eps[:, j]  # day counts when T_r > thr
        counts[:, j] = len(s) - np.searchsorted(s, thr, side="right")
    days_per_sample = counts.mean(axis=1)
    am_med = float(np.median(ams))
    # typical BSM: hottest day of a median year, with one draw of the rail-model error per sample
    bsm = allow - (am_med + eps[:, 0] - tn)
    return {
        "days_mean": float(days_per_sample.mean()),
        "days_p10": float(np.percentile(days_per_sample, 10)),
        "days_p90": float(np.percentile(days_per_sample, 90)),
        "p_any": float((counts >= 1).mean()),
        "bsm_med": float(np.median(bsm)),
        "bsm_p10": float(np.percentile(bsm, 10)),
        "bsm_p90": float(np.percentile(bsm, 90)),
        "rail_am_med": am_med,
    }


def tension_kn_per_degc() -> float:
    return C.RAIL_E_PA * C.RAIL_ALPHA * C.UIC60_AREA_M2 / 1000.0
