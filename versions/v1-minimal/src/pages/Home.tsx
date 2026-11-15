import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Pause, Play, Sparkles } from "lucide-react";
import { SpainMap, type Pulse } from "../components/SpainMap";
import { TrackDemo } from "../components/TrackDemo";
import { Seg, StatusChip } from "../components/ui";
import { useTour } from "../components/Tour";
import { HEAT_STEPS, heatColor, trendScale, valueScale } from "../colors";
import { IND, MAP_INDICATORS, fmt, signed } from "../config";
import { useCell, useJson, useNetwork, useSegments, useSummary } from "../data/load";
import { useWatch, worstByCell } from "../data/forecast";
import { isAlert, STATUS_COLOR, STATUS_RANK } from "../model/watch";
import { useFocus } from "../state/focus";
import { useAssistant } from "../ai/AssistantContext";

type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; lat: number; lon: number; place: string }>;
const ERAS = ["1981–90", "2016–25", "2041–60", "2081–2100"];
const ERA_NOTE = ["average 1981–1990 · NASA POWER", "average 2016–2025 · NASA POWER", "2041–2060 · intermediate emissions · NASA NEX-GDDP-CMIP6", "2081–2100 · intermediate emissions · NASA NEX-GDDP-CMIP6"];
const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function HomePage() {
  const [sp, setSp] = useSearchParams();
  const { data: summary } = useSummary();
  const { data: network } = useNetwork();
  const { data: segFc } = useSegments();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const watch = useWatch();
  const { setFocus, openExpert } = useFocus();
  const assistant = useAssistant();
  const tour = useTour();
  const ind = sp.get("ind") && IND[sp.get("ind")!] ? sp.get("ind")! : "HOT40";
  const view = sp.get("view") === "trend" ? "trend" : "values";
  const fdrAfter = sp.get("fdr") !== "before";
  const [era, setEra] = useState(sp.get("view") === "future" ? 2 : 1);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selCell, setSelCell] = useState<string>(sp.get("cell") ?? "37.50_-5.625");
  const [selSeg, setSelSeg] = useState<string | null>(sp.get("seg"));
  const meta = IND[ind];
  const cellInfo = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);
  const segById = useMemo(() => new Map((segFc?.features ?? []).map((f) => [f.properties.id, f.properties])), [segFc]);

  useEffect(() => {
    const s = sp.get("seg");
    if (s && segById.get(s)) {
      setSelSeg(s);
      setSelCell(segById.get(s)!.c);
    }
  }, [sp, segById]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setEra((e) => (e + 1) % 4), 1400);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    const c = cellInfo.get(selCell);
    setFocus({ cellId: selCell, segmentId: selSeg, indicator: ind, label: c ? `${c.place} area` : undefined });
  }, [selCell, selSeg, ind, cellInfo, setFocus]);

  const valueOf = (cid: string, e: number) => {
    const r = summary?.cells[cid]?.[ind];
    if (!r) return null;
    return e === 0 ? r.early : e === 1 ? r.late : (r.fut?.ssp245?.[e === 2 ? "2041-2060" : "2081-2100"]?.[0] ?? null);
  };
  const isCount = ["heat", "cold", "rain"].includes(meta.kind);
  const scale = useMemo(() => (summary ? (view === "trend" ? trendScale(summary, ind) : valueScale(summary, ind, meta.kind)) : null), [summary, view, ind, meta.kind]);
  const colors = useMemo(() => {
    if (!summary || !scale) return null;
    const out: Record<string, string> = {};
    for (const [cid, c] of Object.entries(summary.cells)) {
      if (view === "trend") {
        const r = c[ind];
        out[cid] = r?.rare ? "#dadde2" : scale.color(r?.sen);
      } else out[cid] = ind.startsWith("HOT") ? heatColor(valueOf(cid, era)) : scale.color(valueOf(cid, era));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, scale, era, ind, view]);
  const stipple = useMemo(() => (summary && view === "trend" ? Object.entries(summary.cells).filter(([, c]) => c[ind]?.[fdrAfter ? "fdr" : "raw"] && !c[ind]?.rare).map(([k]) => k) : []), [summary, view, ind, fdrAfter]);

  // live watch
  const worst = useMemo(() => (watch.data ? worstByCell(watch.data.days) : null), [watch.data]);
  const watchKm = useMemo(() => {
    const out = { heat: 0, cold: 0, warm: 0 };
    if (!worst) return out;
    for (const [cid, w] of Object.entries(worst)) {
      const km = cellInfo.get(cid)?.km ?? 0;
      if (w.status.startsWith("heat")) out.heat += km;
      if (w.status.startsWith("cold")) out.cold += km;
      if (w.status === "unusual-warm") out.warm += km;
    }
    return out;
  }, [worst, cellInfo]);
  const pulses: Pulse[] = useMemo(
    () =>
      worst
        ? Object.entries(worst)
            .filter(([, w]) => isAlert(w.status))
            .sort((a, b) => STATUS_RANK[b[1].status] - STATUS_RANK[a[1].status])
            .slice(0, 40)
            .map(([cid, w]) => ({ lon: cellInfo.get(cid)?.lon ?? 0, lat: cellInfo.get(cid)?.lat ?? 0, color: STATUS_COLOR[w.status] }))
            .filter((q) => q.lon !== 0)
        : [],
    [worst, cellInfo],
  );
  const topWatch = worst ? Object.entries(worst).filter(([, w]) => w.status !== "ok").sort((a, b) => STATUS_RANK[b[1].status] - STATUS_RANK[a[1].status] || b[1].rail - a[1].rail)[0] : null;

  const shown = hover ? (segById.get(hover)?.c ?? selCell) : selCell;
  const info = cellInfo.get(shown);
  const vals = [0, 1, 2, 3].map((e) => valueOf(shown, e));
  const vmax = Math.max(1, ...vals.map((v) => v ?? 0));
  const h = network?.headline;
  const fc = network?.future_cards?.["ssp245|2041-2060"];
  const { data: sev } = useCell("37.50_-5.625");
  const julyIdx = 31 + 29 + 31 + 30 + 31 + 30 + 14;
  const odds = sev?.doy?.["42"]?.["2016-2025"]?.[julyIdx];

  return (
    <>
      <section className="wrap" style={{ paddingTop: 56 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 44, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0, paddingTop: 20 }}>
            <div className="eyebrow">NASA Earth data · 1981 → 2100</div>
            <h1 style={{ marginTop: 16 }}>Spain's railway is running in a climate it wasn't built for.</h1>
            <p className="lead" style={{ marginTop: 20 }}>
              We read 45 years of NASA data along {fmt(h?.total_km, 0)}&nbsp;km of track. In the south, days above 40&nbsp;°C have tripled — and they keep climbing.
            </p>
            {h && (
              <div className="metrics" style={{ marginTop: 32 }}>
                <div className="metric">
                  <div className="v" style={{ color: "var(--heat-4)" }}>×{fmt(h.hot40_late_kmw / Math.max(h.hot40_early_kmw, 0.01), 1)}</div>
                  <div className="l">days above 40&nbsp;°C per km of track since the 1980s</div>
                </div>
                <div className="metric">
                  <div className="v">{fmt(h.hot40_sig_up_km, 0)}<span style={{ fontSize: "0.55em", marginLeft: 4, color: "var(--ink-2)" }}>km</span></div>
                  <div className="l">where the rise is statistically robust</div>
                </div>
                <div className="metric">
                  <div className="v" style={{ color: "var(--cold)" }}>{signed((100 * (h.frost_late_kmw - h.frost_early_kmw)) / h.frost_early_kmw, 0)}%</div>
                  <div className="l">frost days — fewer rails cracking in the cold</div>
                </div>
              </div>
            )}
            <Link to="/watch" className="card" style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 28, textDecoration: "none", padding: 16 }} data-tour="watch-banner">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: watchKm.heat ? "var(--heat-4)" : watchKm.cold ? "var(--cold)" : watchKm.warm ? "#f2a33a" : "var(--ok)", animation: "pulse 1.8s infinite", flex: "0 0 auto" }} />
              <span style={{ flex: 1 }}>
                <b>Live rail heat watch · next 7 days.</b>{" "}
                <span className="ink2">
                  {!watch.data && !watch.error && "Checking the forecast for every section…"}
                  {watch.error && "Forecast unavailable right now."}
                  {watch.data &&
                    (watchKm.heat || watchKm.cold
                      ? `${watchKm.heat ? `${fmt(watchKm.heat, 0)} km on heat watch` : ""}${watchKm.heat && watchKm.cold ? " · " : ""}${watchKm.cold ? `${fmt(watchKm.cold, 0)} km on cold watch` : ""}${topWatch ? ` — strongest near ${cellInfo.get(topWatch[0])?.place}.` : ""}`
                      : watchKm.warm
                        ? `No heat watch, but ${fmt(watchKm.warm, 0)} km will be unusually warm for the season${topWatch ? ` — most near ${cellInfo.get(topWatch[0])?.place}` : ""}.`
                        : "Nothing unusual for the season on the network this week.")}
                </span>
              </span>
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="mapcard" style={{ flex: "1 1 640px", minWidth: 0 }} data-tour="map">
            <div className="row" style={{ justifyContent: "space-between" }}>
              {view === "values" ? (
                <Seg label="Period" value={era} onChange={(e) => (setPlaying(false), setEra(e))} options={ERAS.map((l, i) => ({ id: i, label: l }))} />
              ) : (
                <Seg label="Significance" value={fdrAfter ? "after" : "before"} onChange={(v) => setSp((p) => (v === "before" ? p.set("fdr", "before") : p.delete("fdr"), p), { replace: true })} options={[{ id: "before", label: "Single test" }, { id: "after", label: "After FDR" }]} />
              )}
              {view === "values" && (
                <button className="btn" onClick={() => setPlaying((p) => !p)} disabled={reduced}>
                  {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play 1981 → 2100"}
                </button>
              )}
            </div>
            <div className="mapbox" style={{ marginTop: 12 }}>
              <SpainMap
                segColors={colors}
                stipple={stipple}
                cellColors={view === "trend" ? colors : null}
                cellOpacity={0.25}
                selectedSegment={selSeg}
                selectedCell={selCell}
                pulses={pulses}
                onHoverSegment={(p) => setHover(p?.id ?? null)}
                onSegment={(p) => (setSelSeg(p.id), setSelCell(p.c))}
                onCell={(c) => (setSelSeg(null), setSelCell(c))}
                label={`Spain's railway coloured by ${meta.label}`}
              />
              {info && (
                <div className="float" style={{ right: 12, top: 12, width: 236 }} aria-live="polite">
                  <div className="small muted">{fmt(info.km, 0)} km of track</div>
                  <div style={{ fontSize: 19, fontWeight: 650 }}>{info.place} area</div>
                  {view === "values" ? (
                    <>
                      <div className="row" style={{ gap: 6, marginTop: 8, alignItems: "baseline" }}>
                        <span className="big" style={{ fontSize: 42, color: (vals[era] ?? 0) > 20 && ind.startsWith("HOT") ? "var(--heat-4)" : "var(--ink)" }}>{fmt(vals[era], isCount ? 0 : 1)}</span>
                        <span className="small ink2">{meta.unit}</span>
                      </div>
                      <div className="tiny muted">{meta.short} · {ERA_NOTE[era]}</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56, marginTop: 12 }}>
                        {vals.map((v, i) => (
                          <div key={i} style={{ flex: 1, height: Math.max(3, (52 * (v ?? 0)) / vmax), borderRadius: 4, background: i === era ? (ind.startsWith("HOT") ? heatColor(v) : "var(--ink)") : "var(--heat-0)", transition: "height .4s" }} title={`${ERAS[i]}: ${fmt(v, 1)}`} />
                        ))}
                      </div>
                      <div className="row mono" style={{ gap: 6, fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                        {["80s", "now", "2050", "2090"].map((l) => (
                          <span key={l} style={{ flex: 1, textAlign: "center" }}>{l}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="big" style={{ fontSize: 40, marginTop: 8 }}>{signed(summary?.cells[shown]?.[ind]?.sen, 1)}</div>
                      <div className="tiny muted">{meta.unit} per decade since 1981</div>
                    </>
                  )}
                  {worst?.[shown] && worst[shown].status !== "ok" && (
                    <div style={{ marginTop: 10 }}>
                      <StatusChip s={worst[shown].status} /> <span className="tiny muted">this week</span>
                    </div>
                  )}
                  <div className="row" style={{ marginTop: 12, gap: 6 }}>
                    <button className="btn" style={{ minHeight: 32, padding: "5px 10px", fontSize: 13 }} onClick={() => assistant.explain({ kind: "cell", cellId: shown, indicator: ind, segment: info.place })}>
                      <Sparkles size={13} /> Explain
                    </button>
                    <button className="btn" style={{ minHeight: 32, padding: "5px 10px", fontSize: 13 }} onClick={() => openExpert("stats")}>
                      Numbers
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="legend-row">
              {view === "values" && ind.startsWith("HOT") ? (
                <>
                  <span>{meta.short} a year</span>
                  {HEAT_STEPS.map((s) => (
                    <span key={s.label}>
                      <span className="sw" style={{ background: s.color }} />
                      {s.label}
                    </span>
                  ))}
                </>
              ) : (
                scale && (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    {view === "trend" ? `${meta.short}: change per decade (dots = significant)` : meta.label}
                    <span style={{ width: 120, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${scale.colors.join(",")})` }} />
                    {fmt(scale.domain[0], 0)} … {fmt(scale.domain[1], 0)}
                  </span>
                )
              )}
              {pulses.length > 0 && (
                <span>
                  <span className="sw" style={{ background: "var(--heat-4)" }} />
                  pulsing = on watch this week
                </span>
              )}
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="small ink2" style={{ cursor: "pointer" }}>Map options</summary>
              <div className="row" style={{ marginTop: 10 }}>
                <label className="field">
                  Variable
                  <select value={ind} onChange={(e) => setSp((p) => (p.set("ind", e.target.value), p), { replace: true })}>
                    {MAP_INDICATORS.map((k) => (
                      <option key={k} value={k}>{IND[k].label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Show
                  <Seg label="Map view" value={view} onChange={(v) => setSp((p) => (v === "trend" ? p.set("view", "trend") : p.delete("view"), p), { replace: true })} options={[{ id: "values", label: "Values" }, { id: "trend", label: "Trend + significance" }]} />
                </label>
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="eyebrow">Why it matters</div>
        <h2 style={{ marginTop: 10, maxWidth: 760 }}>A hot afternoon can bend a railway. Try it.</h2>
        <div style={{ marginTop: 26 }}>
          <TrackDemo />
        </div>
      </section>

      <section className="wrap section">
        <div className="grid g4">
          <Link to="/trip" className="tile">
            <span className="k">My trip</span>
            <span className="t">
              Madrid → Seville on 15 July: <span style={{ color: "var(--heat-4)" }}>{odds !== undefined ? `${Math.round(odds / 10)} in 10` : "…"}</span> years now reach 42&nbsp;°C near Seville.
            </span>
            <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginTop: "auto" }}>
              <div style={{ flex: 3, background: "var(--heat-1)" }} />
              <div style={{ flex: 3, background: "var(--heat-2)" }} />
              <div style={{ flex: 2, background: "var(--heat-3)" }} />
              <div style={{ flex: 2, background: "var(--heat-4)" }} />
            </div>
            <span className="go">Check your route →</span>
          </Link>
          <Link to="/watch" className="tile">
            <span className="k">Heat watch</span>
            <span className="t">Next 7 days, every section: where the forecast heat would leave the track with no margin.</span>
            <span className="go" style={{ marginTop: "auto" }}>Open the live watch →</span>
          </Link>
          <Link to="/network" className="tile">
            <span className="k">2050</span>
            <span className="t">
              Track with 10+ days above 40&nbsp;°C a year: <span style={{ color: "var(--heat-4)" }}>{fc ? `×${fmt(fc.km_hot40_gt10 / Math.max(fc.km_hot40_gt10_ref, 1), 0)}` : "…"}</span> by 2041–2060.
            </span>
            <span className="go" style={{ marginTop: "auto" }}>See the future →</span>
          </Link>
          <Link to="/detective" className="tile">
            <span className="k">Anywhere on Earth</span>
            <span className="t">Pick a place and a NASA variable. Get its 45-year trend in one sentence.</span>
            <svg viewBox="0 0 120 40" width="100%" height="40" style={{ marginTop: "auto" }} aria-hidden>
              <polyline points="0,32 12,30 24,33 36,27 48,29 60,24 72,25 84,18 96,20 108,12 120,9" fill="none" stroke="#0c0d0f" strokeWidth="2" />
            </svg>
            <span className="go">Start investigating →</span>
          </Link>
        </div>
        <div className="row" style={{ marginTop: 24 }}>
          <button className="btn" onClick={() => tour.start("railway")}>
            <Play size={14} /> Take the 60-second tour
          </button>
          <span className="note">{IND[ind].rail}</span>
        </div>
      </section>
    </>
  );
}
