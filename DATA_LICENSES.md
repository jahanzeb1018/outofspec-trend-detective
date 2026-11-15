# Data sources, licences and attribution

| Data | Provider | Licence / terms | Attribution used in the app |
|---|---|---|---|
| NASA POWER daily (MERRA-2 meteorology; GEWEX SRB and CERES radiation) | NASA Langley Research Center, POWER Project | NASA open data | "These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program." ⚠️ check the exact wording on the POWER website before submitting |
| MERRA-2 | NASA Global Modeling and Assimilation Office | NASA open data | Gelaro et al. (2017), J. Climate 30, 5419–5454 |
| NEX-GDDP-CMIP6 | NASA Earth Exchange (NASA Ames), via NASA NCCS THREDDS | CC0-1.0 according to the Google Earth Engine catalogue entry (older pages state CC-BY-SA 4.0); cite Thrasher et al. (2022), Scientific Data 9, 262 | Methods page |
| GHCN-Daily (behind NOAA Climate Data Online) | NOAA NCEI | US public domain | Methods page |
| Rail Equipment Accident/Incident Data (Form 54) | US Federal Railroad Administration, data.transportation.gov | US public domain | Methods page (optional validation) |
| Railway network | OpenStreetMap contributors | ODbL 1.0 — attribution and share-alike for the derived database (`web/public/data/segments.geojson`, `routes.json`) | "© OpenStreetMap contributors (ODbL)" on every map |
| Countries and places | Natural Earth | Public domain | "Natural Earth" on maps |
| 7-day weather forecast (heat watch only) | Open-Meteo (api.open-meteo.com), free non-commercial API | CC BY 4.0 | "Open-Meteo forecast" in the footer and on the watch page; cached by `/api/forecast` for one hour |

The derived railway sections (`segments.geojson`) and routes (`routes.json`) are a derivative database of OpenStreetMap and are made available under the ODbL.

Literature values used by the models (FRA buckling tables, CWR-RISK distributions, rail-temperature offsets) are cited in the Methods page and in `pipeline/config.py`.
