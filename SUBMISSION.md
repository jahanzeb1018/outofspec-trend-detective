# Space Apps 2026 submission — Orbitrack (Team MJM)

The texts and links submitted on the NASA Space Apps project form, kept here so the repository matches the submission.

## Project name
**Orbitrack**

## Summary
Orbitrack is a web app that detects Earth system trends along Spain's 13,426 km railway, a network built for a climate that no longer exists. It combines 45 years of daily NASA POWER data (MERRA-2 and CERES) for the 159 grid cells along the track with railway engineering: air temperature, sun and wind become rail temperature, checked against US FRA buckling limits, plus frost and rain limits. For every area it shows what is changing, where and how fast, and tests whether the trend is real (Sen's slope, Mann-Kendall with false-discovery control). Near Seville, days above 40 °C rose from about 12 a year in the 1980s to 26 today (p = 0.0008). Six NASA NEX-GDDP-CMIP6 climate models project 2050: with intermediate emissions, 2,930 km of track will have ten or more days a year above 40 °C, 11 times more than in 1995-2014. Users explore every month since 1981, a 7-day heat watch, any trip date and a track lab. NASA data match 10 Spanish weather stations (r = 0.97), and 40% of 262 US buckled-track derailments happened on the hottest 10% of days. Orbitrack helps rail managers find exposed sections, plan maintenance and adapt to a hotter climate. Try it live: https://orbitrack-app.vercel.app

## Project links
* **Project demonstration:** 6-slide deck (PDF, public link on the form).
* **Project:** https://orbitrack-app.vercel.app (previous link, still working: https://outofspec-trend-detective.vercel.app)
* **Code, data and docs:** https://github.com/jahanzeb1018/outofspec-trend-detective

## Project details

**What it does.** Orbitrack is an Earth system trend detective for Spain's railway. For all 13,426 km of track it answers four questions: what is changing, where, how fast, and is the change real? It turns heat, frost and heavy rain into what matters for the track, month by month since 1981 and into 2050 and 2090.

