"""Trend statistics (spec section 9). Mirrors web/src/stats/*.ts exactly; parity is tested with golden files.

- Sen's slope (Sen 1968) with Gilbert's non-parametric 95% CI
- Mann-Kendall test with the Hamed & Rao (1998) variance correction for autocorrelation (same algorithm as
  pymannkendall.hamed_rao_modification_test)
- OLS slope with a two-sided t-test
- Benjamini-Hochberg false discovery rate
- Approximate extra years needed for significance (50% power of the trend test, AR(1) noise)
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from scipy.stats import norm, rankdata, t as student_t


@dataclass
class Trend:
    n: int
    sen_slope: float  # per year
    sen_intercept: float
    ci_low: float
    ci_high: float
    mk_s: float
    mk_var_s: float
    mk_z: float
    p_mk_hr: float
    tau: float
    ols_slope: float
    p_ols: float

    def to_dict(self) -> dict:
        return asdict(self)


def _clean(y: np.ndarray) -> np.ndarray:
    return np.asarray(y, dtype=float)


def sen_slopes(y: np.ndarray) -> np.ndarray:
    n = len(y)
    i, j = np.triu_indices(n, k=1)
    return (y[j] - y[i]) / (j - i)


def mk_score(y: np.ndarray) -> float:
    n = len(y)
    i, j = np.triu_indices(n, k=1)
    return float(np.sign(y[j] - y[i]).sum())


def mk_variance(y: np.ndarray) -> float:
    n = len(y)
    _, tp = np.unique(y, return_counts=True)
    return float((n * (n - 1) * (2 * n + 5) - np.sum(tp * (tp - 1) * (2 * tp + 5))) / 18)


def _acf(x: np.ndarray, nlags: int) -> np.ndarray:
    yv = x - x.mean()
    n = len(x)
    acov = np.correlate(yv, yv, "full")[n - 1:] / n
    if acov[0] == 0:  # constant ranks (e.g. a perfectly linear series): no autocorrelation correction
        return np.zeros(nlags + 1)
    return acov[: nlags + 1] / acov[0]


def _z(s: float, var_s: float) -> float:
    if var_s <= 0:
        return 0.0
    if s > 0:
        return (s - 1) / math.sqrt(var_s)
    if s < 0:
        return (s + 1) / math.sqrt(var_s)
    return 0.0


def interp_rank(sorted_vals: np.ndarray, idx: float) -> float:
    idx = min(max(idx, 0.0), len(sorted_vals) - 1.0)
    lo = int(math.floor(idx))
    hi = min(lo + 1, len(sorted_vals) - 1)
    f = idx - lo
    return float(sorted_vals[lo] * (1 - f) + sorted_vals[hi] * f)


def trend(y_in, alpha: float = 0.05) -> Trend:
    y = _clean(y_in)
    n = len(y)
    if n < 4 or np.any(~np.isfinite(y)):
        raise ValueError("need >= 4 finite values")
    slopes = np.sort(sen_slopes(y))
    slope = float(np.median(slopes))
    intercept = float(np.median(y) - np.median(np.arange(n)) * slope)
    s = mk_score(y)
    var_s = mk_variance(y)
    # Gilbert (1987) confidence interval for Sen's slope (unmodified variance)
    c = norm.ppf(1 - alpha / 2) * math.sqrt(var_s) if var_s > 0 else 0.0
    N = len(slopes)
    ci_low = interp_rank(slopes, (N - c) / 2 - 1)
    ci_high = interp_rank(slopes, (N + c) / 2)
    # Hamed & Rao (1998) correction
    x_detrend = y - np.arange(1, n + 1) * slope
    ranks = rankdata(x_detrend)
    acf = _acf(ranks, n - 1)
    bound = norm.ppf(1 - alpha / 2) / math.sqrt(n)
    sni = 0.0
    for i in range(1, n):
        if not (-bound <= acf[i] <= bound):
            sni += (n - i) * (n - i - 1) * (n - i - 2) * acf[i]
    n_ns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni
    # Conservative variant: chance negative autocorrelation must not shrink the variance below the independent case
    # (the unrestricted correction gives ~10% false positives on white noise with n=45; see tests).
    n_ns = max(1.0, n_ns)
    var_mod = var_s * n_ns
    z = _z(s, var_mod)
    p_mk = float(2 * (1 - norm.cdf(abs(z))))
    tau = s / (0.5 * n * (n - 1))
    # OLS t-test
    tt = np.arange(n, dtype=float)
    tm, ym = tt.mean(), y.mean()
    sxx = float(((tt - tm) ** 2).sum())
    b = float(((tt - tm) * (y - ym)).sum() / sxx)
    resid = y - (ym + b * (tt - tm))
    sse = float((resid**2).sum())
    if sse <= 0:
        p_ols = 0.0 if b != 0 else 1.0
    else:
        se = math.sqrt(sse / (n - 2) / sxx)
        p_ols = float(2 * student_t.sf(abs(b / se), n - 2))
    return Trend(n, slope, intercept, ci_low, ci_high, s, var_mod, z, p_mk, tau, b, p_ols)


def bh_fdr(p: np.ndarray, alpha: float) -> tuple[np.ndarray, np.ndarray]:
    """Benjamini-Hochberg step-up. Returns (rejected mask, adjusted q-values). NaN p-values are never rejected."""
    p = np.asarray(p, dtype=float)
    ok = np.isfinite(p)
    q = np.full_like(p, np.nan)
    rej = np.zeros(len(p), dtype=bool)
    m = int(ok.sum())
    if m == 0:
        return rej, q
    idx = np.flatnonzero(ok)
    order = idx[np.argsort(p[idx], kind="mergesort")]
    ranked = p[order] * m / np.arange(1, m + 1)
    qs = np.minimum.accumulate(ranked[::-1])[::-1]
    q[order] = np.minimum(qs, 1.0)
    passed = np.flatnonzero(p[order] <= alpha * np.arange(1, m + 1) / m)
    if passed.size:
        rej[order[: passed.max() + 1]] = True
    return rej, q


def years_needed(y_in, slope: float, intercept: float) -> float | None:
    """Approximate extra years of data so that a trend test detects this slope with 50% power.

    Residual noise sd and lag-1 autocorrelation phi (clipped to [0, 0.9]) give an effective sd
    sigma_eff = sd*sqrt((1+phi)/(1-phi)). The OLS t statistic for n years is slope*sqrt(n(n^2-1)/12)/sigma_eff;
    it reaches 1.96 when n = cbrt(12*(1.96*sigma_eff/slope)^2) (n^2-1 ~ n^2). Returns None when slope == 0.
    """
    y = _clean(y_in)
    n = len(y)
    if slope == 0:
        return None
    resid = y - (intercept + slope * np.arange(n))
    sd = float(np.std(resid, ddof=1))
    if sd == 0:
        return 0.0
    r = resid - resid.mean()
    phi = float((r[1:] * r[:-1]).sum() / (r * r).sum()) if (r * r).sum() > 0 else 0.0
    phi = min(max(phi, 0.0), 0.9)
    sig = sd * math.sqrt((1 + phi) / (1 - phi))
    n_req = (12 * (1.96 * sig / abs(slope)) ** 2) ** (1 / 3)
    return float(max(0.0, math.ceil(n_req - n)))
