import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CloudRain, Flame, Snowflake } from "lucide-react";
import { RailScene, type Hazard } from "../components/RailScene";
import { Loading } from "../components/ui";
import { fmt } from "../config";
import { loadJson, useJson, useRoutes } from "../data/load";
import { useWatch } from "../data/forecast";
import type { WatchData } from "../model/watch";
import { useFocus } from "../state/focus";
import { useWidth } from "../components/charts/useWidth";
import { ExpertButton } from "../components/ExpertDrawer";

/** One date, any year. Past (to the last NASA POWER day): what was measured that day. Next 7 days: the forecast.
 *  Later: the climate of that date in that year, blended between three anchors (pipeline/trip_data.py). */
type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; place: string }>;
type Daily = { cells: Record<string, [(number | null)[], (number | null)[], (number | null)[], (number | null)[]]> };
type ClimSet = Record<"rail50" | "rail90" | "tx50" | "tx90" | "tn50" | "tn10", number[]>;
type Clim = { step: number; now: ClimSet; "2050": ClimSet; "2090": ClimSet };
type Mode = "past" | "forecast" | "recent" | "future";
interface Pt {
  km: number;
  cid: string;
  rail: number | null;
  railHi: number | null; // climate only: a hot day (1 in 10)
  tn: number | null;
  tnLo: number | null; // climate only: a cold night (1 in 10)
  pr: number | null; // measured only
}

const clean = (n: string) => n.replace(/ (Atocha|Chamartín|Sants)$/, "");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const doyOf = (s: string) => {
  const d = new Date(s + "T12:00:00");
  return Math.round((d.getTime() - new Date(d.getFullYear(), 0, 1, 12).getTime()) / 864e5) + 1;
};
const HZ_COLOR: Record<Hazard, string> = { heat: "#d63a2f", cold: "#2563eb", rain: "#0d9488" };
type Level = 0 | 1 | 2 | 3;
const LEVEL_TXT = ["Low danger", "Moderate danger", "High danger", "Very high danger"];
const LEVEL_COL = ["#1e8e4e", "#b7791f", "#d63a2f", "#8a1c2b"];
const LEVEL_BG = ["#e7f4ec", "#fdf3dc", "#fbe4e2", "#f6dde0"];

/** Blend the three anchor climates for a year: today (measured 2016–2025, centred 2020.5), 2050 and 2090 (projected). */
function blendInfo(year: number) {
  if (year <= 2020.5) return { a: "now" as const, b: "now" as const, t: 0 };
  if (year <= 2050) return { a: "now" as const, b: "2050" as const, t: (year - 2020.5) / 29.5 };
  return { a: "2050" as const, b: "2090" as const, t: (year - 2050) / 40 };
}

