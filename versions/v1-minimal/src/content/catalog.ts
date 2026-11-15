// Closed catalog of NASA variables for detective mode. The assistant (SI or rules) may only pick from here.
export type Topic = "heat" | "cold" | "rain" | "drought" | "wind" | "sun" | "humidity" | "soil" | "snow";

export interface VarIndicator {
  key: string;
  label: string;
  unit?: string; // overrides the variable unit (counts)
}
export interface CatalogVar {
  param: string;
  name: string;
  def: string;
  unitHint: string;
  source: string;
  resolution: string;
  since: number;
  topics: Topic[];
  indicators: VarIndicator[];
  processes: string;
}

export const TOPICS: { id: Topic; label: string; icon: string }[] = [
  { id: "heat", label: "Heat", icon: "🔥" },
  { id: "cold", label: "Cold", icon: "❄️" },
  { id: "rain", label: "Rain", icon: "🌧️" },
  { id: "drought", label: "Drought", icon: "🏜️" },
  { id: "wind", label: "Wind", icon: "💨" },
  { id: "sun", label: "Sunshine", icon: "☀️" },
  { id: "humidity", label: "Humidity", icon: "💧" },
  { id: "soil", label: "Soil moisture", icon: "🌱" },
  { id: "snow", label: "Snow", icon: "🏔️" },
];

const MERRA = "NASA POWER ← MERRA-2 reanalysis (NASA GMAO)";
export const CATALOG: CatalogVar[] = [
  { param: "T2M_MAX", name: "Daily maximum temperature", def: "The highest air temperature of each day, 2 m above the ground.", unitHint: "°C", source: MERRA, resolution: "0.5° × 0.625° (~50 km), daily", since: 1981, topics: ["heat"],
    indicators: [{ key: "mean", label: "Average daily maximum" }, { key: "max", label: "Hottest day" }, { key: "ge:30", label: "Days ≥ 30 °C", unit: "days" }, { key: "ge:35", label: "Days ≥ 35 °C", unit: "days" }],
    processes: "Greenhouse warming raises the whole temperature distribution; drier soils (less evaporative cooling) and persistent high-pressure ridges amplify the hottest days; cities add an urban heat island." },
  { param: "T2M_MIN", name: "Daily minimum temperature", def: "The lowest air temperature of each day, usually just before sunrise.", unitHint: "°C", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["cold", "heat"],
    indicators: [{ key: "mean", label: "Average daily minimum" }, { key: "min", label: "Coldest night" }, { key: "lt:0", label: "Frost days (< 0 °C)", unit: "days" }, { key: "ge:20", label: "Tropical nights (≥ 20 °C)", unit: "nights" }],
    processes: "Night-time temperatures respond to greenhouse gases, humidity and cloud cover; less snow and ice cover reduces frost; urbanisation keeps nights warm." },
  { param: "T2M", name: "Daily mean temperature", def: "The average air temperature of each day.", unitHint: "°C", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["heat", "cold"],
    indicators: [{ key: "mean", label: "Average temperature" }], processes: "The most direct fingerprint of the planet's energy imbalance; regional rates differ with land/sea contrast, snow and soil moisture feedbacks." },
  { param: "PRECTOTCORR", name: "Precipitation", def: "Rain and snow reaching the ground each day (bias-corrected).", unitHint: "mm/day", source: "NASA POWER ← MERRA-2 (bias-corrected precipitation)", resolution: "~50 km, daily", since: 1981, topics: ["rain", "drought"],
    indicators: [{ key: "sum", label: "Total precipitation", unit: "mm" }, { key: "ge:20", label: "Heavy-rain days (≥ 20 mm)", unit: "days" }, { key: "drymax", label: "Longest dry spell (< 1 mm)", unit: "days" }],
    processes: "Warmer air holds ~7% more water per °C, intensifying heavy rain; shifts of the storm tracks and of the subtropical dry belts make some regions wetter and others drier — the same process, opposite trends." },
  { param: "RH2M", name: "Relative humidity", def: "How close the air is to saturation (100% = saturated).", unitHint: "%", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["humidity", "drought"],
    indicators: [{ key: "mean", label: "Average relative humidity" }], processes: "Over land, warming tends to outpace the moisture supply, so relative humidity often falls even when the absolute moisture rises." },
  { param: "QV2M", name: "Specific humidity", def: "The actual amount of water vapour in the air (grams per kilogram of air).", unitHint: "g/kg", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["humidity"],
    indicators: [{ key: "mean", label: "Average specific humidity" }], processes: "Warmer oceans and air hold more vapour (Clausius-Clapeyron), so absolute humidity tends to rise." },
  { param: "WS2M", name: "Wind speed (2 m)", def: "Average wind speed near the ground.", unitHint: "m/s", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["wind"],
    indicators: [{ key: "mean", label: "Average wind speed" }, { key: "max", label: "Windiest day" }], processes: "Surface winds respond to changes in pressure patterns and to land-surface roughness (e.g. vegetation growth, 'global stilling')." },
  { param: "ALLSKY_SFC_SW_DWN", name: "Sunshine at the surface", def: "Solar energy reaching the ground each day, including the effect of clouds and aerosols.", unitHint: "energy/m²/day", source: "NASA POWER ← GEWEX SRB and CERES (NASA satellites)", resolution: "~1° → 0.5°, daily", since: 1984, topics: ["sun"],
    indicators: [{ key: "mean", label: "Average daily solar energy" }], processes: "Changes in cloud cover and in air pollution (aerosols) change how much sunlight reaches the ground ('dimming' and 'brightening')." },
  { param: "CLOUD_AMT", name: "Cloud amount", def: "Share of the sky covered by cloud.", unitHint: "%", source: "NASA POWER ← CERES / ISCCP", resolution: "~1°, daily", since: 1984, topics: ["sun", "rain"],
    indicators: [{ key: "mean", label: "Average cloud amount" }], processes: "Cloud cover shifts with storm tracks and circulation changes; it also feeds back on temperature." },
  { param: "GWETROOT", name: "Root-zone soil wetness", def: "How wet the soil is where plant roots live (0 = completely dry, 1 = saturated).", unitHint: "0–1", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["soil", "drought"],
    indicators: [{ key: "mean", label: "Average root-zone wetness" }], processes: "Soil moisture integrates rain minus evaporation: warming increases evaporative demand, drying soils even where rainfall is unchanged." },
  { param: "EVLAND", name: "Evaporation from land", def: "Water evaporated from soil and transpired by plants each day.", unitHint: "mm/day", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["drought", "soil"],
    indicators: [{ key: "sum", label: "Total evaporation", unit: "mm" }], processes: "Evaporation rises with temperature and sunshine if water is available; it falls when soils run dry — another case of opposite trends from the same warming." },
  { param: "SNODP", name: "Snow depth", def: "Depth of snow on the ground.", unitHint: "cm", source: MERRA, resolution: "~50 km, daily", since: 1981, topics: ["snow", "cold"],
    indicators: [{ key: "gt:1", label: "Days with snow cover (> 1 cm)", unit: "days" }], processes: "Warmer winters turn snow into rain and melt it earlier; higher, colder places can still get more snow from wetter air." },
];

