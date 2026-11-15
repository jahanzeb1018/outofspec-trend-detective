import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SpainMap } from "../components/SpainMap";
import { Loading, Seg, StatusChip } from "../components/ui";
import { heatColor } from "../colors";
import { fmt } from "../config";
import { useCell, useRoutes, useSegments, useSummary } from "../data/load";
import { useWatch } from "../data/forecast";
import { STATUS_COLOR, STATUS_RANK, type Status } from "../model/watch";
import { useFocus } from "../state/focus";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const calIndex = (m: number, d: number) => DAYS_IN.slice(0, m - 1).reduce((a, b) => a + b, 0) + d - 1;
const clean = (n: string) => n.replace(/ (Atocha|Chamartín|Sants)$/, "");

export function TripPage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const routeId = sp.get("route") ?? "mad-sev";
  const date = /^\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? sp.get("date")! : "07-15";
  const [mm, dd] = date.split("-").map(Number);
  const when = sp.get("when") === "fut" ? "fut" : "now";
  const thr = sp.get("thr") === "40" ? 40 : 42;
  const odds = Number(sp.get("odds") ?? 1);
  const track = sp.get("track") === "repaired" ? "repaired" : "modern";

  const { data: routes } = useRoutes();
  const { data: summary } = useSummary();
  const { data: segFc } = useSegments();
  const watch = useWatch();
  const { setFocus, openExpert } = useFocus();
  const route = routes?.find((r) => r.route_id === routeId) ?? null;
  const segById = useMemo(() => new Map((segFc?.features ?? []).map((f) => [f.properties.id, f.properties])), [segFc]);

  const prof = useMemo(() => {
    if (!route || !summary) return null;
    const step = Math.max(1, Math.round(route.samples.length / 120));
    const pts = route.samples.filter((_, i) => i % step === 0);
    const val = (cid: string) => {
      const r = summary.cells[cid]?.HOT40;
      return (when === "now" ? r?.late : r?.fut?.ssp245?.["2041-2060"]?.[0]) ?? 0;
    };
    const v = pts.map((s) => ({ km: s.km, v: val(s.cell_id), cell: s.cell_id, seg: s.segment_id }));
    let best = v[0];
    for (const p of v) if (p.v > best.v) best = p;
    const cut = best.v * 0.7;
    let a = v.indexOf(best);
    let b = a;
    while (a > 0 && v[a - 1].v >= cut) a--;
    while (b < v.length - 1 && v[b + 1].v >= cut) b++;
    const from = [...route.stations].reverse().find((s) => s.km <= v[a].km + 5) ?? route.stations[0];
    const to = route.stations.find((s) => s.km >= v[b].km - 5) ?? route.stations[route.stations.length - 1];
    const types = new Set(route.samples.map((s) => segById.get(s.segment_id)?.t));
    return { v, best, from, to, km: Math.max(1, Math.round(to.km - from.km)), hsl: types.has("HSL") };
  }, [route, summary, when, segById]);

  const hot = prof?.best.cell ?? null;
  const { data: hotCell } = useCell(hot);
  useEffect(() => {
    if (hot && hotCell) setFocus({ cellId: hot, indicator: "HOT40", label: `${hotCell.place} area` });
  }, [hot, hotCell, setFocus]);

  const di = calIndex(mm, dd);
  const keys = ["1981-1990", "2016-2025", "ssp245|2041-2060"];
  const pct = hotCell?.doy?.[String(thr)]?.[keys[odds]]?.[di];
  const n10 = pct === undefined ? null : Math.round(pct / 10);
  const preset = track === "repaired" ? "weak" : prof?.hsl ? "strong" : "average";
  const bNow = hot ? summary?.cells[hot]?._bsm?.[preset]?.recent : null;
  const bFut = hot ? summary?.cells[hot]?._bsm?.[preset]?.["ssp245|2041-2060"] : null;
  const holds = (bNow?.[0] ?? 0) >= 0;

  // this week on the route (forecast)
  const week = useMemo(() => {
    if (!watch.data || !route) return null;
    const cells = [...new Set(route.samples.map((s) => s.cell_id))];
    return watch.data.days.map((d) => {
      let rail = -99;
      let status: Status = "ok";
      let where = "";
      for (const c of cells) {
        const x = d.cells[c];
        if (!x) continue;
        if (x.rail > rail) (rail = x.rail), (where = c);
        if (STATUS_RANK[x.status] > STATUS_RANK[status]) status = x.status;
      }
      return { date: d.date, rail, status, where };
    });
  }, [watch.data, route]);

  if (!routes || !summary) return <div className="wrap"><Loading what="routes" /></div>;
  const maxV = Math.max(10, ...(prof?.v.map((p) => p.v) ?? [0]));
  const W = 1100;
  const H = 190;
  const len = route?.length_km ?? 1;
  const pts = prof?.v.map((p) => `${((p.km / len) * W).toFixed(1)},${(H - 6 - (p.v / maxV) * (H - 30)).toFixed(1)}`) ?? [];
  const headline = !prof
    ? ""
    : prof.best.v < 1
      ? `No days above 40 °C along this route ${when === "now" ? "today" : "in 2041–2060"}.`
      : when === "now"
        ? `Heat builds on the ${prof.km} km between ${clean(prof.from.name)} and ${clean(prof.to.name)}.`
        : `By mid-century, the heat stretch reaches ${fmt(prof.best.v, 0)} days a year near ${hotCell?.place ?? clean(prof.to.name)}.`;

  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <form className="row" style={{ gap: 14, alignItems: "flex-end" }} onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          Route
          <select value={routeId} onChange={(e) => set({ route: e.target.value })} style={{ minWidth: 240 }}>
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Travel date
          <span className="row" style={{ gap: 6 }}>
            <select aria-label="Month" value={mm} onChange={(e) => set({ date: `${e.target.value.padStart(2, "0")}-${String(Math.min(dd, DAYS_IN[Number(e.target.value) - 1])).padStart(2, "0")}` })}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select aria-label="Day" value={dd} onChange={(e) => set({ date: `${String(mm).padStart(2, "0")}-${e.target.value.padStart(2, "0")}` })}>
              {Array.from({ length: DAYS_IN[mm - 1] }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </span>
        </label>
        <label className="field">
          Climate
          <Seg label="Climate period" value={when} onChange={(v) => set({ when: v === "now" ? null : v })} options={[{ id: "now", label: "Today" }, { id: "fut", label: "2041–2060" }]} />
        </label>
      </form>

      {route && prof && (
        <>
          <div style={{ marginTop: 36 }}>
            <div className="eyebrow">
              {route.name} · {fmt(route.length_km, 0)} km · {prof.hsl ? "high-speed line" : "conventional line"}
            </div>
            <h1 style={{ marginTop: 10, fontSize: "clamp(2rem, 4vw, 3.1rem)", maxWidth: 960 }}>{headline}</h1>
          </div>

          <div className="card" style={{ marginTop: 26 }} data-tour="trip-strip">
            <div className="row small ink2" style={{ justifyContent: "space-between" }}>
              <span>Days above 40&nbsp;°C a year, along the line</span>
              <span className="mono">{when === "now" ? "2016–2025 · NASA POWER" : "2041–2060 · intermediate emissions · NASA NEX-GDDP-CMIP6"}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", marginTop: 10 }} role="img" aria-label="Heat profile along the route">
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={0} x2={W} y1={H - 6 - f * (H - 30)} y2={H - 6 - f * (H - 30)} stroke="#f0f1f3" />
              ))}
              {[0.25, 0.5, 0.75].map((f) => (
                <text key={`t${f}`} x={4} y={H - 10 - f * (H - 30)} fontSize={11} fill="#646b76" fontFamily="Geist Mono, monospace">
                  {Math.round(f * maxV)}
                </text>
              ))}
              <polygon points={`0,${H - 6} ${pts.join(" ")} ${W},${H - 6}`} fill={when === "now" ? "#f2783a" : "#d63a2f"} fillOpacity={0.2} style={{ transition: "all .4s" }} />
              <polyline points={pts.join(" ")} fill="none" stroke={when === "now" ? "#f2783a" : "#d63a2f"} strokeWidth={3} strokeLinejoin="round" />
              <line x1={0} x2={W} y1={H - 6} y2={H - 6} stroke="#e6e8eb" />
            </svg>
            <div style={{ position: "relative", height: 46, marginTop: 4 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 7, borderTop: "2px solid var(--ink)" }} />
              {route.stations.map((s, i) => {
                const last = i === route.stations.length - 1;
                return (
                  <div key={s.name + i} style={{ position: "absolute", left: `${(100 * s.km) / len}%`, transform: `translateX(${i === 0 ? 0 : last ? -100 : -50}%)`, display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : last ? "flex-end" : "center", gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2px solid var(--ink)" }} />
                    <span className="small" style={{ fontWeight: 550, whiteSpace: "nowrap" }}>{clean(s.name)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid g3" style={{ marginTop: 18 }} data-tour="trip-cards">
            <div className="card">
              <div className="small ink2">
                A day of {thr}&nbsp;°C or more near {hotCell?.place ?? "the hottest stretch"}, within a week of {MONTHS[mm - 1]} {dd}
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <span className="big">{n10 === null ? "…" : `${odds === 2 ? "~" : ""}${n10} in 10`}</span>
                <span className="ink2">years</span>
              </div>
              <div className="row" style={{ gap: 7, marginTop: 14 }} role="img" aria-label={`${n10 ?? 0} out of 10 years`}>
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: n10 !== null && i < n10 ? ["#fbb868", "#d63a2f", "#8a1c2b"][odds] : "var(--line)", transition: "background .4s" }} />
                ))}
              </div>
              <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
                <Seg label="Period" value={odds} onChange={(v) => set({ odds: String(v) })} options={[{ id: 0, label: "1980s" }, { id: 1, label: "Today" }, { id: 2, label: "2041–60" }]} />
                <Seg label="Threshold" value={thr} onChange={(v) => set({ thr: v === 42 ? null : String(v) })} options={[{ id: 40, label: "40°" }, { id: 42, label: "42°" }]} />
              </div>
            </div>
            <div className="card">
              <div className="small ink2">Will the track hold on the hottest day?</div>
              <div style={{ fontSize: 34, fontWeight: 650, letterSpacing: "-0.03em", marginTop: 10, color: holds ? "var(--ok)" : "var(--bad)" }}>{holds ? (track === "modern" ? "Yes, comfortably" : "Just about") : "Not on the hottest days"}</div>
              <p className="ink2" style={{ marginTop: 8, lineHeight: 1.5 }}>
                {bNow && bFut
                  ? holds
                    ? `On the hottest day of a typical year the rail keeps ${fmt(bNow[0], 0)} °C of margin today, ${fmt(bFut[0], 0)} °C by 2041–2060.`
                    : `Track that was just repaired would run out of margin on about ${fmt(bNow[1], 0)} days a year here today — ${fmt(bFut[1], 0)} by 2041–2060.`
                  : "…"}
              </p>
              <div style={{ marginTop: 16 }}>
                <Seg label="Track condition" value={track} onChange={(v) => set({ track: v === "modern" ? null : v })} options={[{ id: "modern", label: prof.hsl ? "Modern track" : "Typical track" }, { id: "repaired", label: "Just repaired" }]} />
              </div>
            </div>
            <div className="card">
              <div className="small ink2">This week on your route · forecast</div>
              {!week ? (
                <p className="muted small" style={{ marginTop: 10 }}>{watch.error ? "Forecast unavailable." : "Loading the forecast…"}</p>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, marginTop: 14 }}>
                    {week.map((d) => (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.date}: rail up to ${fmt(d.rail, 0)} °C`}>
                        <span className="tiny mono">{fmt(d.rail, 0)}°</span>
                        <div style={{ width: "100%", height: Math.max(6, (d.rail / 70) * 80), borderRadius: 5, background: d.status === "ok" ? heatColor(d.rail > 45 ? 8 : d.rail > 35 ? 3 : 0) : STATUS_COLOR[d.status] }} />
                      </div>
                    ))}
                  </div>
                  <div className="row mono tiny muted" style={{ gap: 8 }}>
                    {week.map((d) => (
                      <span key={d.date} style={{ flex: 1, textAlign: "center" }}>{new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</span>
                    ))}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {week.some((d) => d.status !== "ok") ? <StatusChip s={week.reduce((a, d) => (STATUS_RANK[d.status] > STATUS_RANK[a] ? d.status : a), "ok" as Status)} /> : <span className="chip st-ok">Nothing unusual this week</span>}
                  </div>
                  <p className="note" style={{ marginTop: 8 }}>Highest estimated rail temperature along the route each day.</p>
                </>
              )}
            </div>
          </div>

          <div className="mapcard" style={{ marginTop: 18 }}>
            <div className="mapbox" style={{ height: 380 }}>
              <SpainMap route={route.geometry} dimSegments segColors={Object.fromEntries(prof.v.map((p) => [p.cell, heatColor(p.v)]))} label={`Map of the route ${route.name}`} />
            </div>
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            A climate answer from 45 years of NASA data and NASA climate projections — not a weather forecast (except the “this week” card).{" "}
            <button className="btn ghost" style={{ padding: 0, minHeight: 0, textDecoration: "underline" }} onClick={() => openExpert("stats")}>
              See the numbers
            </button>
          </p>
        </>
      )}
    </div>
  );
}