export function TripPage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const today = iso(new Date());
  const nextJuly = `${new Date().getMonth() >= 6 ? new Date().getFullYear() + 1 : new Date().getFullYear()}-07-15`;
  const raw = sp.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw >= "1981-01-01" && raw <= "2100-12-31" ? raw : /^\d{2}-\d{2}$/.test(raw) ? `${nextJuly.slice(0, 4)}-${raw}` : nextJuly;
  const routeId = sp.get("route") ?? "mad-sev";

  const { data: routes } = useRoutes();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const { data: index } = useJson<{ first: string; last_day: string }>("daily/index.json");
  const { data: wd } = useJson<WatchData>("watch.json");
  const watch = useWatch();
  const { setFocus } = useFocus();
  const route = routes?.find((r) => r.route_id === routeId) ?? null;
  const [chartRef, CW] = useWidth<HTMLDivElement>(1100);
  const place = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties.place])), [cellsFc]);

  const fDay = watch.data?.days.find((d) => d.date === date) ?? null;
  const mode: Mode | null = !index ? null : date <= index.last_day ? "past" : fDay ? "forecast" : date < today || (!watch.data && date <= iso(new Date(Date.now() + 6 * 864e5))) ? "recent" : "future";
  const year = Number(date.slice(0, 4));
  const { data: daily } = useJson<Daily>(mode === "past" ? `daily/${date.slice(0, 7)}.json` : null);

  // climate files for the cells along the route (future dates)
  const routeCells = useMemo(() => [...new Set(route?.samples.map((s) => s.cell_id) ?? [])], [route]);
  const [clim, setClim] = useState<Record<string, Clim> | null>(null);
  const needClim = mode === "future" || mode === "recent";
  useEffect(() => {
    if (!needClim || !routeCells.length) return;
    let alive = true;
    Promise.all(routeCells.map((c) => loadJson<Clim>(`clim/${c}.json`).then((x) => [c, x] as const)))
      .then((xs) => alive && setClim(Object.fromEntries(xs)))
      .catch(() => alive && setClim({}));
    return () => {
      alive = false;
    };
  }, [needClim, routeCells]);

  const climYear = mode === "recent" ? 2020.5 : year;
  const bl = blendInfo(climYear);
  const pts: Pt[] | null = useMemo(() => {
    if (!route || !mode) return null;
    const step = Math.max(1, Math.round(route.samples.length / 120));
    const ss = route.samples.filter((_, i) => i % step === 0);
    const k = Math.min(72, Math.max(0, Math.round((doyOf(date) - 1) / 5)));
    const di = Number(date.slice(8, 10)) - 1;
    const mix = (c: Clim | undefined, key: keyof ClimSet) => {
      if (!c || !c[bl.a] || !c[bl.b]) return null;
      const a = c[bl.a][key][k];
      const b = c[bl.b][key][k];
      return a + (b - a) * bl.t;
    };
    return ss.map((s) => {
      const base: Pt = { km: s.km, cid: s.cell_id, rail: null, railHi: null, tn: null, tnLo: null, pr: null };
      if (mode === "past") {
        const d = daily?.cells[s.cell_id];
        if (d) Object.assign(base, { tn: d[1][di], rail: d[2][di], pr: d[3][di] });
      } else if (mode === "forecast" && fDay) {
        const c = fDay.cells[s.cell_id];
        if (c) Object.assign(base, { rail: c.rail, tn: c.tmin });
      } else if (clim) {
        const c = clim[s.cell_id];
        Object.assign(base, { rail: mix(c, "rail50"), railHi: mix(c, "rail90"), tn: mix(c, "tn50"), tnLo: mix(c, "tn10") });
      }
      return base;
    });
  }, [route, mode, date, daily, fDay, clim, bl.a, bl.b, bl.t]);

  const ready = pts && pts.some((p) => p.rail !== null);
  const climate = mode === "future" || mode === "recent";
  const heatV = (p: Pt) => (climate ? p.railHi : p.rail);
  const coldV = (p: Pt) => (climate ? p.tnLo : p.tn);
  const best = (f: (p: Pt) => number | null, hi: boolean) => {
    let out: Pt | null = null;
    for (const p of pts ?? []) {
      const v = f(p);
      if (v === null || !Number.isFinite(v)) continue;
      if (!out || (hi ? v > (f(out) as number) : v < (f(out) as number))) out = p;
    }
    return out;
  };
  const hotP = best(heatV, true);
  const coldP = best(coldV, false);
  const wetP = mode === "past" ? best((p) => p.pr, true) : null;
  const hot = hotP ? (heatV(hotP) as number) : null;
  const cold = coldP ? (coldV(coldP) as number) : null;
  const wet = wetP ? (wetP.pr as number) : null;
  const limits = wd ? { repaired: wd.tn_typical + wd.allow.weak, standard: wd.tn_typical + wd.allow.average, modern: wd.tn_typical + wd.allow.strong } : { repaired: 60, standard: 74, modern: 82 };
  const lv = {
    heat: (hot === null ? 0 : hot >= limits.repaired + 6 ? 3 : hot >= limits.repaired ? 2 : hot >= limits.repaired - 10 ? 1 : 0) as Level,
    cold: (cold === null ? 0 : cold <= -15 ? 3 : cold <= -10 ? 2 : cold <= -5 ? 1 : 0) as Level,
    rain: (wet === null ? 0 : wet >= 80 ? 3 : wet >= 50 ? 2 : wet >= 20 ? 1 : 0) as Level,
  };
  const auto: Hazard = lv.rain > Math.max(lv.heat, lv.cold) ? "rain" : lv.cold > lv.heat ? "cold" : "heat";
  const [pick, setPick] = useState<Hazard | null>(null);
  useEffect(() => setPick(null), [date, routeId]);
  const hz: Hazard = pick && (pick !== "rain" || mode === "past") ? pick : auto;
  const focus = hz === "heat" ? hotP : hz === "cold" ? coldP : wetP;
  useEffect(() => {
    if (focus) setFocus({ cellId: focus.cid, indicator: "HOT40", label: `${place.get(focus.cid) ?? ""} area` });
  }, [focus, place, setFocus]);

  if (!routes) return <div className="wrap"><Loading what="routes" /></div>;
  const where = focus ? place.get(focus.cid) ?? "" : "";
  const r0 = (v: number | null) => fmt(v, 0).replace("-", "−");
  const typHot = hotP?.rail ?? null;
  const typCold = coldP?.tn ?? null;

  let headline = "";
  let sub = "";
  if (ready) {
    if (hz === "heat") {
      headline = mode === "past" ? `Rails reached ${r0(hot)} °C` : `Rails up to ${r0(hot)} °C`;
      sub = [climate ? `On a hot day (typical ${r0(typHot)} °C)` : "", `near ${where}`, (hot ?? 0) >= limits.repaired ? "just-repaired track has no margin" : "every track holds"].filter(Boolean).join(" · ");
    } else if (hz === "cold") {
      headline = `Down to ${r0(cold)} °C`;
      sub = [climate ? `On a cold night (typical ${r0(typCold)} °C)` : "", `near ${where}`, (cold ?? 9) <= -10 ? "rail can snap" : (cold ?? 9) <= -5 ? "hard frost" : "mild for the track"].filter(Boolean).join(" · ");
    } else {
      headline = `${r0(wet)} mm of rain`;
      sub = [`near ${where}`, (wet ?? 0) >= 50 ? "washout risk" : (wet ?? 0) >= 20 ? "heavy rain" : "normal rain"].join(" · ");
    }
    sub = sub.charAt(0).toUpperCase() + sub.slice(1);
  }
  const level = lv[hz];
  const eyebrow = mode === "past" ? "MEASURED BY NASA" : mode === "forecast" ? "FORECAST" : mode === "recent" ? "TODAY'S CLIMATE" : `CLIMATE PROJECTION · ${year}`;
  const railLine = "Rail = air temperature + sun − wind.";
  const how: string[] =
    mode === "past"
      ? ["NASA POWER measurements for that day.", ...(hz === "heat" ? [railLine] : [])]
      : mode === "forecast"
        ? ["7-day weather forecast (Open-Meteo).", ...(hz === "heat" ? [railLine] : [])]
        : mode === "recent"
          ? ["NASA data for this day are not out yet, so this is today's climate.", "Measured by NASA, 2016–2025."]
          : [`Too far for a forecast: this is the climate of ${year}.`, "Today's climate (NASA) blended with 6 NASA climate models for 2050 and 2090."];

  // chart
  const W = CW;
  const H = CW < 600 ? 170 : 220;
  const len = route?.length_km ?? 1;
  const dom: Record<Hazard, [number, number]> = { heat: [20, 80], cold: [-18, 10], rain: [0, 90] };
  const [y0, y1] = dom[hz];
  const lo = Math.min(y0, ...(pts ?? []).map((p) => (hz === "heat" ? p.rail ?? y0 : hz === "cold" ? coldV(p) ?? y0 : y0)));
  const hi = Math.max(y1, ...(pts ?? []).map((p) => (hz === "heat" ? heatV(p) ?? y1 : hz === "cold" ? p.tn ?? y1 : p.pr ?? y1)));
  const Y = (v: number) => H - 8 - ((v - lo) / (hi - lo)) * (H - 24);
  const X = (km: number) => (km / len) * W;
  const line = (f: (p: Pt) => number | null) =>
    (pts ?? [])
      .filter((p) => f(p) !== null)
      .map((p) => `${X(p.km).toFixed(1)},${Y(f(p) as number).toFixed(1)}`)
      .join(" ");
  const main = hz === "heat" ? (p: Pt) => p.rail : hz === "cold" ? (p: Pt) => p.tn : (p: Pt) => p.pr;
  const extra = climate ? (hz === "heat" ? (p: Pt) => p.railHi : hz === "cold" ? (p: Pt) => p.tnLo : null) : null;
  const refs: { v: number; label: string }[] =
    hz === "heat"
      ? [
          { v: limits.repaired, label: `just repaired ${Math.round(limits.repaired)}°` },
          { v: limits.standard, label: `standard track ${Math.round(limits.standard)}°` },
        ]
      : hz === "cold"
        ? [
            { v: -5, label: "hard frost −5°" },
            { v: -10, label: "rail can snap −10°" },
          ]
        : [
            { v: 20, label: "heavy 20 mm" },
            { v: 50, label: "washout 50 mm" },
          ];
  const refLeft = !!focus && X(focus.km) > W / 2;
  const what = hz === "heat" ? "Rail temperature" : hz === "cold" ? "Coldest temperature" : "Rain";
  const unit = hz === "rain" ? "mm" : "°C";
  // Legend: what the solid and the dashed line mean (climate dates: median and 1-in-10, pipeline/trip_data.py).
  const legend: { dashed: boolean; name: string }[] =
    climate && hz !== "rain"
      ? hz === "cold"
        ? [
            { dashed: false, name: "Typical night" },
            { dashed: true, name: "Cold night" },
          ]
        : [
            { dashed: false, name: "Typical day" },
            { dashed: true, name: "Hot day" },
          ]
      : [{ dashed: false, name: mode === "forecast" ? "Forecast" : "Measured" }];

  const chips: { h: Hazard; icon: ReactNode; text: string }[] = [
    { h: "heat", icon: <Flame size={14} />, text: hot === null ? "–" : `${r0(hot)}°` },
    { h: "cold", icon: <Snowflake size={14} />, text: cold === null ? "–" : `${r0(cold)}°` },
    ...(mode === "past" ? [{ h: "rain" as Hazard, icon: <CloudRain size={14} />, text: wet === null ? "–" : `${r0(wet)} mm` }] : []),
  ];

  return (
    <div className="wrap tp" style={{ paddingTop: 32 }}>
      <form className="row" style={{ gap: 14, alignItems: "flex-end" }} onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          Route
          <select value={routeId} onChange={(e) => set({ route: e.target.value })} style={{ minWidth: 240 }}>
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <input type="date" value={date} min="1981-01-01" max="2100-12-31" onChange={(e) => e.target.value && set({ date: e.target.value })} />
        </label>
      </form>

      {route && (
        <>
          <div style={{ marginTop: 34 }}>
            <div className="eyebrow">{eyebrow}</div>
            {ready ? (
              <>
                <h1 style={{ marginTop: 8, fontSize: "clamp(2.2rem, 4.4vw, 3.4rem)" }}>{headline}</h1>
                <p className="lead" style={{ marginTop: 8 }}>{sub}</p>
              </>
            ) : (
              <p className="lead" style={{ marginTop: 12 }}>Loading…</p>
            )}
          </div>

          {ready && (
            <>
              <div className="card tp-chart" data-tour="trip-strip">
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <span className="small ink2">{what} along the line</span>
                  <div className="zone-tabs tp-tabs" role="tablist" aria-label="What to show">
                    {chips.map((c) => (
                      <button key={c.h} role="tab" aria-selected={hz === c.h} onClick={() => setPick(c.h)} style={hz === c.h ? { borderColor: HZ_COLOR[c.h], color: HZ_COLOR[c.h] } : undefined}>
                        {c.icon} {c.text}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="tp-legend">
                  {legend.map((l) => (
                    <div key={l.name}>
                      <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true">
                        <line x1={0} x2={24} y1={4} y2={4} stroke={HZ_COLOR[hz]} strokeWidth={l.dashed ? 2 : 3} strokeDasharray={l.dashed ? "5 4" : undefined} />
                      </svg>
                      <span>{l.name}</span>
                    </div>
                  ))}
                </div>
                <div ref={chartRef}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", marginTop: 12 }} role="img" aria-label={`${what} along ${route.name}`}>
                  {refs.map((r) => (
                    <g key={r.v}>
                      <line x1={0} x2={W} y1={Y(r.v)} y2={Y(r.v)} stroke="#c9ccd2" strokeDasharray="4 5" />
                      {/* labels go on the side away from the highlighted point, so they never overlap its value */}
                      <text x={refLeft ? 4 : W - 4} y={Y(r.v) - 5} textAnchor={refLeft ? "start" : "end"} fontSize={12} fill="#646b76" fontFamily="Geist Mono, monospace" stroke="#fff" strokeWidth={4} paintOrder="stroke">
                        {r.label}
                      </text>
                    </g>
                  ))}
                  <polygon points={`0,${H - 8} ${line(main)} ${W},${H - 8}`} fill={HZ_COLOR[hz]} fillOpacity={0.07} />
                  <polyline points={line(main)} fill="none" stroke={HZ_COLOR[hz]} strokeWidth={3} strokeLinejoin="round" />
                  {extra && <polyline points={line(extra)} fill="none" stroke={HZ_COLOR[hz]} strokeWidth={2} strokeDasharray="6 5" strokeLinejoin="round" />}
                  <line x1={0} x2={W} y1={H - 8} y2={H - 8} stroke="#e6e8eb" />
                  {focus && main(focus) !== null && (
                    <g>
                      <circle cx={X(focus.km)} cy={Y((hz === "heat" ? heatV(focus) : hz === "cold" ? coldV(focus) : focus.pr) as number)} r={6} fill={HZ_COLOR[hz]} stroke="#fff" strokeWidth={2} />
                      <text x={X(focus.km) > W * 0.7 ? X(focus.km) - 10 : Math.max(30, X(focus.km))} y={Y((hz === "heat" ? heatV(focus) : hz === "cold" ? coldV(focus) : focus.pr) as number) - 12} textAnchor={X(focus.km) > W * 0.7 ? "end" : "middle"} fontSize={15} fontWeight={700} fill="#0c0d0f" stroke="#fff" strokeWidth={4} paintOrder="stroke">
                        {r0((hz === "heat" ? heatV(focus) : hz === "cold" ? coldV(focus) : focus.pr) as number)} {unit}
                      </text>
                    </g>
                  )}
                </svg>
                </div>
                <div style={{ position: "relative", height: 46, marginTop: 4 }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: 7, borderTop: "2px solid var(--ink)" }} />
                  {route.stations.map((s, i) => {
                    const last = i === route.stations.length - 1;
                    return (
                      <div key={s.name + i} style={{ position: "absolute", left: `${(100 * s.km) / len}%`, transform: `translateX(${i === 0 ? 0 : last ? -100 : -50}%)`, display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : last ? "flex-end" : "center", gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2px solid var(--ink)" }} />
                        {(i === 0 || last || W >= 600) && (
                          <span className="small" style={{ fontWeight: 550, whiteSpace: "nowrap" }}>
                            {clean(s.name)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="tp-grid" data-tour="trip-cards">
                <div className="card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="small ink2">Will the track hold?</span>
                    <span className="dlevel" style={{ color: LEVEL_COL[level], background: LEVEL_BG[level] }}>
                      {LEVEL_TXT[level]}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {hz === "heat" ? <RailScene hazard="heat" rail={hot ?? 20} limit={limits.repaired} /> : hz === "cold" ? <RailScene hazard="cold" cold={cold ?? 5} /> : <RailScene hazard="rain" rain={wet ?? 0} />}
                  </div>
                  {hz === "heat" && hot !== null && (
                    <div className="tp-rows">
                      {(
                        [
                          ["Just repaired", limits.repaired],
                          ["Standard track", limits.standard],
                          ["Modern track", limits.modern],
                        ] as [string, number][]
                      ).map(([name, lim]) => {
                        const m = lim - hot;
                        const [t, c] = m < 0 ? ["No margin", "#d63a2f"] : m < 6 ? ["Tight", "#b7791f"] : ["Holds", "#1e8e4e"];
                        return (
                          <div key={name}>
                            <span>
                              {name} <em>{Math.round(lim)} °C</em>
                            </span>
                            <b style={{ color: c }}>{t}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {hz === "cold" && cold !== null && (
                    <div className="tp-rows">
                      <div>
                        <span>
                          Welded rail <em>snaps ~−10 °C</em>
                        </span>
                        <b style={{ color: cold <= -10 ? "#d63a2f" : cold <= -5 ? "#b7791f" : "#1e8e4e" }}>{cold <= -10 ? "Can snap" : cold <= -5 ? "Hard frost" : "Fine"}</b>
                      </div>
                    </div>
                  )}
                  {hz === "rain" && wet !== null && (
                    <div className="tp-rows">
                      <div>
                        <span>
                          Ballast <em>washout from 50 mm</em>
                        </span>
                        <b style={{ color: wet >= 50 ? "#d63a2f" : wet >= 20 ? "#b7791f" : "#1e8e4e" }}>{wet >= 50 ? "Washout risk" : wet >= 20 ? "Heavy rain" : "Fine"}</b>
                      </div>
                    </div>
                  )}
                </div>
                <div className="card soft">
                  <div className="small ink2" style={{ fontWeight: 600 }}>
                    How do we know?
                  </div>
                  <ul className="tp-how">
                    {how.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                  <p className="tiny muted" style={{ marginTop: 12 }}>
                    Estimate, not an operational alert.
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <ExpertButton tab="model">Expert details{where ? ` · ${where}` : ""}</ExpertButton>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
