export type Ens = [number | null, number | null, number | null]; // median, min, max over models

export interface CellIndicatorSummary {
  now: number | null;
  ref: number | null;
  early: number | null;
  late: number | null;
  sen: number | null; // per decade
  lo: number | null;
  hi: number | null;
  p: number | null;
  q: number | null;
  raw: boolean;
  fdr: boolean;
  rare: boolean;
  fut?: Record<string, Record<string, Ens>>;
}
export type CellSummary = Record<string, CellIndicatorSummary> & { _bsm: Record<string, Record<string, [number | null, number | null]>> };

export interface Summary {
  indicators: string[];
  future_indicators: string[];
  scenarios: string[];
  periods: string[];
  models: string[];
  cells: Record<string, CellSummary>;
  meta: { years: [number, number]; now: [number, number]; ref: [number, number]; early: [number, number]; late: [number, number]; alpha: number; alpha_fdr: number; g_ref: number; v_ref: number; pipeline_version: string; generated: string };
}

export interface SegmentProps {
  id: string;
  n: string;
  t: "HSL" | "conventional" | "metric";
  g: number | null;
  e: 0 | 1;
  v: number | null;
  r: number | null;
  k: "tangent" | "medium" | "tight";
  c: string;
  L: number;
  y: number | null;
  yl: string | null;
  ys: string | null;
}

export interface TrendDetail {
  n: number;
  sen_slope: number;
  sen_intercept: number;
  ci_low: number;
  ci_high: number;
  mk_s: number;
  mk_var_s: number;
  mk_z: number;
  p_mk_hr: number;
  tau: number;
  ols_slope: number;
  p_ols: number;
  rare: boolean;
  sig_raw: boolean;
  sig_fdr: boolean;
  q: number | null;
  years_needed: number | null;
}

export interface SimSummary {
  days_mean: number;
  days_p10: number;
  days_p90: number;
  p_any: number;
  bsm_med: number;
  bsm_p10: number;
  bsm_p90: number;
  rail_am_med: number;
  days_mean_min?: number;
  days_mean_max?: number;
}

export interface CellDetail {
  cell_id: string;
  lat: number;
  lon: number;
  track_km: number;
  place: string;
  years: number[];
  indicators: Record<string, (number | null)[]>;
  trends: Record<string, TrendDetail>;
  future: Record<string, Record<string, Record<string, Record<string, number>>>>; // ind -> scen -> period -> model -> value
  rail: {
    season_months: number[];
    years: number[];
    daily_x10: number[][];
    deltas_tasmax: Record<string, Record<string, Record<string, number[]>>>; // model -> scen -> period -> 12
    windows: Record<string, { heat: { med: number; min: number; max: number } | null; cold: { med: number; min: number; max: number } | null }>;
    ref_am: number;
    tnn_ref: number;
  };
  buckling: Record<string, Record<string, SimSummary>>;
  doy: Record<string, Record<string, number[]>>;
  provenance: { source: string; product: string; parameters: string[]; api_url_template: string; retrieved_at: string; pipeline_version: string };
}

export interface Route {
  route_id: string;
  name: string;
  length_km: number;
  stations: { name: string; km: number }[];
  samples: { km: number; cell_id: string; segment_id: string }[];
  geometry: [number, number][];
}

export interface Network {
  headline: Record<string, number>;
  fdr_counts: Record<string, { tests: number; raw: number; fdr: number; raw_km: number; fdr_km: number }>;
  stacked: { classes: string[]; years: number[]; observed: number[][]; ref: number[]; future: Record<string, number[]> };
  analogs: Record<string, { from: string; to: string | null; d: number; ok: boolean; from_place: string; to_place: string | null }[]>;
  analog_threshold: number;
  analog_vars: string[];
  age: { line: string; year: number | null; source: string | null; km: number; d_hot40: number; d_rail_am: number }[];
  top10: { segment_id: string; line: string; cell_id: string; place: string; sen: number; lo: number; hi: number; early: number; late: number }[];
  nomargin_km: Record<string, Record<string, number>>;
  future_cards: Record<string, { km_hot40_gt10_ref: number; km_hot40_gt10: number; km_nomargin_average_ref: number; km_nomargin_average: number; frost_days_ref_kmw: number; frost_days_kmw: number; frost_change_pct: number; neutral_shift_median: number }>;
  tension_kn_per_degc: number;
}

export interface Validation {
  stations: {
    id: string; name: string; city: string; lat: number; lon: number; dist_km: number; days: number; years: number;
    daily_r: number; daily_bias: number; hot35_obs_mean: number | null; hot35_power_mean: number | null; hot35_r: number | null;
    txx_bias: number | null; hot35_sen_obs: number | null; hot35_sen_power: number | null;
    series: { years: number[]; hot35_obs: number[]; hot35_power: number[] };
  }[];
  hist_check: { cell_id: string; TXP95: { obs: number; model_med: number | null; model_min: number | null; model_max: number | null }; HOT35: { obs: number; model_med: number | null; model_min: number | null; model_max: number | null } }[];
  giovanni?: { cell_id: string; days: number; r: number; bias: number; mae: number }[];
  fra_t109?: { events: number; with_coords: number; percentiles: number[]; share_above_p90: number; share_above_p75: number; median_percentile: number; years: [number, number]; source: string; histogram: number[] };
}

export interface ExampleIndex { id: string; label: string; region_type: string; lat: number; lon: number }
export interface Place { n: string; c: string; lat: number; lon: number; p: number }
