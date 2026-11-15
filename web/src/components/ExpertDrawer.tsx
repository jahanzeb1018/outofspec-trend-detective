import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Microscope, X } from "lucide-react";
import { useFocus, type ExpertTab } from "../state/focus";
import { useCell, useJson, useSummary, useValidation } from "../data/load";
import { IND, fmt, signed } from "../config";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { Seg, Loading } from "./ui";
import type { WatchData } from "../model/watch";

/** Expert details: the technical numbers behind what the page shows for one place, each with a plain explanation.
 *  Opened from an "Expert details" button next to the place (overview panel, heat watch, my trip) or from the footer. */
const TABS: { id: ExpertTab; label: string; intro: string }[] = [
  { id: "stats", label: "Trend", intro: "Is the change real? The statistical tests behind the trend." },
  { id: "model", label: "Track", intro: "How hot the rail gets, and how much margin the track has before it buckles." },
  { id: "future", label: "Future", intro: "What six NASA climate models expect for this area." },
  { id: "validation", label: "Checks", intro: "How we checked NASA's numbers against the real world." },
  { id: "data", label: "Data", intro: "The files behind the app, and the full methods." },
];
const SCEN_PLAIN: Record<string, string> = { ssp245: "intermediate emissions", ssp585: "high emissions" };
const PER_PLAIN: Record<string, string> = { "2041-2060": "2050", "2081-2100": "2090" };

/** The button that opens Expert details for the place the page is showing (optionally on the indicator it shows). */
export function ExpertButton({ tab, indicator, children = "Expert details" }: { tab?: ExpertTab; indicator?: string; children?: ReactNode }) {
  const { focus, setFocus, openExpert } = useFocus();
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        if (indicator && indicator !== focus.indicator) setFocus({ ...focus, indicator });
        openExpert(tab);
      }}
    >
      <Microscope size={14} /> {children}
    </button>
  );
}

function Row({ k, v, plain }: { k: string; v: string; plain: string }) {
  return (
    <div className="kv">
      <div className="kv-top">
        <span className="k">{k}</span>
        <span className="v">{v}</span>
      </div>
      <p>{plain}</p>
    </div>
  );
}

/** "37.50_-5.625" → "37.5° N, 5.6° W" */
function coords(cellId: string) {
  const [la, lo] = cellId.split("_").map(Number);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return cellId;
  return `${fmt(Math.abs(la), 1)}° ${la >= 0 ? "N" : "S"}, ${fmt(Math.abs(lo), 1)}° ${lo >= 0 ? "E" : "W"}`;
}

