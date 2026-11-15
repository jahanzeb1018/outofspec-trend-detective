import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { WorldMap } from "../components/WorldMap";
import { TimeSeriesChart } from "../components/charts/TimeSeriesChart";
import { Loading, Metric, Prov, Sig, Term } from "../components/ui";
import { useAssistant } from "../ai/AssistantContext";
import { CATALOG, REGION_TYPES, TOPICS, varByParam, type Topic } from "../content/catalog";
import { trendSentence } from "../content/sentence";
import { useExamples, usePlaces, loadJson } from "../data/load";
import { aggregateVariable, SEASONS, type Season } from "../detective/aggregate";
import { fetchPowerDaily, FIRST_YEAR, LAST_YEAR, type PowerDaily } from "../detective/power";
import { trend, yearsNeeded } from "../stats/trend";
import { fmt, signed } from "../config";

interface ExampleDoc {
  id: string;
  label: string;
  region_type: string;
  lat: number;
  lon: number;
  years: number[];
  units: Record<string, string>;
  url: string;
  series: Record<string, Record<string, Record<Season, (number | null)[]>>>;
}

const SEASON_LABEL: Record<Season, string> = { annual: "Whole year", DJF: "Winter (Dec–Feb)", MAM: "Spring (Mar–May)", JJA: "Summer (Jun–Aug)", SON: "Autumn (Sep–Nov)" };

