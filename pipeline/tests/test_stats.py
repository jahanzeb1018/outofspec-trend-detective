import sys
from pathlib import Path

import numpy as np
import pymannkendall as mk
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import stats  # noqa: E402


def rng(seed=1):
    return np.random.default_rng(seed)


@pytest.mark.parametrize("seed", range(12))
def test_matches_pymannkendall(seed):
    r = rng(seed)
    n = int(r.integers(20, 60))
    y = 0.05 * np.arange(n) + r.normal(0, 1, n)
    if seed % 3 == 0:
        y = np.round(y)  # ties
    ours = stats.trend(y)
    ref = mk.hamed_rao_modification_test(y)
    classic = mk.original_test(y)
    assert ours.mk_s == pytest.approx(ref.s)
    # identical to pymannkendall when its correction inflates the variance; otherwise the classic test
    expected = ref.p if ref.var_s >= classic.var_s else classic.p
    assert ours.p_mk_hr == pytest.approx(expected, abs=1e-9)
    assert ours.sen_slope == pytest.approx(ref.slope)
    assert ours.sen_intercept == pytest.approx(ref.intercept)


def test_sen_recovers_known_slope():
    r = rng(7)
    slopes = []
    for _ in range(200):
        y = 0.3 * np.arange(45) + r.normal(0, 2, 45)
        slopes.append(stats.trend(y).sen_slope)
    assert np.mean(slopes) == pytest.approx(0.3, abs=0.02)


def test_ci_contains_slope():
    r = rng(3)
    y = 0.2 * np.arange(45) + r.normal(0, 1, 45)
    t = stats.trend(y)
    assert t.ci_low <= t.sen_slope <= t.ci_high


def test_false_positive_rate_white_noise():
    r = rng(11)
    hits = sum(stats.trend(r.normal(0, 1, 45)).p_mk_hr < 0.05 for _ in range(600))
    assert hits / 600 < 0.08


def test_hamed_rao_reduces_false_positives_ar1():
    r = rng(5)
    hr = classic = 0
    for _ in range(300):
        e = np.zeros(45)
        for i in range(1, 45):
            e[i] = 0.5 * e[i - 1] + r.normal()
        hr += stats.trend(e).p_mk_hr < 0.05
        classic += mk.original_test(e).p < 0.05
    assert hr <= classic


def test_ols_matches_scipy():
    from scipy.stats import linregress

    r = rng(9)
    y = 0.1 * np.arange(30) + r.normal(0, 1, 30)
    lr = linregress(np.arange(30), y)
    t = stats.trend(y)
    assert t.ols_slope == pytest.approx(lr.slope)
    assert t.p_ols == pytest.approx(lr.pvalue)


def test_bh_known_case():
    p = np.array([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216])
    rej, q = stats.bh_fdr(p, 0.05)
    assert rej.tolist() == [True, True, False, False, False, False, False, False, False, False]
    assert q[0] == pytest.approx(0.01)


def test_bh_nan_safe():
    rej, q = stats.bh_fdr(np.array([0.01, np.nan, 0.02]), 0.1)
    assert rej.tolist() == [True, False, True]
    assert np.isnan(q[1])


def test_years_needed_monotone():
    r = rng(2)
    y = 0.02 * np.arange(45) + r.normal(0, 1, 45)
    t = stats.trend(y)
    a = stats.years_needed(y, t.sen_slope, t.sen_intercept)
    b = stats.years_needed(y, t.sen_slope * 2, t.sen_intercept)
    assert a is not None and b is not None and b <= a