**How it works.**
1. NASA data: daily NASA POWER data (MERRA-2 meteorology, CERES radiation) from 1 January 1981 to today, for the 159 NASA grid cells (~50 km) the railway crosses.
2. Railway: 13,426 km of operational track from OpenStreetMap, cut into 4,831 pieces; each piece takes the weather of its cell.
3. Engineering: air temperature, sunshine and wind become rail temperature (rail = air + 17 °C × sun × wind, at most +25 °C), compared with US FRA buckling limits for just-repaired (~60 °C), standard (~74 °C) and modern (~82 °C) track. In the cold, the pull on welded rail (18.56 kN per °C below its laying temperature) is compared with a rail-break reference (~−10 °C). 50 mm of rain in one day flags a washout risk.
4. Statistics: for every cell, the rate of change (Sen's slope with its 95% range) and whether it is real (Mann-Kendall with the Hamed–Rao correction, t-test, and Benjamini–Hochberg false-discovery control across the 159 cells). Near Seville, days above 40 °C rose from about 12 a year in the 1980s to 26 today (+4.1 days per decade, p = 0.0008).
5. Future: six NASA NEX-GDDP-CMIP6 climate models, intermediate (SSP2-4.5) and high (SSP5-8.5) emissions, for 2041–2060 and 2081–2100, applied to real NASA days with the delta method.
6. Validation: NASA vs 10 NOAA weather stations in Spain (daily r 0.95–0.99, median gap −0.4 °C). 262 real US buckled-track derailments (FRA, 2011–2025): 40% happened on the hottest 10% of days for that place, four times what chance would give. Climate-model trends checked against observations for 1981–2014.

The Python pipeline exports static data; the website recomputes the same statistics in the browser, and both versions are tested against each other.

**What you can do.**
* Overview: the whole network month by month since 1981, with markers where the track was in trouble. Click a line to see the track drawn, a danger meter for each track type and "Is the trend real?".
* Heat watch: the 7-day forecast (Open-Meteo) compared with 45 years of NASA history for each place, plus replays of past heatwaves.
* My trip: any of 24 routes on any date from 1981 to 2100 (measured, forecast or projected climate).
* Track lab: heat the rail and watch it buckle; cool it and watch the pull.
* 2050: by 2050, 2,930 km of track with 10+ days a year above 40 °C, 11 times more than in 1995–2014. "Older lines, hotter places": the Madrid–Sevilla line had about 4 such days a year when it opened in 1992, 12 today and about 20 by 2050.
* How it works: a narrated animation from satellite to screen. Plus Methods, Expert details, open data downloads, and a Manager mode where rail companies upload their own track data, processed only in their browser.

**Benefits and impact.** Infrastructure managers can find exposed sections, prioritise inspections, avoid risky maintenance before heatwaves, and plan rail laying temperatures and upgrades. Operators get an early heat watch. Planners see which lines were built for a climate that no longer exists. Students and travellers learn how a climate trend is detected and tested. Orbitrack is a first screening tool, not an operational alert, and the method works for any railway in OpenStreetMap.

**Creativity.** We translate air temperature into rail temperature, the number that actually matters for the track, and show it as a drawn track that bends. Every place answers "Is the trend real?" with a statistical test. A single date picker joins the past, the forecast and the future.

**Tools.** Python (NumPy, pandas, SciPy, xarray, GeoPandas, pyMannKendall, pytest); TypeScript, React, Vite, MapLibre GL, D3, Vitest; Vercel. Optional assistant: Anthropic Claude, which only explains numbers computed by our pipeline.

**Factors we considered.** Scientific honesty (significance testing, false-discovery control, and "not significant yet" is shown), uncertainty (±4 °C rail model, model ranges), limitations (~50 km cells, US track parameters, neutral temperatures are not public, scenarios are not forecasts), plain language and accessibility (data tables under charts, mobile layout), privacy (Manager mode stays on the device) and openness (open data and MIT-licensed code).

## Use of Super Intelligence (SI)
Anthropic's Claude helped write and review code, process data and edit wording; the idea, design, scientific choices and checks are ours. Every number is computed by our open pipeline from NASA data. The optional in-app assistant (Claude) only explains those numbers and its answers are labelled; a rule-based mode works without it. The cover visual and one rail image in our slides are SI-generated and carry a visible "AI-generated visual" label. Details: `SI_DISCLOSURE.md`.

## NASA data
| Resource | Link |
|---|---|
| NASA POWER Daily API (MERRA-2 meteorology, CERES radiation) | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ |
| NASA POWER Project | https://power.larc.nasa.gov/ |
| MERRA-2 Reanalysis (NASA GMAO) | https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/ |
| CERES (NASA Langley) | https://ceres.larc.nasa.gov/ |
| NASA NEX-GDDP-CMIP6 Climate Projections | https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6 |
| NEX-GDDP-CMIP6 Data Access (NCCS THREDDS) | https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/catalog.html |

## Space agency partner and other data
| Resource | Link |
|---|---|
| OpenStreetMap railway network (© OpenStreetMap contributors, ODbL) | https://www.openstreetmap.org/copyright |
| NOAA GHCN-Daily weather stations (validation) | https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily |
| US FRA Rail Accident/Incident Data, Form 54 (validation) | https://data.transportation.gov/Railroads/Rail-Equipment-Accident-Incident-Data-Form-54-/85tf-25kj |
| FRA report: Track Buckling Prevention (Kish, Samavedam & Al-Nazer 2013) | https://railroads.dot.gov/elibrary/track-buckling-prevention-theory-safety-concepts-and-applications |
| Open-Meteo weather forecast API (CC BY 4.0) | https://open-meteo.com/ |
| Natural Earth map data | https://www.naturalearthdata.com/ |
| MapLibre GL JS | https://maplibre.org/ |
| React | https://react.dev/ |
| D3 | https://d3js.org/ |
| Vite | https://vite.dev/ |
| pyMannKendall | https://github.com/mmhs013/pyMannKendall |
| Geist font (Google Fonts) | https://fonts.google.com/specimen/Geist |
| Lucide icons | https://lucide.dev/ |
| Anthropic Claude (SI: code, data processing, wording; in-app assistant) | https://www.anthropic.com/claude |

Papers: Sen 1968; Hamed & Rao 1998; Benjamini & Hochberg 1995; Wilks 2016; Hirsch et al. 1982; Gelaro et al. 2017; Thrasher et al. 2022; Kish & Samavedam 2013 (FRA); full list in the app's Methods page.

## Pitch
Six slides in three minutes (cover, the problem, how it works, the app with a 42-second live demo video, validation and impact, the team).
