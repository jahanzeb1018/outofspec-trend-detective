// Single place for the project name and indicator metadata.
export const APP_NAME = "Orbitrack";
export const APP_TAGLINE = "Railways built for a climate that no longer exists.";
export const DATA_BASE = "./data";
export const DATA_V: string = (import.meta.env.VITE_DATA_V as string | undefined) ?? "dev";
/** URL of a data file, versioned per build so a redeploy always serves fresh data. */
export const dataUrl = (path: string) => `${DATA_BASE}/${path}?v=${DATA_V}`;

export type IndicatorKind = "heat" | "cold" | "rain" | "temp-heat" | "temp-cold";
export interface IndicatorMeta {
  label: string;
  short: string;
  unit: string;
  kind: IndicatorKind;
  def: string;
  rail: string;
  decimals: number;
}

export const IND: Record<string, IndicatorMeta> = {
  HOT35: { label: "Days at or above 35 °C", short: "Days ≥35 °C", unit: "days/yr", kind: "heat", decimals: 1, def: "Number of days in a year when the maximum air temperature (2 m) reaches at least 35 °C.", rail: "With full sun, rails run ~14–19 °C hotter than the air, so 35 °C air means roughly 50–55 °C rail." },
  HOT38: { label: "Days at or above 38 °C", short: "Days ≥38 °C", unit: "days/yr", kind: "heat", decimals: 1, def: "Number of days in a year when the maximum air temperature reaches at least 38 °C.", rail: "38 °C air ≈ 52–57 °C rail on a sunny day." },
  HOT40: { label: "Days at or above 40 °C", short: "Days ≥40 °C", unit: "days/yr", kind: "heat", decimals: 1, def: "Number of days in a year when the maximum air temperature reaches at least 40 °C.", rail: "40 °C air ≈ 55–60 °C rail: the range where track engineers start to worry about buckling." },
  HOT42: { label: "Days at or above 42 °C", short: "Days ≥42 °C", unit: "days/yr", kind: "heat", decimals: 1, def: "Number of days in a year when the maximum air temperature reaches at least 42 °C.", rail: "Extreme heat: rails can approach 60 °C or more." },
  TXP95: { label: "Hot-day temperature (95th percentile)", short: "Hot-day temp.", unit: "°C", kind: "temp-heat", decimals: 1, def: "The daily maximum temperature exceeded on only 5% of the days of each year: a robust measure of how hot the hot days are.", rail: "A relative measure: it works even where 40 °C is never reached." },
  TXX: { label: "Hottest day of the year", short: "Hottest day", unit: "°C", kind: "temp-heat", decimals: 1, def: "The single highest daily maximum air temperature of each year.", rail: "The hottest day sets the highest rail temperature of the year." },
  HOTSPELL: { label: "Longest hot spell (≥38 °C)", short: "Hot spell", unit: "days", kind: "heat", decimals: 1, def: "The longest run of consecutive days with maximum temperature ≥ 38 °C in each year.", rail: "Long spells leave little time for inspection and repairs." },
  TN20: { label: "Tropical nights (min ≥ 20 °C)", short: "Tropical nights", unit: "nights/yr", kind: "heat", decimals: 1, def: "Nights when the minimum temperature stays at or above 20 °C.", rail: "Warm nights: the track does not cool down between hot days." },
  FROST: { label: "Frost days (min < 0 °C)", short: "Frost days", unit: "days/yr", kind: "cold", decimals: 1, def: "Days when the minimum temperature falls below 0 °C.", rail: "Cold puts the welded rail in tension: the risk is rail breaks, not buckling." },
  COLD5: { label: "Hard-frost days (min ≤ −5 °C)", short: "Hard frost", unit: "days/yr", kind: "cold", decimals: 1, def: "Days when the minimum temperature falls to −5 °C or lower.", rail: "Strong tension in the rail; rail breaks concentrate in winter." },
  ICE: { label: "Ice days (max < 0 °C)", short: "Ice days", unit: "days/yr", kind: "cold", decimals: 1, def: "Days when even the maximum temperature stays below 0 °C.", rail: "Persistent cold." },
  TNN: { label: "Coldest night of the year", short: "Coldest night", unit: "°C", kind: "temp-cold", decimals: 1, def: "The lowest daily minimum temperature of each year.", rail: "Sets the maximum tension of the year in welded rail." },
  R20: { label: "Heavy-rain days (≥ 20 mm)", short: "Heavy rain", unit: "days/yr", kind: "rain", decimals: 1, def: "Days with at least 20 mm of precipitation.", rail: "Heavy rain threatens embankments, cuttings and drainage." },
  RAIL_AM: { label: "Hottest estimated rail temperature", short: "Max rail temp.", unit: "°C", kind: "temp-heat", decimals: 1, def: "The highest daily rail temperature of each year, estimated from NASA air temperature, sunshine and wind (model in Methods).", rail: "The load side of the buckling equation." },
};

export const MAP_INDICATORS = ["HOT35", "HOT38", "HOT40", "HOT42", "TXP95", "TXX", "HOTSPELL", "TN20", "RAIL_AM", "FROST", "COLD5", "TNN", "R20"];
export const SCENARIO_LABEL: Record<string, string> = { ssp245: "SSP2-4.5 (intermediate)", ssp585: "SSP5-8.5 (high emissions)" };
export const SCENARIO_SHORT: Record<string, string> = { ssp245: "SSP2-4.5", ssp585: "SSP5-8.5" };
export const PERIODS = ["2041-2060", "2081-2100"] as const;

export function fmt(v: number | null | undefined, d = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function signed(v: number | null | undefined, d = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "–";
  return (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v), d);
}