export function ExpertDrawer() {
  const { focus, expert, closeExpert, setTab } = useFocus();
  const { data: cell } = useCell(expert.open ? focus.cellId : null);
  const { data: summary } = useSummary();
  const { data: val } = useValidation();
  const { data: wd } = useJson<WatchData>(expert.open ? "watch.json" : null);
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
  const unit = meta.unit.replace("/yr", "").trim();
  const isTemp = unit.includes("°C");
  const decPlain = (v: number) => (Math.abs(v) < 0.05 ? "practically no change" : `about ${fmt(Math.abs(v), 1)} ${unit} ${v > 0 ? (isTemp ? "higher" : "more") : isTemp ? "lower" : "fewer"} every ten years`);
  const real = t ? !t.rare && t.p_mk_hr < 0.05 : false;
  const tab = TABS.find((x) => x.id === expert.tab) ?? TABS[0];
  const laid = wd?.tn_typical ?? null;
  const limit = (k: "weak" | "average" | "strong") => (wd && laid !== null ? Math.round(laid + wd.allow[k]) : null);

  return (
    <>
      <div className="scrim" onClick={closeExpert} role="presentation" />
      <aside className="drawer" role="dialog" aria-label={`Expert details · ${focus.label ?? "Spain"}`}>
        <div className="head">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
            <div>
              <div className="eyebrow">
                <Microscope size={12} style={{ verticalAlign: -1, marginRight: 6 }} />
                EXPERT DETAILS
              </div>
              <h2 style={{ fontSize: 28, marginTop: 6 }}>{focus.label ?? "Spain"}</h2>
              <p className="small ink2" style={{ marginTop: 4 }}>
                The technical numbers behind what you see, each explained in plain words.
                {focus.cellId && <span className="muted"> NASA square at {coords(focus.cellId)}.</span>}
              </p>
            </div>
            <button className="btn" onClick={closeExpert} aria-label="Close expert details">
              <X size={16} />
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <Seg label="Expert sections" options={TABS} value={expert.tab} onChange={setTab} />
          </div>
        </div>
        <div className="body">
          <p className="xp-intro">{tab.intro}</p>

          {expert.tab === "stats" &&
            (!cell || !t ? (
              <Loading what="the statistics" />
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                <div className={`xp-verdict ${t.rare ? "rare" : real ? "yes" : "no"}`}>
                  <b>{t.rare ? "Too rare to test" : real ? "Real trend" : "Not significant yet"}</b>
                  <span>
                    {t.rare
                      ? `Too few such days here since ${cell.years[0]} to measure a trend.`
                      : real
                        ? `${meta.label}: ${decPlain(t.sen_slope * 10)} since ${cell.years[0]}.`
                        : `${meta.label}: ${decPlain(t.sen_slope * 10)}, but chance could still explain it.`}
                  </span>
                </div>
                <TimeSeriesChart
                  years={cell.years}
                  values={cell.indicators[ind]}
                  unit={meta.unit}
                  label={meta.label}
                  decimals={meta.decimals}
                  height={200}
                  trend={t.rare ? null : { slope: t.sen_slope, lo: t.ci_low, hi: t.ci_high, pivotX: cell.years[0] + (t.n - 1) / 2, pivotY: t.sen_intercept + t.sen_slope * ((t.n - 1) / 2) }}
                  future={cs?.fut ?? null}
                />
                <div>
                  <Row k="Rate of change (Sen's slope)" v={`${signed(t.sen_slope * 10, 2)} per decade`} plain={`${decPlain(t.sen_slope * 10)}. A robust rate: one extreme year cannot drag it around.`} />
                  <Row k="Likely range (95%)" v={`${signed(t.ci_low * 10, 2)} to ${signed(t.ci_high * 10, 2)}`} plain={t.ci_low > 0 || t.ci_high < 0 ? "The whole range points the same way, so the direction of change is clear." : "The range includes zero, so the direction is not certain yet."} />
                  <Row k="Could it be chance? (Mann-Kendall p)" v={fmt(t.p_mk_hr, 4)} plain={t.p_mk_hr < 0.001 ? "A steady change like this would appear by chance less than once in 1,000 tries." : t.p_mk_hr < 0.05 ? `Chance alone would give this less than ${Math.ceil(t.p_mk_hr * 100)} times in 100.` : "Chance could easily produce a pattern like this."} />
                  <Row k={`Checked across all ${nTests} squares (FDR q)`} v={t.q !== null ? fmt(t.q, 4) : "–"} plain={t.sig_fdr ? `Still significant after allowing for testing ${nTests} places at once.` : `Not significant once we allow for testing ${nTests} places at once.`} />
                  <Row k="Classic straight-line test (t-test p)" v={`${signed(t.ols_slope * 10, 2)} · p ${fmt(t.p_ols, 4)}`} plain="The textbook test, shown for reference." />
                  <Row k="Years of data" v={String(t.n)} plain={t.years_needed ? `At this rate and with this much year-to-year noise, about ${t.years_needed} more years would be needed to be sure.` : "Complete years of NASA POWER daily data."} />
                </div>
              </div>
            ))}

          {expert.tab === "model" && (
            <div>
              <Row k="Rail temperature" v="air + up to 25 °C" plain="With full sun and a light breeze the rail runs about 17 °C above the air; more when calm, less with clouds or wind. Uncertainty about ±4 °C." />
              <Row
                k="Buckling limits"
                v={limit("weak") !== null ? `${limit("weak")} / ${limit("average")} / ${limit("strong")} °C` : "–"}
                plain={`Rail temperature at which the track can bend sideways: just-repaired / standard / modern track. Rails are laid stress-free at about ${laid !== null ? Math.round(laid) : 27} °C.`}
              />
              {cell && (
                <>
                  <Row
                    k="Margin on the hottest day · standard track"
                    v={`${signed(cell.buckling.average?.recent?.bsm_med, 1)} → ${signed(cell.buckling.average?.["ssp245|2041-2060"]?.bsm_med, 1)} °C`}
                    plain="Degrees left before buckling on the hottest day of a normal year: today → around 2050 (intermediate emissions). Below zero means no margin."
                  />
                  <Row
                    k="Days with no margin · just-repaired track"
                    v={`${fmt(cell.buckling.weak?.recent?.days_mean, 1)} → ${fmt(cell.buckling.weak?.["ssp245|2041-2060"]?.days_mean, 1)} a year`}
                    plain="Warm days a year when freshly repaired track would have no margin left: today → around 2050."
                  />
                  <Row
                    k="Lay the rail warmer by 2050"
                    v={`${signed(cell.rail.windows["ssp245|2041-2060"]?.heat?.med, 1)} °C (winter allows ${signed(cell.rail.windows["ssp245|2041-2060"]?.cold?.med, 1)})`}
                    plain="To keep today's margin, rails would need to be laid this much warmer; colder winters limit how far that can go."
                  />
                </>
              )}
              <p className="note" style={{ marginTop: 12 }}>
                Method: US Federal Railroad Administration (Kish &amp; Samavedam 2013), with thousands of random combinations of track condition and model error (Monte Carlo). A screening model, not a safety assessment.
              </p>
            </div>
          )}

          {expert.tab === "future" && (
            <div>
              <div className="small ink2" style={{ marginBottom: 6 }}>
                <b>{meta.label}</b> · reference 1995–2014: {cs ? `${fmt(cs.ref, meta.decimals)} ${meta.unit}` : "–"}
              </div>
              {cs?.fut ? (
                Object.entries(cs.fut).flatMap(([s, per]) =>
                  Object.entries(per).map(([p, e]) => (
                    <Row
                      key={s + p}
                      k={`${PER_PLAIN[p] ?? p} (${p.replace("-", "–")}) · ${SCEN_PLAIN[s] ?? s}`}
                      v={`${fmt(e[0], meta.decimals)} ${meta.unit}`}
                      plain={`Middle of the ${summary?.models.length ?? 6} models; they range from ${fmt(e[1], meta.decimals)} to ${fmt(e[2], meta.decimals)}.`}
                    />
                  )),
                )
              ) : (
                <Loading what="the projections" />
              )}
              <p className="note" style={{ marginTop: 12 }}>
                NASA NEX-GDDP-CMIP6{summary?.models.length ? ` (${summary.models.join(", ")})` : ""}: each model's monthly warming is added to real NASA days from 1995–2014 (delta method).
              </p>
            </div>
          )}

          {expert.tab === "validation" &&
            (val ? (
              <div>
                <Row
                  k="Weather stations (NOAA) · daily agreement"
                  v={`r ${fmt(Math.min(...val.stations.filter((s) => s.years >= 20).map((s) => s.daily_r)), 2)}–${fmt(Math.max(...val.stations.map((s) => s.daily_r)), 2)}`}
                  plain={`${val.stations.length} long-record stations in Spain against NASA at the same spot: the day-to-day temperature matches closely (1 would be perfect).`}
                />
                {val.fra_t109 && (
                  <Row
                    k="Real track buckles (US)"
                    v={`${val.fra_t109.with_coords} · ${fmt(100 * val.fra_t109.share_above_p90, 0)}% on the hottest days`}
                    plain={`${fmt(100 * val.fra_t109.share_above_p90, 0)}% of real US buckled-track derailments happened on days hotter than 9 in 10 summer days there; chance alone would give 10%.`}
                  />
                )}
                <Row k="Climate models vs observations" v="1981–2014" plain="Each model's past trend checked against NASA's record, square by square (chart in Methods)." />
                <Row k="NASA Giovanni" v="pending" plain="Cross-check ready; it needs a free NASA Earthdata login." />
              </div>
            ) : (
              <Loading />
            ))}

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
                    This square (JSON)
                  </a>
                )}
                <a className="btn" href="./data/summary.json" target="_blank" rel="noreferrer">
                  All squares (JSON)
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
