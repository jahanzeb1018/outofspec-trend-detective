# Orbitrack · Trend Detective

> NASA Space Apps Challenge 2026 · **“Be An Earth System Trend Detective!”**
> *Railways built for a climate that no longer exists.* (The name and tagline live in `web/src/config.ts`; the logo in `web/src/components/Logo.tsx` and `web/public/favicon.svg`.)

A data-detective tool that finds **what is changing, where, how fast and whether it is real** in NASA Earth data, for any place on Earth. Spain's railway network is the flagship case: heat days rising in the south, frost days falling in the north, what that means for the track (an FRA-based buckling safety margin), for your trip, and for 2050 and 2100.

## What is inside

| Module | What it does | Challenge objective |
|---|---|---|
| **Overview** (`/`) | One animated map, month by month from 1981 to the latest available day (NASA POWER daily; the current year from POWER near-real-time GEOS-IT data, `pipeline/fetch_recent.py` + `pipeline/monthly.py`): lines coloured by the month's typical afternoon temperature; pulsing markers where the track was in trouble — rail above 60 °C (heat), −7 °C or colder (severe frost), 50 mm or more in a day (downpour) — with km counters; then a typical year in 2050 and 2090 (NEX-GDDP-CMIP6 deltas). Click a line: the track is drawn in perspective for heat (sun kink), cold (frost, snapped rail) or rain (washout), following the month shown on the map, with a danger meter per track condition (low / moderate / high / very high), and records since 1981; the panel ends with **Is the trend real?** (that area's 1981–2025 series with Sen's slope per decade, Mann-Kendall with the Hamed–Rao correction and the t-test, or "not significant yet"). Below it, **And in the future?**: an animated bar chart of days a year at 40 °C or more for 12 cities (all 47 areas on demand) in the 1980s, today, 2050 and 2090 (NASA POWER measured; median of the NEX-GDDP-CMIP6 models, SSP2-4.5); click a city for its four values, the model range and a three-line method note | Objectives 1–4, opposite trends, storytelling |
| **Heat watch** (`/watch`) | Live: 7-day forecast (Open-Meteo) for every NASA cell vs. that cell's 1981–2025 NASA climatology for the month, plus the rail model → *heat/cold watch & warning* (physically relevant) or *unusually warm/cold* (season only); replays of the three hottest network days in the NASA record. Same layout as the home: one map with the day (or the heatwave) in big type, km counters and a bottom bar to pick or play the days; the selected area opens in a column beside the map (drawn track, rail and air temperature, one sentence, “Explain it”), with the five places to watch | Impact, storytelling |
| **My trip** (`/trip`) | 24 routes and one date, 1981–2100 (`pipeline/trip_data.py`). Up to the last NASA POWER day: what was measured that day along the line (hottest rail, coldest night, rain; `daily/`); the next 7 days: the forecast; later: the climate of that date in that year (`clim/`), blended linearly between today's measured climate (2016–2025), 2050 and 2090 (1995–2014 NASA days + median NEX-GDDP-CMIP6 monthly change, SSP2-4.5), typical and 1-in-10 day. Profile along the route with track limits, drawn track, verdict per track type, and how we know | Demonstration example |
| **Track lab** (`/lab`) | The two formulas as an experiment. Heat: air temperature, sun and wind → rail temperature (rail = air + 17 °C × sun × wind, at most +25 °C) against the FRA buckling limits of just-repaired, typical and modern track (Kish, Samavedam & Al-Nazer 2013); the drawn track kinks past the limit. Cold: coldest night → pull on welded rail (18.56 kN per °C below the laying temperature, UIC60) against the rail-break reference. Opened from the home panel with that place's values | Impact, storytelling |
| **2050** (`/network`) | 2050 only: the year in big type, one sentence (km of track with 10+ days a year at 40 °C, ×11 vs 1995–2014) and heat stripes, one per year 1981–2025 (NASA) plus a typical 2050 year (NEX-GDDP-CMIP6), with an emissions switch; **Older lines, hotter places?** (full width, follows the period and scenario): every high-speed line by opening year, from the days at 40 °C of the climate it was built for (ten years before opening, NASA POWER) to those it will face (NEX-GDDP-CMIP6), size = km, conventional lines as reference; click a line for built → today → future bars; km by heat class 1981–2100; the ten fastest-warming sections as bars | Impact, storytelling |
| **How it works** (`/how`) | The journey of the data as a nine-scene animated film in the style of the drawn track (`pipeline/journey_geo.py` → `src/content/journeyGeo.ts`): satellites and ground readings → MERRA-2 and NASA POWER → 159 grid squares, 1981–today → 13,426 km of OpenStreetMap track → rail temperature and FRA limits → trend tests (Seville, p = 0.0008) → NOAA and FRA validation → NEX-GDDP-CMIP6 delta method → the app; autoplay, chapters, sources per step | Storytelling, approach |
| **Methods** (`/methods`) | Data, statistics in two levels, models, validation (NOAA stations, models vs observations, FRA T109 derailments, Giovanni workflow), limitations, references, SI disclosure, downloads | Validity |
| **Manager mode** (`/manager`) | Upload your own track data (CSV), computed 100% in the browser, export results | “Ready to implement” |
| **Assistant** (top bar) | “Ask the detective”, “Explain this”, “Describe your track”: Claude with tools over a closed catalog, or rule-based without a key. Labelled *SI-assisted* | Optional SI suggestion |

