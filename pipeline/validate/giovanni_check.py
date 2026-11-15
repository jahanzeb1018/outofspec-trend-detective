"""Cross-check NASA POWER against NASA Giovanni (needs a free Earthdata login to download from Giovanni).

How to produce the input (5 minutes per cell):
 1. https://giovanni.gsfc.nasa.gov/ -> log in with Earthdata.
 2. Plot type "Time Series, Area-Averaged"; variable "Maximum 2-meter air temperature (M2SDNXSLV v5.12.4)" (MERRA-2 daily).
 3. Bounding box = the MERRA-2 cell (lat +-0.25, lon +-0.3125 around the cell centre shown in the explorer); dates 1981-01-01..2025-12-31.
 4. Download the CSV and save it as pipeline/validate/giovanni/<cell_id>.csv (e.g. 37.50_-6.250.csv).
Then run:  python pipeline/validate/giovanni_check.py   (and re-run pipeline/process.py to publish the result).
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import climate  # noqa: E402
import config as C  # noqa: E402

IN = Path(__file__).parent / "giovanni"


def read_giovanni(path: Path) -> pd.Series:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    start = next(i for i, l in enumerate(lines) if l.lower().startswith("time"))
    df = pd.read_csv(io.StringIO("\n".join(lines[start:])))
    s = pd.Series(pd.to_numeric(df.iloc[:, 1], errors="coerce").values, index=pd.to_datetime(df.iloc[:, 0]).dt.normalize())
    return s - 273.15 if s.mean() > 200 else s  # Kelvin -> Celsius


def main() -> None:
    out = []
    for f in sorted(IN.glob("*.csv")):
        cid = f.stem
        pw = C.CACHE / "power" / f"{cid}.json"
        if not pw.exists():
            print("no POWER file for", cid)
            continue
        g = read_giovanni(f)
        p = climate.load_power(pw)["T2M_MAX"]
        j = pd.concat([g.rename("giovanni"), p.rename("power")], axis=1, sort=True).dropna()
        out.append({"cell_id": cid, "days": int(len(j)), "r": round(float(j["giovanni"].corr(j["power"])), 4),
                    "bias": round(float((j["power"] - j["giovanni"]).mean()), 3), "mae": round(float((j["power"] - j["giovanni"]).abs().mean()), 3)})
        print(out[-1])
    (C.CACHE / "giovanni.json").write_text(json.dumps(out), encoding="utf-8")
    print(f"{len(out)} cells compared -> cache/giovanni.json")


if __name__ == "__main__":
    main()
