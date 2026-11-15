# Submission drafts (English) — to be reviewed and completed by the team

> Fill every ⚠️ before submitting. Submit with hours of margin; test every link in a private window.

## 1. Project name
⚠️ Team decision (working name: **OutOfSpec**). Change it in `web/src/config.ts`, `web/index.html` and `README.md`.

## 2. High-level project summary
[Name] is a data-detective tool that finds where Earth's climate is trending away from what our infrastructure was designed for. Anyone can pick a NASA variable and a place and get a 45-year time series with its rate of change and statistical significance (Sen's slope with confidence interval, Mann-Kendall with autocorrelation correction, t-test, and false-discovery correction for maps). Our flagship case is Spain's 13,000-km railway network: using NASA POWER/MERRA-2 we map where days above 40 °C are rising and frost is falling, show what that means for your trip, estimate rail temperature, compute an FRA-based thermal safety margin under user-defined track assumptions, and project it to 2050 and 2100 with NASA NEX-GDDP-CMIP6. We validated the data against weather stations and the heat signal against 262 real buckled-track derailments.

## 3. Link to project demo
⚠️ 30-second video (YouTube/Drive, public) or ≤ 7 slides.

## 4. Link to final project
⚠️ GitHub Pages URL + repository URL.

## 5. Detailed description (outline)
1. **What it does** — Detective mode for any place on Earth; Railways explorer (Now / Trend / Future, FDR before/after); My trip; Does it hold? (FRA buckling lab); The network in 2050; Methods; Manager mode; optional SI assistant.
2. **How it works** — Python pipeline (NASA POWER per MERRA-2 cell, NEX-GDDP-CMIP6 through the NCCS subset service, OpenStreetMap network, NOAA stations, FRA accidents) → indicators → statistics → models → JSON → static React site. The same statistics run in the browser (parity-tested).
3. **Benefits** — students learn to detect and test trends; travellers see their journey; infrastructure managers get a ready-to-use screening tool that accepts their internal data locally.
4. **Validation** — 10 NOAA GHCN-Daily stations (daily r 0.95–0.99), climate models vs observations 1981–2014, 262 FRA T109 derailments (40% above the local 90th percentile of max temperature), Giovanni workflow.
5. **Limitations** — ~50 km cells; rail temperature estimated (±4 °C); US FRA parameters; neutral temperatures are not public; scenarios not forecasts.
6. **Tools** — Python (numpy, pandas, scipy, xarray, geopandas, shapely, pymannkendall), TypeScript, React, Vite, MapLibre GL, d3, Vitest, pytest; optional Anthropic Claude API.
7. **Future** — managers' real data, free routing, other countries via OSM, roads and airports.

## 6. Use of Super Intelligence (SI) — honest template ⚠️ complete with what really happened
SI tools ([name them, e.g. Anthropic Claude]) were used for: [literature search and fact-checking support] · [drafting the technical specification and documentation] · [writing and reviewing code] · [copy editing]. [Describe any other use accurately.] All numbers in the app are computed by our open pipeline from NASA data and published model parameters. The optional in-app assistant only selects options from a closed catalog and explains engine numbers; its outputs are labelled "SI-assisted" and a rule-based mode works without it. No SI-generated images or video [⚠️ if any are used, they carry a visible watermark].

## 7. NASA data
* NASA POWER daily API — MERRA-2 (GMAO) meteorology, GEWEX SRB/CERES radiation — https://power.larc.nasa.gov/
* NASA NEX-GDDP-CMIP6 — https://www.nccs.nasa.gov/?p=4728 (accessed through https://ds.nccs.nasa.gov/thredds/)
* MERRA-2 — Gelaro et al. 2017
* NASA Giovanni (cross-check workflow) — https://giovanni.gsfc.nasa.gov/

## 8. Space agency partner data and other references
* Partner resource from the challenge: KNMI Climate Explorer (not used in the final numbers) ⚠️ remove if not used.
* NOAA GHCN-Daily / Climate Data Online; FRA Form 54 accident data; OpenStreetMap (ODbL); Natural Earth.
* Papers: Sen 1968; Hamed & Rao 1998; Benjamini & Hochberg 1995; Wilks 2016; Hirsch et al. 1982; Gelaro et al. 2017; Thrasher et al. 2022; Kish & Samavedam 2013 (FRA); Sensors 21(13):4606 (2021); Bastin et al. 2019; ETRR 2025; Accident Analysis & Prevention 2026; Público 2022; Cátedra Adif-UPM 2024.
* Libraries: see `web/package.json` and `pipeline/requirements.txt`.

## 9. Video (≤ 30 s)
| s | Image | Voice / caption |
|---|---|---|
| 0–2 | Team + challenge | "Trend Detective — is our railway out of date?" |
| 2–5 | Home map turning red 1981 → 2081 | Title + tagline |
| 5–13 | Click Sevilla: past + future chart, FDR stippling | "45 years of NASA data: real, significant change" |
| 13–23 | Lab: slider to “recently tamped”, the track bends; neutral-temperature window | "What it means for the track — today and in 2050" |
| 23–28 | Ask the detective turns a question into a map | "Any place, any NASA variable" |
| 28–30 | Tagline | — |

## 10. Seven slides
1. Title + tagline · 2. The problem (welded rail tuned to a local climate) · 3. NASA data used · 4. Method (with FDR before/after) · 5. Demo screenshots · 6. Validation + impact · 7. Team and future.
