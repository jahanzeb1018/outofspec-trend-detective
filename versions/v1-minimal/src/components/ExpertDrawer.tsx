import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useFocus, type ExpertTab } from "../state/focus";
import { useCell, useSummary, useValidation } from "../data/load";
import { IND, SCENARIO_SHORT, fmt, signed } from "../config";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { Seg, Loading } from "./ui";
import { dtAllow, PRESET_FP } from "../model/buckling";

const TABS: { id: ExpertTab; label: string }[] = [
  { id: "stats", label: "Statistics" },
  { id: "model", label: "Track model" },
  { id: "future", label: "Projections" },
  { id: "validation", label: "Validation" },
  { id: "data", label: "Data" },
];

function Row({ k, v, plain }: { k: string; v: string; plain: string }) {
  return (
    <div className="kv">
      <div>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
      </div>
      <p>{plain}</p>
    </div>
  );
}

export function ExpertDrawer() {
  const { focus, expert, closeExpert, setTab } = useFocus();
  const { data: cell } = useCell(expert.open ? focus.cellId : null);
  const { data: summary } = useSummary();
  const { data: val } = useValidation();
  useEffect(() => {
    if (!expert.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeExpert();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expert.open, closeExpert]);
  if (!expert.open) return null;
  const ind = focus.indicator && IND[focus.indicator] ? focus.indicator : "HOT40";
  const meta = IND[ind];
  const t = cell?.trends[ind];
  const cs = focus.cellId && summary ? summary.cells[focus.cellId]?.[ind] : null;
  const nTests = summary ? Object.keys(summary.cells).length : 159;
  const decPlain = (v: number) => (Math.abs(v) < 0.05 ? "practically no change" : `${v > 0 ? "about" : "about"} ${fmt(Math.abs(v), 1)} ${meta.unit.replace("/yr", "")} ${v > 0 ? "more" : "fewer"} every ten years`);

  return (
    <>
      <div className="scrim" onClick={closeExpert} role="presentation" />
      <aside className="drawer" role="dialog" aria-label="Expert view">
        <div className="head">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="eyebrow">EXPERT VIEW · {focus.label ?? "Spain"} {focus.cellId ? `· NASA cell ${focus.cellId}` : ""}</div>
              <h2 style={{ fontSize: 28, marginTop: 6 }}>How we know</h2>
            </div>
            <button className="btn" onClick={closeExpert} aria-label="Close expert view">
              <X size={16} />
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <Seg label="Expert sections" options={TABS} value={expert.tab} onChange={setTab} />
          </div>
        </div>
        <div className="body">
          {expert.tab === "stats" &&
            (!cell || !t ? (
              <Loading what="the statistics" />
            ) : (
              <div className="stack" style={{ gap: 16 }}>
                <div className="small ink2">
                  {meta.label} · {cell.years[0]}–{cell.years[cell.years.length - 1]} · NASA POWER (MERRA-2)
                </div>
                <TimeSeriesChart
                  years={cell.years}
                  values={cell.indicators[ind]}
                  unit={meta.unit}
                  label={meta.label}
                  decimals={meta.decimals}
                  height={220}
                  trend={t.rare ? null : { slope: t.sen_slope, lo: t.ci_low, hi: t.ci_high, pivotX: cell.years[0] + (t.n - 1) / 2, pivotY: t.sen_intercept + t.sen_slope * ((t.n - 1) / 2) }}
                  future={cs?.fut ?? null}
                />
                <div>
                  <Row k="Sen's slope" v={`${signed(t.sen_slope * 10, 2)} / decade`} plain={`${decPlain(t.sen_slope * 10)} — a robust rate that one extreme year cannot drag around.`} />
                  <Row k="95% confidence interval" v={`${signed(t.ci_low * 10, 2)} to ${signed(t.ci_high * 10, 2)}`} plain={t.ci_low > 0 || t.ci_high < 0 ? "The whole range points the same way: the direction of change is clear." : "The range includes zero: the direction is not yet certain."} />
                  <Row k="Mann-Kendall p (Hamed–Rao)" v={fmt(t.p_mk_hr, 4)} plain={t.p_mk_hr < 0.001 ? "A steady change like this would appear by chance less than once in 1,000 tries." : t.p_mk_hr < 0.05 ? `Chance alone would give this less than ${Math.ceil(t.p_mk_hr * 100)} times in 100.` : "Chance could easily produce a pattern like this — not significant yet."} />
                  <Row k={`FDR q · ${nTests} cells`} v={t.q !== null ? fmt(t.q, 4) : "–"} plain={t.sig_fdr ? `Still significant after allowing for testing ${nTests} places at once.` : `Not significant once we allow for testing ${nTests} places at once.`} />
                  <Row k="OLS slope · t-test p" v={`${signed(t.ols_slope * 10, 2)} · ${fmt(t.p_ols, 4)}`} plain="The classic straight-line test, shown for reference." />
                  <Row k="Years (n)" v={String(t.n)} plain={t.years_needed ? `At this rate and noise, about ${t.years_needed} more years would be needed to detect it (approximate).` : "Complete years of NASA POWER daily data."} />
                </div>
              </div>
            ))}

          {expert.tab === "model" && (
            <div className="stack" style={{ gap: 4 }}>
              <p className="small ink2">Buckling safety margin from Kish &amp; Samavedam (2013), US Federal Railroad Administration, DOT/FRA/ORD-13/16. Rail temperature from NASA air temperature, sunshine and wind.</p>
              <Row k="Rail temperature" v="air + 17 °C × k" plain={`k scales with NASA sunshine and wind (anchored on hot days: ${fmt(summary?.meta.g_ref, 0)} W/m², ${fmt(summary?.meta.v_ref, 2)} m/s). Uncertainty ±4 °C.`} />
              <Row k="Allowable rise (FRA)" v={`${fmt(dtAllow(PRESET_FP.weak!), 1)} / ${fmt(dtAllow(PRESET_FP.average!), 1)} / ${fmt(dtAllow(PRESET_FP.strong!), 1)} °C`} plain="How far above its stress-free temperature the rail can go: weak (just repaired) / average / strong track." />
              {cell && (
                <>
                  <Row k="Margin now → 2041–60 (average)" v={`${signed(cell.buckling.average?.recent?.bsm_med, 1)} → ${signed(cell.buckling.average?.["ssp245|2041-2060"]?.bsm_med, 1)} °C`} plain="Typical track on the hottest day of a normal year, today and with intermediate emissions." />
                  <Row k="Days without margin (weak)" v={`${fmt(cell.buckling.weak?.recent?.days_mean, 1)} → ${fmt(cell.buckling.weak?.["ssp245|2041-2060"]?.days_mean, 1)} / yr`} plain="If the track had just been repaired: warm-season days with no thermal margin left." />
                  <Row k="Neutral-temperature window" v={`heat ${signed(cell.rail.windows["ssp245|2041-2060"]?.heat?.med, 1)} · cold ${signed(cell.rail.windows["ssp245|2041-2060"]?.cold?.med, 1)} °C`} plain="Raising the rail's stress-free temperature by the heat number keeps today's margin; winter cold only allows the cold number." />
                </>
              )}
              <p className="note" style={{ marginTop: 10 }}>Monte Carlo over neutral temperature, lateral resistance and rail-model error (CWR-RISK “Case A” distributions). US track parameters; a screening model, not a safety assessment.</p>
            </div>
          )}

          {expert.tab === "future" && (
            <div className="stack" style={{ gap: 4 }}>
              <p className="small ink2">NASA NEX-GDDP-CMIP6 · {summary?.models.length ?? 0} models ({summary?.models.join(", ")}) · monthly change added to observed 1995–2014 days (delta method).</p>
              {cs?.fut &&
                Object.entries(cs.fut).flatMap(([s, per]) =>
                  Object.entries(per).map(([p, e]) => <Row key={s + p} k={`${p} · ${SCENARIO_SHORT[s]}`} v={`${fmt(e[0], meta.decimals)} ${meta.unit}`} plain={`Median of the models; range ${fmt(e[1], meta.decimals)}–${fmt(e[2], meta.decimals)}. Reference 1995–2014: ${fmt(cs.ref, meta.decimals)}.`} />),
                )}
            </div>
          )}

          {expert.tab === "validation" && (
            <div className="stack" style={{ gap: 4 }}>
              {val ? (
                <>
                  <Row k="NOAA stations · daily r" v={`${fmt(Math.min(...val.stations.filter((s) => s.years >= 20).map((s) => s.daily_r)), 2)}–${fmt(Math.max(...val.stations.map((s) => s.daily_r)), 2)}`} plain={`${val.stations.length} long-record weather stations (GHCN-Daily) vs NASA POWER at the same point: the day-to-day weather matches closely.`} />
                  {val.fra_t109 && (
                    <Row k="US buckled-track derailments" v={`${val.fra_t109.with_coords} · ${fmt(100 * val.fra_t109.share_above_p90, 0)}% > P90`} plain="Real FRA derailments (cause T109): 40% happened on days above the local 90th percentile of NASA heat — four times what chance would give." />
                  )}
                  <Row k="Models vs observations" v="1981–2014" plain="Climate-model trends checked against NASA MERRA-2 cell by cell (chart in Methods)." />
                  <Row k="NASA Giovanni" v="pending" plain="Cross-check workflow ready; needs a free Earthdata login." />
                </>
              ) : (
                <Loading />
              )}
            </div>
          )}

          {expert.tab === "data" && (
            <div className="stack" style={{ gap: 12 }}>
              {cell && (
                <p className="small ink2">
                  Source: {cell.provenance.source}. Parameters: {cell.provenance.parameters.join(", ")}. Retrieved {cell.provenance.retrieved_at}. Pipeline {cell.provenance.pipeline_version}.
                </p>
              )}
              <div className="row">
                {focus.cellId && (
                  <a className="btn" href={`./data/cells/${focus.cellId}.json`} target="_blank" rel="noreferrer">
                    This cell (JSON)
                  </a>
                )}
                <a className="btn" href="./data/summary.json" target="_blank" rel="noreferrer">
                  All cells (JSON)
                </a>
                <a className="btn" href="./data/segments.geojson" target="_blank" rel="noreferrer">
                  Railway sections (GeoJSON)
                </a>
              </div>
              <div className="row">
                <Link className="btn primary" to="/methods" onClick={closeExpert}>
                  Full methods &amp; references
                </Link>
                <Link className="btn" to="/manager" onClick={closeExpert}>
                  Manager mode: upload your track data
                </Link>
              </div>
              <p className="note">NASA POWER, NASA NEX-GDDP-CMIP6, NOAA GHCN-Daily, FRA Form 54, © OpenStreetMap contributors (ODbL), Natural Earth, Open-Meteo forecast (CC BY 4.0). Code MIT.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