export const REGION_TYPES: { id: string; label: string; example: string; suggest: string[]; why: string }[] = [
  { id: "desert", label: "Desert", example: "sahara", suggest: ["T2M_MAX", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"], why: "Deserts are dominated by extreme daytime heat and rare rain; tiny changes in rainfall matter." },
  { id: "rainforest", label: "Rain forest", example: "amazon", suggest: ["PRECTOTCORR", "GWETROOT", "T2M_MAX"], why: "Rain forests depend on abundant rain and moist soils; droughts and heat stress are early warning signs." },
  { id: "estuary", label: "Tidal estuary", example: "chesapeake", suggest: ["PRECTOTCORR", "T2M", "QV2M"], why: "Estuaries respond to river inflow (rain upstream) and to warming air over the water." },
  { id: "city", label: "Big city", example: "delhi", suggest: ["T2M_MIN", "T2M_MAX", "RH2M"], why: "Cities trap heat at night (urban heat island): watch warm nights and humid heat." },
  { id: "mountains", label: "Mountains", example: "alps", suggest: ["SNODP", "T2M", "T2M_MIN"], why: "Mountains are sensitive to warming through snow cover and freezing days." },
  { id: "coast", label: "Coast", example: "lisbon", suggest: ["PRECTOTCORR", "T2M_MAX", "WS2M"], why: "Coasts feel heavy rain, sea breezes and heatwaves moderated by the ocean." },
  { id: "polar", label: "Polar region", example: "svalbard", suggest: ["T2M", "T2M_MIN", "SNODP"], why: "The Arctic warms several times faster than the global average." },
];

export const varByParam = (p: string) => CATALOG.find((v) => v.param === p);