Design: the light design is live at https://orbitrack-app.vercel.app (the old link https://outofspec-trend-detective.vercel.app still works). An alternative dark, story-based design was tried and set aside; its source is kept in `versions/v2-dark/` (copy its `src/` into `web/` to try it again).

## Quick start

```bash
cd web
npm ci
npm run dev        # http://localhost:5173
npm test           # 39+ tests: TS statistics/model parity with Python + detective aggregation
npm run build      # static site in web/dist (relative paths, works on GitHub Pages)
```

All data the site needs are already in `web/public/data/` (produced by the pipeline).

## Reproduce the data (no accounts needed)

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r pipeline/requirements.txt
python pipeline/run_all.py      # downloads are cached in pipeline/cache/
python -m pytest pipeline/tests
```

| Step | Source | Notes |
|---|---|---|
| `fetch_osm.py` | OpenStreetMap (Overpass) | operational `railway=rail` ways in Spain |
| `network.py` | – | removes parallel tracks, ~8 km sections, curvature, MERRA-2 cell, 24 routes (shortest paths on the OSM topology) |
| `fetch_power.py` | NASA POWER daily API | one request per MERRA-2 cell, 1981–2025 |
| `fetch_nex.py` + `nex_process.py` | NASA NEX-GDDP-CMIP6 via NCCS THREDDS subset service | 6 models, historical + SSP2-4.5 + SSP5-8.5, Spain box only (~1.6 GB) |
| `fetch_ghcn.py` | NOAA GHCN-Daily | 10 validation stations |
| `fra_t109.py` | FRA Form 54 (data.transportation.gov) | optional validation |
| `process.py` | – | everything else, exports JSON to `web/public/data/` |

The Giovanni cross-check needs a free NASA Earthdata login: see `pipeline/validate/giovanni_check.py`.

## Architecture

```
pipeline/            Python 3.12: download, process, test (pytest), export JSON
  config.py          every parameter (periods, thresholds, models, FRA tables, seeds)
  stats.py           Sen, Mann-Kendall (Hamed-Rao, conservative), OLS t-test, BH-FDR, years-needed
  climate.py         indicators + rail-temperature model
  buckling.py        FRA safety margin + Monte Carlo
web/                 React + Vite + TypeScript, MapLibre GL (no tile server), d3, Web Worker
  src/stats/         same algorithms in TypeScript (+ parity tests on golden files)
  src/model/         buckling model + worker
  src/detective/     live NASA POWER client + aggregation (+ parity test)
  src/ai/            SI assistant (Anthropic SDK, lazy-loaded) + rule-based fallback
proxy/               optional Cloudflare Worker that keeps the Anthropic key server-side
```

## SI assistant configuration

* **No key:** rule-based mode (always works, labelled “rule-based”).
* **Vercel (used for the public demo):** `web/api/claude/v1/messages.js` is a same-origin proxy; set `ANTHROPIC_API_KEY` in the Vercel project. It only accepts this site's origin, one model, capped `max_tokens` and ~15 requests/min per IP. `scripts/deploy.ps1` builds and deploys.
* **Local:** put `ANTHROPIC_API_KEY=...` in `web/.env.local` (git-ignored); `vite dev`/`vite preview` proxy `/api/claude` with it. Nothing is bundled.
* **Alternative:** `proxy/worker.js` (Cloudflare Workers), then build with `VITE_AI_PROXY_URL=https://<your-worker>.workers.dev`.

Model: `claude-opus-5-5` with server-side fallbacks; the assistant can only propose options from a closed catalog and read engine numbers through tools.

## Deploy

Live demo: https://orbitrack-app.vercel.app (also https://outofspec-trend-detective.vercel.app) — `scripts/deploy.ps1` (static build + `/api/claude` and `/api/forecast` functions). `.github/workflows/pages.yml` can also publish `web/dist` to GitHub Pages (the assistant then runs rule-based and the watch calls Open-Meteo directly). Test the public link in a private window.

## Licences

Code: MIT (`LICENSE`). Data: see `DATA_LICENSES.md` (NASA open data, OpenStreetMap ODbL, Natural Earth public domain, NOAA and FRA public domain, Open-Meteo CC BY 4.0). Not an official NASA product.

## Team to-do before submitting

* Optional: Giovanni cross-check (Earthdata login), deploy the AI proxy.
* Complete `SUBMISSION.md` (form texts, honest SI disclosure) and record the ≤ 30 s video.