function Step({ n, title, children, tour }: { n: number; title: string; children: React.ReactNode; tour?: string }) {
  return (
    <div data-tour={tour} style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="mono small muted">0{n}</span>
        <h3>{title}</h3>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

export function DetectivePage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const topic = (sp.get("topic") as Topic | null) ?? null;
  const exampleId = sp.get("example");
  const lat = sp.get("lat") ? Number(sp.get("lat")) : null;
  const lon = sp.get("lon") ? Number(sp.get("lon")) : null;
  const placeName = sp.get("place");
  const param = sp.get("param");
  const season = (SEASONS.includes(sp.get("season") as Season) ? sp.get("season") : "annual") as Season;
  const from = Number(sp.get("from") ?? FIRST_YEAR);
  const to = Number(sp.get("to") ?? LAST_YEAR);
  const v = param ? varByParam(param) : null;
  const ind = sp.get("ind") && v?.indicators.some((i) => i.key === sp.get("ind")) ? sp.get("ind")! : v?.indicators[0]?.key ?? null;

  const { data: examples } = useExamples();
  const { data: places } = usePlaces();
  const assistant = useAssistant();
  const [q, setQ] = useState("");
  const [example, setExample] = useState<ExampleDoc | null>(null);
  const [live, setLive] = useState<PowerDaily | null>(null);
  const [status, setStatus] = useState<{ busy: boolean; error?: string }>({ busy: false });

  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    setExample(null);
    setLive(null);
    if (exampleId) {
      setStatus({ busy: true });
      loadJson<ExampleDoc>(`examples/${exampleId}.json`)
        .then((d) => alive && (setExample(d), setStatus({ busy: false })))
        .catch(() => alive && setStatus({ busy: false, error: "This example could not be loaded" }));
    } else if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
      setStatus({ busy: true });
      fetchPowerDaily(lat, lon, ctl.signal)
        .then((d) => alive && (setLive(d), setStatus({ busy: false })))
        .catch((e) => alive && setStatus({ busy: false, error: e instanceof Error ? e.message : String(e) }));
    }
    return () => {
      alive = false;
      ctl.abort();
    };
  }, [exampleId, lat, lon]);

  const regionType = example ? REGION_TYPES.find((r) => r.id === example.region_type) : null;
  const suggested = useMemo(() => {
    let list = CATALOG;
    if (topic) list = list.filter((c) => c.topics.includes(topic));
    if (regionType && !topic) list = [...list].sort((a, b) => (regionType.suggest.includes(b.param) ? 1 : 0) - (regionType.suggest.includes(a.param) ? 1 : 0));
    return list;
  }, [topic, regionType]);

  const series = useMemo(() => {
    if (!v || !ind) return null;
    let years: number[] = [];
    let values: (number | null)[] = [];
    let unit = "";
    let url = "";
    if (example) {
      years = example.years;
      values = example.series[v.param]?.[ind]?.[season] ?? [];
      unit = example.units[v.param] ?? v.unitHint;
      url = example.url;
    } else if (live && live.data[v.param]) {
      years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
      values = aggregateVariable(live.start, live.data[v.param], [ind], years)[ind][season];
      unit = live.units[v.param] ?? v.unitHint;
      url = live.url;
    } else return null;
    const indMeta = v.indicators.find((i) => i.key === ind)!;
    if (indMeta.unit) unit = indMeta.unit;
    const idx = years.map((y, i) => [y, i] as const).filter(([y]) => y >= from && y <= to);
    const ys = idx.map(([y]) => y);
    const vs = idx.map(([, i]) => values[i]);
    const valid = ys.map((y, i) => [y, vs[i]] as const).filter(([, x]) => x !== null) as [number, number][];
    return { years: ys, values: vs, valid, unit, url, label: `${indMeta.label} (${SEASON_LABEL[season].toLowerCase()})` };
  }, [v, ind, example, live, season, from, to]);

  const result = useMemo(() => {
    if (!series || series.valid.length < 10) return null;
    const y = series.valid.map(([, x]) => x);
    const t = trend(y);
    const yn = t.p_mk_hr >= 0.05 ? yearsNeeded(y, t.sen_slope, t.sen_intercept) : null;
    const first = series.valid.slice(0, 10).map(([, x]) => x);
    const last = series.valid.slice(-10).map(([, x]) => x);
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    return { t, yn, early: mean(first), late: mean(last), y0: series.valid[0][0], y1: series.valid[series.valid.length - 1][0], n: y.length };
  }, [series]);

  const pick = (la: number, lo: number, name?: string) => set({ lat: String(la), lon: String(lo), place: name ?? `${la.toFixed(2)}, ${lo.toFixed(2)}`, example: null });
  const placeLabel = example ? example.label : placeName ?? (lat !== null ? `${lat}, ${lon}` : null);
  const matches = q.length >= 2 && places ? places.filter((p) => p.n.toLowerCase().startsWith(q.toLowerCase())).slice(0, 6) : [];
  const sig = result ? result.t.p_mk_hr < 0.05 : false;
  const up = result ? result.t.sen_slope > 0 : false;
  const sentence =
    series && result
      ? trendSentence({
          label: series.label.charAt(0).toUpperCase() + series.label.slice(1),
          unit: series.unit,
          decimals: 2,
          firstYear: result.y0,
          senPerDecade: result.t.sen_slope * 10,
          ciLowDec: result.t.ci_low * 10,
          ciHighDec: result.t.ci_high * 10,
          p: result.t.p_mk_hr,
          sigRaw: sig,
          sigFdr: null,
          yearsNeeded: result.yn,
          early: { label: "the first 10 years", value: result.early },
          late: { label: "the last 10 years", value: result.late },
        })
      : "";

  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <div className="eyebrow">ANYWHERE ON EARTH · NASA POWER (MERRA-2 + SATELLITES) · {FIRST_YEAR}–{LAST_YEAR}</div>
      <h1 style={{ marginTop: 12, maxWidth: 900 }}>Is the climate changing where you are?</h1>
      <p className="lead" style={{ marginTop: 12, maxWidth: 760 }}>
        Click any place on the planet, pick what you care about and get its NASA trend with an honest significance test — computed live in your browser.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 28, alignItems: "stretch" }}>
        <div className="mapcard" style={{ flex: "1.4 1 520px", minWidth: 0, display: "flex", flexDirection: "column" }} data-tour="place">
          <div className="mapbox" style={{ height: "auto", flex: 1, minHeight: 420 }}>
            <WorldMap point={lat !== null && lon !== null && !example ? { lat, lon } : example ? { lat: example.lat, lon: example.lon } : null} examples={examples ?? []} onPick={(la, lo) => pick(la, lo)} />
          </div>
          <div className="row small ink2" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <span>Click anywhere for live NASA data · orange dots are ready-made examples</span>
            {placeLabel && (
              <span>
                <b style={{ color: "var(--ink)" }}>{placeLabel}</b>
                {status.busy && " · loading NASA POWER…"}
              </span>
            )}
          </div>
          {status.error && <div className="warnbox" style={{ marginTop: 8 }}>{status.error}. Try one of the example regions (they work offline).</div>}
        </div>

        <div className="stack" style={{ flex: "1 1 360px", minWidth: 0, gap: 18 }}>
          <Step n={1} title="What do you care about?" tour="topic">
            <div className="row" style={{ gap: 6 }}>
              {TOPICS.map((t) => (
                <button key={t.id} className="option" style={{ padding: "7px 12px", borderRadius: 999 }} aria-pressed={topic === t.id} onClick={() => set({ topic: topic === t.id ? null : t.id })}>
                  {t.label}
                </button>
              ))}
            </div>
          </Step>
          <Step n={2} title="Where?">
            <label className="field" style={{ position: "relative" }}>
              <span className="sr-only">Search a city</span>
              <span style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }}>
                <Search size={16} />
              </span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city — Sevilla, Cairo, Manaus…" style={{ paddingLeft: 36 }} />
            </label>
            {matches.length > 0 && (
              <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                {matches.map((p) => (
                  <button key={`${p.n}${p.lat}`} className="btn" style={{ justifyContent: "flex-start", minHeight: 34 }} onClick={() => (pick(p.lat, p.lon, `${p.n}, ${p.c}`), setQ(""))}>
                    {p.n}, <span className="muted">{p.c}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="small muted" style={{ margin: "12px 0 6px" }}>…or a type of place</div>
            <div className="row" style={{ gap: 6 }}>
              {REGION_TYPES.map((r) => (
                <button key={r.id} className="option" style={{ padding: "7px 12px", borderRadius: 999 }} aria-pressed={exampleId === r.example} onClick={() => set({ example: r.example, lat: null, lon: null, place: null })} title={examples?.find((e) => e.id === r.example)?.label}>
                  {r.label}
                </button>
              ))}
            </div>
            {regionType && <p className="note" style={{ marginTop: 8 }}>{regionType.why}</p>}
          </Step>
          <Step n={3} title="Which NASA measurement?" tour="vars">
            <div className="stack" style={{ gap: 6, maxHeight: 300, overflow: "auto", paddingRight: 4 }}>
              {suggested.map((c) => (
                <button key={c.param} className="option" aria-pressed={param === c.param} onClick={() => set({ param: c.param, ind: null })}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="t">{c.name}</span>
                    {regionType?.suggest.includes(c.param) && <span className="chip ai">suggested here</span>}
                  </div>
                  <div className="small ink2" style={{ marginTop: 2 }}>{c.def}</div>
                </button>
              ))}
            </div>
          </Step>
        </div>
      </div>

      <section className="section" data-tour="result" aria-live="polite">
        {!v || !placeLabel ? (
          <div className="card soft" style={{ textAlign: "center", padding: 40 }}>
            <h3>Pick a place and a measurement to see its trend.</h3>
            <p className="ink2" style={{ marginTop: 8 }}>Try: Desert → Air temperature, or click your home town.</p>
          </div>
        ) : !series ? (
          <div className="card">{status.busy ? <Loading what="NASA POWER data" /> : <p className="muted">{status.error ? "No data — choose another place or an example region." : "Waiting for data…"}</p>}</div>
        ) : !result ? (
          <p className="warnbox">Fewer than 10 complete years for this choice (e.g. solar data start in 1984, or the season has gaps). Widen the period or pick another measurement.</p>
        ) : (
          <>
            <div className="eyebrow">THE VERDICT</div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, gap: 18 }}>
              <div style={{ minWidth: 0, flex: "1 1 520px" }}>
                <h2 style={{ maxWidth: 820 }}>
                  {series.label.charAt(0).toUpperCase() + series.label.slice(1)} in {placeLabel}:{" "}
                  <span style={{ color: sig ? (up ? "var(--heat-4)" : "var(--cold)") : "var(--muted)" }}>
                    {sig ? (up ? "rising" : "falling") : "no clear trend yet"}
                  </span>
                </h2>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Sig raw={sig} />
                <Prov kind="nasa" />
              </div>
            </div>

            <div className="metrics" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 22 }}>
              <Metric value={`${signed(result.t.sen_slope * 10, 2)}`} label={`${series.unit} per decade (95% CI ${signed(result.t.ci_low * 10, 2)} to ${signed(result.t.ci_high * 10, 2)})`} color={sig ? (up ? "var(--heat-4)" : "var(--cold)") : undefined} />
              <Metric value={`${fmt(result.early, 1)} → ${fmt(result.late, 1)}`} label={`${series.unit} · first 10 vs last 10 years`} />
              <Metric value={fmt(result.t.p_mk_hr, 3)} label={<>chance of a trend this big from noise alone (<Term k="mk">Mann-Kendall p</Term>)</>} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 24 }}>
              <div className="card" style={{ flex: "2 1 560px", minWidth: 0 }}>
                <TimeSeriesChart
                  years={series.years}
                  values={series.values}
                  unit={series.unit}
                  label={series.label}
                  decimals={2}
                  trend={{ slope: result.t.sen_slope, lo: result.t.ci_low, hi: result.t.ci_high, pivotX: series.valid[0][0] + (result.n - 1) / 2, pivotY: result.t.sen_intercept + result.t.sen_slope * ((result.n - 1) / 2) }}
                />
                <div className="row" style={{ marginTop: 12, gap: 10 }}>
                  <label className="field">
                    Indicator
                    <select value={ind ?? ""} onChange={(e) => set({ ind: e.target.value })}>
                      {v.indicators.map((i) => (
                        <option key={i.key} value={i.key}>{i.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Season
                    <select value={season} onChange={(e) => set({ season: e.target.value })}>
                      {SEASONS.map((s) => (
                        <option key={s} value={s}>{SEASON_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    From
                    <input type="number" min={FIRST_YEAR} max={to - 10} value={from} onChange={(e) => set({ from: e.target.value })} style={{ width: 92 }} />
                  </label>
                  <label className="field">
                    To
                    <input type="number" min={from + 10} max={LAST_YEAR} value={to} onChange={(e) => set({ to: e.target.value })} style={{ width: 92 }} />
                  </label>
                </div>
              </div>
              <div className="stack" style={{ flex: "1 1 320px", minWidth: 0, gap: 14 }}>
                <p style={{ fontSize: 17, lineHeight: 1.55 }}>{sentence}</p>
                <button
                  className="btn primary"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() =>
                    assistant.explain({
                      kind: "facts",
                      title: `${series.label} · ${placeLabel}`,
                      facts: { place: placeLabel, variable: v.name, indicator: series.label, unit: series.unit, years: `${result.y0}-${result.y1}`, sen_per_decade: result.t.sen_slope * 10, ci95_per_decade: [result.t.ci_low * 10, result.t.ci_high * 10], p_mann_kendall: result.t.p_mk_hr, mean_first_10_years: result.early, mean_last_10_years: result.late, source: v.source },
                      fallback: sentence + " " + v.processes,
                    })
                  }
                >
                  <Sparkles size={14} /> Explain this to me
                </button>
                <div className="card soft" style={{ padding: 18 }}>
                  <b>What could cause it?</b>
                  <p className="small ink2" style={{ marginTop: 6 }}>{v.processes}</p>
                </div>
                <div className="card soft" style={{ padding: 18 }}>
                  <b>{sig ? "What “significant” means" : "Not significant? Still a finding"}</b>
                  <p className="small ink2" style={{ marginTop: 6 }}>
                    {sig
                      ? "A steady change this large would be unlikely from year-to-year noise alone. It does not tell you the cause — compare with nearby places and other measurements, like a detective."
                      : "A trend can be real but small next to natural year-to-year swings. A longer record, another season or a nearby place may reveal it — or confirm nothing is changing."}
                  </p>
                </div>
                <details className="small">
                  <summary className="muted" style={{ cursor: "pointer" }}>Expert numbers: t-test, Kendall's τ, S/Z</summary>
                  <table className="data" style={{ marginTop: 8 }}>
                    <tbody>
                      <tr><td><Term k="ttest">OLS slope (t-test)</Term></td><td>{signed(result.t.ols_slope * 10, 3)}/decade, p = {fmt(result.t.p_ols, 4)}</td></tr>
                      <tr><td>Kendall's τ</td><td>{fmt(result.t.tau, 3)}</td></tr>
                      <tr><td>MK S / Z (Hamed–Rao)</td><td>{result.t.mk_s} / {fmt(result.t.mk_z, 2)}</td></tr>
                      <tr><td>Years used</td><td>{result.n} ({result.y0}–{result.y1})</td></tr>
                    </tbody>
                  </table>
                </details>
                <p className="note">
                  {v.source}. {example ? "Example precomputed by our pipeline from" : "Fetched live from"}{" "}
                  <a href={series.url} target="_blank" rel="noreferrer">NASA POWER</a>.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
