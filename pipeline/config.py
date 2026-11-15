"""Shared configuration for the whole pipeline. Every number used by the app is derived from these settings."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
OUT = ROOT.parent / "web" / "public" / "data"
GOLDEN = ROOT.parent / "web" / "src" / "stats" / "__golden__"
PIPELINE_VERSION = "1.0.0"
SEED = 20261114

# ---- periods -------------------------------------------------------------------------------------------
YEARS = (1981, 2025)  # complete years of NASA POWER / MERRA-2 daily data used for trends
EARLY = (1981, 1990)
LATE = (2016, 2025)
NOW = (1996, 2025)  # "Now" climatology (last 30 years)
REF = (1995, 2014)  # IPCC AR6 reference period = end of CMIP6 historical runs (delta-method baseline)
RECENT = (2006, 2025)  # recent observed 20 years (lab "recent" view)
FUTURE_PERIODS = {"2041-2060": (2041, 2060), "2081-2100": (2081, 2100)}
SCENARIOS = ["ssp245", "ssp585"]
HIST_TREND = (1981, 2014)  # model-historical vs observed trend check

# ---- NEX-GDDP-CMIP6 ------------------------------------------------------------------------------------
NEX_CATALOG = "https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6"
NEX_NCSS = "https://ds.nccs.nasa.gov/thredds/ncss/grid"
# Preference order; the first 6 with tasmax+tasmin for historical, ssp245 and ssp585 are used.
MODEL_PREFERENCE = [
    "GISS-E2-1-G",  # NASA GISS model
    "ACCESS-CM2",
    "EC-Earth3",
    "MPI-ESM1-2-HR",
    "MRI-ESM2-0",
    "NorESM2-MM",
    "IPSL-CM6A-LR",
    "CNRM-CM6-1",
    "MIROC6",
    "CanESM5",
]
N_MODELS = 6
BBOX = dict(north=44.0, south=35.75, west=-9.5, east=3.5)  # mainland Spain (+ margins)

# ---- NASA POWER ----------------------------------------------------------------------------------------
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "WS2M", "ALLSKY_SFC_SW_DWN", "PRECTOTCORR", "RH2M"]
LAT_STEP, LON_STEP = 0.5, 0.625  # MERRA-2 native grid used by POWER meteorology

# ---- statistics ----------------------------------------------------------------------------------------
ALPHA = 0.05
ALPHA_FDR = 0.10  # Wilks (2016)
TOO_RARE_ZERO_SHARE = 0.5

# ---- indicators ----------------------------------------------------------------------------------------
HOT_THRESHOLDS = [35, 38, 40, 42]
HOTSPELL_T = 38.0
TROPICAL_NIGHT_T = 20.0
HEAVY_RAIN_MM = 20.0
INDICATORS = [
    "HOT35", "HOT38", "HOT40", "HOT42", "TXP95", "TXX", "HOTSPELL", "TN20",
    "FROST", "COLD5", "ICE", "TNN", "R20", "RAIL_AM",
]
FUTURE_INDICATORS = [
    "HOT35", "HOT38", "HOT40", "HOT42", "TXP95", "TXX", "HOTSPELL", "TN20", "FROST", "COLD5", "ICE", "TNN", "RAIL_AM",
]

# ---- rail temperature model (spec section 11) ----------------------------------------------------------
RAIL_DT_REF = 17.0  # degC above air on a typical hot sunny day (FRA 2013: 25-35 degF = 13.9-19.4 degC)
RAIL_DT_RANGE = (13.9, 19.4)
RAIL_DT_CAP = (0.0, 25.0)
RAIL_SIGMA = 4.0  # degC, thermodynamic models RMSE ~3.8 degC (Sensors 2021)
RAIL_REF_HOT_DAY = 35.0  # anchor: median sun/wind on days with T2M_MAX >= 35 degC
RAIL_SEASON_MONTHS = [5, 6, 7, 8, 9]

# ---- buckling model (spec section 12, Kish & Samavedam 2013, FRA) --------------------------------------
LB_PER_IN_TO_KN_PER_M = 0.1751268
F2C = 5.0 / 9.0
# (peak lateral resistance kN/m, allowable temperature increase degC)
FRA_POINTS = [(70 * LB_PER_IN_TO_KN_PER_M, 60 * F2C), (120 * LB_PER_IN_TO_KN_PER_M, 86 * F2C), (180 * LB_PER_IN_TO_KN_PER_M, 100 * F2C)]
PRESETS = {
    "strong": {"fp": 180 * LB_PER_IN_TO_KN_PER_M},
    "average": {"fp": 120 * LB_PER_IN_TO_KN_PER_M},
    "weak": {"fp": 70 * LB_PER_IN_TO_KN_PER_M},
    "unknown": {"fp": None},
}
# CWR-RISK "Case A" distributions (Table 5-2), converted to SI
TN_DIST = ([(t - 32) * F2C for t in (60, 70, 80, 90, 100)], [0.04, 0.21, 0.50, 0.21, 0.04])
FP_DIST = ([v * LB_PER_IN_TO_KN_PER_M for v in (85, 100, 115, 130, 145)], [0.05, 0.25, 0.40, 0.25, 0.05])
BSM_BANDS = [(0.0, "none"), (100 / 9, "minimum"), (200 / 9, "adequate")]  # thresholds in degC (0, 20, 40 degF)
MC_SAMPLES = 2000
RAIL_E_PA = 210e9
RAIL_ALPHA = 11.5e-6
UIC60_AREA_M2 = 11.91 * 0.00064516  # FRA Table 2-10

# ---- network -------------------------------------------------------------------------------------------
SEGMENT_KM = 8.0
CURVE_SPACING_M = 50.0
CURVE_HALF_CHORD_M = 300.0
CURVE_PERCENTILE = 10
