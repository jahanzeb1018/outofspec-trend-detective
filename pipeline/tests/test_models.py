import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import buckling  # noqa: E402
import climate  # noqa: E402
import config as C  # noqa: E402


def test_fra_presets():
    assert buckling.dt_allow(C.PRESETS["strong"]["fp"]) == pytest.approx(55.556, abs=0.01)
    assert buckling.dt_allow(C.PRESETS["average"]["fp"]) == pytest.approx(47.778, abs=0.01)
    assert buckling.dt_allow(C.PRESETS["weak"]["fp"]) == pytest.approx(33.333, abs=0.01)


def test_dt_allow_monotone_and_clamped():
    xs = np.linspace(5, 40, 50)
    ys = buckling.dt_allow(xs)
    assert np.all(np.diff(ys) >= 0)
    assert ys[0] == pytest.approx(33.333, abs=0.01) and ys[-1] == pytest.approx(55.556, abs=0.01)


def test_bands():
    assert buckling.bsm_band(-1) == "none"
    assert buckling.bsm_band(5) == "minimum"
    assert buckling.bsm_band(15) == "adequate"
    assert buckling.bsm_band(30) == "desired"


def test_simulation_limits():
    yrs = [np.array([40.0, 50.0, 60.0])] * 5
    huge = buckling.simulate(yrs, "strong", n=50, tn_spec={"kind": "value", "value": -100.0}, sigma=0)
    assert huge["days_mean"] == 3
    none = buckling.simulate(yrs, "strong", n=50, tn_spec={"kind": "value", "value": 60.0}, sigma=0)
    assert none["days_mean"] == 0
    assert none["bsm_med"] == pytest.approx(55.556 - (60 - 60), abs=0.01)


def test_seeded_reproducible():
    yrs = [np.random.default_rng(1).normal(55, 5, 153) for _ in range(10)]
    a = buckling.simulate(yrs, "unknown", n=300, seed=3)
    b = buckling.simulate(yrs, "unknown", n=300, seed=3)
    assert a == b


def test_rail_model_behaviour():
    idx = pd.date_range("2020-07-01", periods=3, freq="D")
    df = pd.DataFrame({"T2M_MAX": [35.0, 35.0, 35.0], "ALLSKY_SFC_SW_DWN": [8.0, 8.0, 2.0], "WS2M": [1.0, 5.0, 1.0]}, index=idx)
    tr = climate.rail_temperature(df, 40.0, g_ref=850.0, v_ref=2.0)
    assert tr.iloc[0] > tr.iloc[1]  # more wind -> cooler rail
    assert tr.iloc[0] > tr.iloc[2]  # less sun -> cooler rail
    assert (tr - df["T2M_MAX"]).between(*C.RAIL_DT_CAP).all()


def test_day_length():
    assert climate.day_length_hours(40.0, np.array([172]))[0] == pytest.approx(15.0, abs=0.2)


def test_doy_probability_bounds():
    idx = pd.date_range("2000-01-01", "2009-12-31", freq="D")
    s = pd.Series(np.where(idx.month == 7, 41.0, 20.0), index=idx)
    p = climate.doy_probability(s, 40)
    assert p.max() == 1 and p.min() == 0 and len(p) == 366
