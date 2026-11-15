"""Download NASA NEX-GDDP-CMIP6 daily tasmax/tasmin for mainland Spain from NASA NCCS THREDDS (NetCDF Subset
Service). No account needed. Files land in cache/nex/{model}/{scenario}/{var}_{year}.nc.

Years: historical tasmax 1981-2014 (trend check + baseline), historical tasmin 1995-2014 (baseline),
ssp245/ssp585 tasmax+tasmin for 2041-2060 and 2081-2100.
"""
from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

import config as C

NEX_DIR = C.CACHE / "nex"
S = requests.Session()
S.headers["User-Agent"] = "trend-detective-hackathon/0.1"


def get(url: str, timeout: int = 120) -> requests.Response:
    for attempt in range(6):
        try:
            r = S.get(url, timeout=timeout)
            if r.status_code == 200:
                return r
            print("HTTP", r.status_code, url[-90:], flush=True)
        except requests.RequestException as e:
            print("retry", attempt, e.__class__.__name__, url[-90:], flush=True)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def list_files(model: str, scenario: str, var: str) -> dict[int, str]:
    """Map year -> urlPath for one model/scenario/variable (discovers the variant label and file version)."""
    base = f"{C.NEX_CATALOG}/{model}/{scenario}"
    variants = re.findall(r'title="([^"]+)"', get(f"{base}/catalog.xml").text)
    variants = [v for v in variants if re.match(r"r\d+i\d+p\d+f\d+", v)]
    if not variants:
        return {}
    cat = get(f"{base}/{variants[0]}/{var}/catalog.xml").text
    out: dict[int, str] = {}
    for path in re.findall(r'urlPath="([^"]+\.nc)"', cat):
        m = re.search(r"_(\d{4})(?:_v[\d.]+)?\.nc$", path)
        if m:
            year = int(m.group(1))
            # keep the highest version if several exist
            if year not in out or path > out[year]:
                out[year] = path
    return out


def plan() -> tuple[list[str], list[tuple[str, str, str, int, str]]]:
    needed = {
        ("historical", "tasmax"): range(C.HIST_TREND[0], C.HIST_TREND[1] + 1),
        ("historical", "tasmin"): range(C.REF[0], C.REF[1] + 1),
    }
    for scen in C.SCENARIOS:
        for var in ("tasmax", "tasmin"):
            years = [y for a, b in C.FUTURE_PERIODS.values() for y in range(a, b + 1)]
            needed[(scen, var)] = years
    models: list[str] = []
    jobs: list[tuple[str, str, str, int, str]] = []
    for model in C.MODEL_PREFERENCE:
        if len(models) == C.N_MODELS:
            break
        try:
            listing = {(s, v): list_files(model, s, v) for (s, v) in needed}
        except RuntimeError as e:
            print("skip", model, e)
            continue
        ok = all(all(y in listing[k] for y in needed[k]) for k in needed)
        if not ok:
            missing = {k: [y for y in needed[k] if y not in listing[k]][:3] for k in needed}
            print("skip", model, "missing", {k: v for k, v in missing.items() if v})
            continue
        models.append(model)
        for (s, v), years in needed.items():
            for y in years:
                jobs.append((model, s, v, y, listing[(s, v)][y]))
        print("use", model, flush=True)
    return models, jobs


def download(job: tuple[str, str, str, int, str]) -> str:
    model, scen, var, year, path = job
    dest = NEX_DIR / model / scen / f"{var}_{year}.nc"
    if dest.exists() and dest.stat().st_size > 100_000:
        return "cached"
    dest.parent.mkdir(parents=True, exist_ok=True)
    b = C.BBOX
    url = (
        f"{C.NEX_NCSS}/{path}?var={var}&north={b['north']}&south={b['south']}&west={b['west']}&east={b['east']}"
        "&horizStride=1&temporal=all&accept=netcdf4"
    )
    r = get(url, timeout=600)
    tmp = dest.with_suffix(".part")
    tmp.write_bytes(r.content)
    tmp.replace(dest)
    return "ok"


def main() -> int:
    NEX_DIR.mkdir(parents=True, exist_ok=True)
    models, jobs = plan()
    (NEX_DIR / "models.json").write_text(json.dumps({"models": models}, indent=1))
    print(f"{len(models)} models, {len(jobs)} files", flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(download, j): j for j in jobs}
        for f in as_completed(futs):
            done += 1
            try:
                f.result()
            except Exception as e:  # noqa: BLE001
                print("FAILED", futs[f][:4], e, flush=True)
            if done % 50 == 0:
                print(f"{done}/{len(jobs)}", flush=True)
    print("finished", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
