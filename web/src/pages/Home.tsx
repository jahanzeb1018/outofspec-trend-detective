import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, CloudRain, Flame, Pause, Play, Snowflake, Sparkles, X } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { RailScene, type Hazard } from "../components/RailScene";
import { fmt, signed } from "../config";
import { useCell, useJson, useSegments, useSummary } from "../data/load";
import type { SegmentProps } from "../data/types";
import type { WatchData } from "../model/watch";
import { useAssistant } from "../ai/AssistantContext";
import { useFocus } from "../state/focus";
import { FutureSection } from "./HomeFuture";
import { ExpertButton } from "../components/ExpertDrawer";

type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; place: string; lat: number; lon: number }>;
type Series = (number | null)[];
interface Monthly {
  start: string;
  n: number;
  last_day?: string;
  partial?: boolean;
  recent_from?: string;
  cells: Record<string, { tx: Series; rail: Series; tn: Series; pr: Series }>;
  proj: Record<string, Record<string, { tx: number[]; rail: number[] }>>;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const Y0 = 1981;
/** Problem thresholds: rail beyond what freshly repaired track takes; hard frost; a downpour that can wash out ballast. */
const LIM = { heat: 60, cold: -7, rain: 50 };
const HZ_COLOR: Record<Hazard, string> = { heat: "#d63a2f", cold: "#2563eb", rain: "#0d9488" };
const HZ_LABEL: Record<Hazard, string> = { heat: "Rail above 60 °C", cold: "Severe frost (−7 °C or colder)", rain: "Downpour (50 mm or more in a day)" };
const MS = 85; // measured years: one month per step
const PROJ_MS = 500; // a projected typical year (12 months) plays slowly enough to follow each month
/** Pull on a welded rail per °C below its stress-free temperature (UIC60, from the pipeline), and the cold rail-break reference. */
const TENSION_KN_PER_C = 18.56;
const BREAK_AT = -10;
/** About what the network would need by 2041–2060 to keep today's heat margin (network.json, median +2.7 °C). */
const WARM_SHIFT = 3;
const MARKER_STYLE = { heat: { color: HZ_COLOR.heat }, cold: { color: HZ_COLOR.cold, dx: -0.12, dy: -0.08 }, rain: { color: HZ_COLOR.rain, dx: 0.14, dy: 0.08 } };

/** Typical afternoon temperature (mean daily maximum of the month) → colour. */
const TX_STOPS: [number, number[]][] = [
  [-2, [48, 86, 200]],
  [6, [111, 158, 230]],
  [12, [185, 207, 233]],
  [18, [217, 220, 225]],
  [24, [252, 214, 138]],
  [29, [248, 161, 75]],
  [33, [228, 83, 47]],
  [37, [163, 22, 31]],
];
function txColor(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "#d5d8dd";
  if (v <= TX_STOPS[0][0]) return `rgb(${TX_STOPS[0][1].join(",")})`;
  for (let i = 1; i < TX_STOPS.length; i++)
    if (v <= TX_STOPS[i][0]) {
      const [a, ca] = TX_STOPS[i - 1];
      const [b, cb] = TX_STOPS[i];
      const f = (v - a) / (b - a);
      return `rgb(${ca.map((x, k) => Math.round(x + (cb[k] - x) * f)).join(",")})`;
    }
  return `rgb(${TX_STOPS[TX_STOPS.length - 1][1].join(",")})`;
}
const TX_GRADIENT = `linear-gradient(90deg, ${TX_STOPS.map(([v, c]) => `rgb(${c.join(",")}) ${(((v + 2) / 39) * 100).toFixed(0)}%`).join(", ")})`;

/** Frame index → what it shows. Observed months first, then a typical year in 2041–2060 and in 2081–2100. */
function frameOf(f: number, n: number) {
  if (f < n) return { obs: true as const, m: f % 12, year: Y0 + Math.floor(f / 12), per: null as string | null, label: `${MON[f % 12]} ${Y0 + Math.floor(f / 12)}` };
  const k = f - n;
  const per = k < 12 ? "2041-2060" : "2081-2100";
  const year = per === "2041-2060" ? 2050 : 2090;
  return { obs: false as const, m: k % 12, year, per: per as string | null, label: `${MON[k % 12]} ${year}` };
}
const indexOf = (year: number, m: number, n: number) => (year === 2050 ? n + m : year === 2090 ? n + 12 + m : (year - Y0) * 12 + m);

export function HomePage() {
  const { data: summary } = useSummary();
  const { data: monthly } = useJson<Monthly>("monthly.json");
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const { data: wd } = useJson<WatchData>("watch.json");
  const info = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);
  const totalKm = useMemo(() => [...info.values()].reduce((s, c) => s + c.km, 0), [info]);

  const n = monthly?.n ?? 540;
  const total = n + 24;
  const [f, setF] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fast, setFast] = useState(false);
  const stopAt = useRef(-1); // the first run stops at Dec 2025; play again continues into the projected years
  const inProj = f >= n;
  useEffect(() => {
    if (!playing || !monthly) return;
    if (stopAt.current < 0) stopAt.current = n - 1;
    // measured years: 1 or 3 months per step; a projected year: always month by month, 3× just shortens the step
    const stepBy = inProj ? 1 : fast ? 3 : 1;
    const every = inProj ? (fast ? PROJ_MS / 3 : PROJ_MS) : MS;
    const t = setInterval(() => {
      setF((x) => {
        if (x >= stopAt.current) {
          setPlaying(false);
          return x;
        }
        return Math.min(stopAt.current, x + stepBy);
      });
    }, every);
    return () => clearInterval(t);
  }, [playing, monthly, n, fast, inProj]);
  const fr = frameOf(f, n);
  // where the measured timeline was, to come back to it from a projected year
  const lastObs = useRef(n - 1);
  if (fr.obs) lastObs.current = f;
  const projBase = (y: number) => indexOf(y, 0, n); // January of the typical year 2050 or 2090

  const play = () => {
    if (playing) return setPlaying(false);
    if (fr.obs) {
      // measured years play to the last month; from the last month, play on into 2050 and 2090
      stopAt.current = f >= n - 1 ? total - 1 : n - 1;
    } else {
      // a projected typical year plays to its December, restarting from January when already there
      const base = projBase(fr.year);
      if (f >= base + 11) setF(base);
      stopAt.current = base + 11;
    }
    setPlaying(true);
  };
  /** 2050 / 2090: show the whole typical year, from January to December (not the month of the measured years). */
  const showYear = (y: number) => {
    const base = projBase(y);
    setF(base);
    stopAt.current = base + 11;
    setPlaying(true);
  };
  const showMeasured = () => {
    setPlaying(false);
    setF(Math.min(lastObs.current, n - 1));
  };
  const frame = useMemo(() => {
    if (!monthly) return null;
    const colors: Record<string, string> = {};
    const markers: string[] = [];
    const km = { heat: 0, cold: 0, rain: 0 };
    for (const [cid, c] of Object.entries(monthly.cells)) {
      const p = fr.obs ? null : monthly.proj[fr.per as string]?.[cid];
      const tx = fr.obs ? c.tx[f] : p?.tx[fr.m];
      const rail = fr.obs ? c.rail[f] : p?.rail[fr.m];
      const tn = fr.obs ? c.tn[f] : null;
      const pr = fr.obs ? c.pr[f] : null;
      colors[cid] = txColor(tx);
      const k = info.get(cid)?.km ?? 0;
      if (rail !== null && rail !== undefined && rail >= LIM.heat) {
        km.heat += k;
        markers.push(`${cid}|heat`);
      }
      if (tn !== null && tn <= LIM.cold) {
        km.cold += k;
        markers.push(`${cid}|cold`);
      }
      if (pr !== null && pr >= LIM.rain) {
        km.rain += k;
        markers.push(`${cid}|rain`);
      }
    }
    return { colors, markers, km };
  }, [monthly, f, fr.obs, fr.per, fr.m, info]);

  // selection
  const [sel, setSel] = useState<{ seg: SegmentProps; origin: number } | null>(null);
  const cid = sel?.seg.c ?? null;
  const pick = (p: SegmentProps) => {
    setSel({ seg: p, origin: f });
    setPlaying(false);
  };
  const fit = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!cid) return null;
    const [la, lo] = cid.split("_").map(Number);
    return [
      [lo - 2.2, la - 1.6],
      [lo + 2.2, la + 1.6],
    ];
  }, [cid]);
  const narrow = typeof window !== "undefined" && window.innerWidth < 760;
  const pad = narrow ? 16 : cid ? { top: 70, bottom: 150, left: 40, right: 470 } : { top: 120, bottom: 150, left: 40, right: 40 };

  const lastYear = Y0 + Math.floor((n - 1) / 12);
  const yearTicks = [1981, 1990, 2000, 2010, lastYear];
  const lastDay = monthly?.last_day ? new Date(monthly.last_day + "T12:00:00") : null;
  const lastDayLabel = lastDay ? lastDay.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "2025";
  const recentYear = Number((monthly?.recent_from ?? "9999").slice(0, 4));
  return (
    <div className="homemap">
      <div className="hm-box" data-tour="map">
        <SpainMap fastColors={frame?.colors ?? null} markers={frame?.markers ?? null} markerStyle={MARKER_STYLE} selectedCell={cid} onSegment={pick} fit={fit} pad={pad} lineWidth={1.25} label="Spain's railway coloured by each month's typical afternoon temperature, with heat, frost and heavy-rain problems marked" />

        <div className="hm-title">
          <h1>Spain's railway, month by month.</h1>
          <p>Lines show each month's typical afternoon temperature. Pulsing dots mark where the track was in trouble: heat, frost or a downpour. NASA data, January 1981 to {lastDayLabel}.</p>
          <button className="hm-pill hm-next" onClick={() => document.getElementById("future")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            The future: 2050 and 2090 <ArrowDown size={13} />
          </button>
        </div>

        {!sel && <div className="hm-hint">Click any line: rails, danger and trend</div>}

        {frame && (
          <div className="hm-year" aria-live="off">
            <div className={`y ${fr.obs ? "" : "proj"}`}>{fr.label}</div>
            {!fr.obs && <span className="tag">typical year · projection</span>}
            {fr.obs && fr.year >= recentYear && (
              <span className="tag live" title="NASA POWER near-real-time data (GEOS-IT); may be revised when MERRA-2 catches up">
                {f === n - 1 && monthly?.partial && lastDay ? `so far · to ${lastDay.getDate()} ${MON[lastDay.getMonth()]}` : "near real time"}
              </span>
            )}
            <div className="hm-counts">
              {(["heat", "cold", "rain"] as Hazard[]).map((h) => (
                <span key={h} className={frame.km[h] > 0 ? "on" : ""}>
                  <i style={{ background: HZ_COLOR[h] }} />
                  <b>{fmt(frame.km[h], 0)}</b> km {h === "heat" ? "over 60 °C" : h === "cold" ? "severe frost" : "downpour"}
                </span>
              ))}
            </div>
            <div className="tiny muted" style={{ marginTop: 4 }}>of {fmt(totalKm, 0)} km of track</div>
          </div>
        )}

        <div className="hm-time" style={cid && !narrow ? { right: 456 } : undefined}>
          <button className="hm-play" onClick={play} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="hm-speed" onClick={() => setFast((v) => !v)} aria-label={`Speed ${fast ? "3×" : "1×"}`} title="Speed">
            {fast ? "3×" : "1×"}
          </button>
          <div className="hm-track">
            {fr.obs ? (
              <>
                <input type="range" min={0} max={n - 1} value={Math.min(f, n - 1)} onChange={(e) => (setPlaying(false), setF(Number(e.target.value)))} aria-label="Month" />
                <div className="hm-ticks">
                  {/* with the side panel open the bar is short: first and last year only, so the labels never overlap */}
                  {(cid && !narrow ? [Y0, lastYear] : yearTicks).map((y) => (
                    <span key={y} style={{ left: `${((y === lastYear ? n - 1 : (y - Y0) * 12) / Math.max(1, n - 1)) * 100}%` }}>{y}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <input type="range" min={0} max={11} value={fr.m} onChange={(e) => (setPlaying(false), setF(indexOf(fr.year, Number(e.target.value), n)))} aria-label={`Month of a typical year in ${fr.year}`} />
                <div className="hm-ticks">
                  {[0, 3, 6, 9, 11].map((m) => (
                    <span key={m} style={{ left: `${(m / 11) * 100}%` }}>{m === 0 ? `${MON[m]} ${fr.year}` : MON[m]}</span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="hm-proj" role="group" aria-label="Period">
            <button className="obs" aria-pressed={fr.obs} onClick={showMeasured} title="Measured by NASA, month by month">
              {Y0}–{lastYear}
            </button>
            {[2050, 2090].map((y) => (
              <button key={y} aria-pressed={!fr.obs && fr.year === y} onClick={() => showYear(y)} title={`A typical year around ${y}, January to December (climate models)`}>
                {y}
              </button>
            ))}
          </div>
          <div className="hm-legend" aria-label="Legend">
            <span className="grad" title="Typical afternoon temperature of the month">
              <span style={{ background: TX_GRADIENT }} />
              <em>0°</em>
              <em>36°</em>
            </span>
            {(["heat", "cold", "rain"] as Hazard[]).map((h) => (
              <span key={h} title={HZ_LABEL[h]}>
                <i className="dot" style={{ background: HZ_COLOR[h] }} />
                {h === "heat" ? "Heat" : h === "cold" ? "Frost" : "Rain"}
              </span>
            ))}
          </div>
        </div>

        {sel && cid && summary && wd && monthly && (
          <Zone key={cid} seg={sel.seg} cid={cid} place={info.get(cid)?.place ?? ""} km={info.get(cid)?.km ?? 0} wd={wd} monthly={monthly} f={f} origin={sel.origin} onClose={() => setSel(null)} />
        )}
      </div>
      <FutureSection info={info} />
    </div>
  );
}

type Tri = { past: number | null; now: number | null; fut: number | null };
type Level = "low" | "moderate" | "high" | "severe";
const LEVEL: Record<Level, { label: string; color: string; bg: string }> = {
  low: { label: "Low danger", color: "#1e8e4e", bg: "#e7f4ec" },
  moderate: { label: "Moderate danger", color: "#b7791f", bg: "#fdf3dc" },
  high: { label: "High danger", color: "#d63a2f", bg: "#fbe4e2" },
  severe: { label: "Very high danger", color: "#8a1c2b", bg: "#f6dde0" },
};
const LEVEL_SHORT: Record<Level, string> = { low: "Low", moderate: "Moderate", high: "High", severe: "Very high" };

/** A danger scale: where each level starts, for one track condition. `up` = danger grows with the value (heat, rain). */
interface Scale {
  key: string;
  label: string;
  sub: string;
  cuts: [number, number, number]; // start of moderate, high, severe
  up: boolean;
}
function levelOf(v: number, s: Scale): Level {
  const [a, b, c] = s.cuts;
  if (s.up) return v >= c ? "severe" : v >= b ? "high" : v >= a ? "moderate" : "low";
  return v <= c ? "severe" : v <= b ? "high" : v <= a ? "moderate" : "low";
}

/** One row per track condition: the coloured danger zones for that condition and where this month's value sits. */
function DangerBars({ value, unit, min, max, scales, selected, onSelect }: { value: number | null; unit: string; min: number; max: number; scales: Scale[]; selected: string; onSelect?: (k: string) => void }) {
  const pct = (v: number) => ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100;
  return (
    <div className="dbars">
      {scales.map((s) => {
        const [a, b, c] = s.cuts;
        const stops = s.up
          ? [
              ["low", min, a],
              ["moderate", a, b],
              ["high", b, c],
              ["severe", c, max],
            ]
          : [
              ["severe", min, c],
              ["high", c, b],
              ["moderate", b, a],
              ["low", a, max],
            ];
        const lv = value === null ? null : levelOf(value, s);
        const on = s.key === selected;
        const Row = onSelect ? "button" : "div";
        return (
          <Row key={s.key} className={`dbar ${on ? "on" : ""}`} onClick={onSelect ? () => onSelect(s.key) : undefined} aria-pressed={onSelect ? on : undefined} type={onSelect ? "button" : undefined}>
            <span className="dl">
              <b>{s.label}</b>
              <span>{s.sub}</span>
            </span>
            <span className="dt">
              {stops.map(([k, from, to]) => (
                <i key={k as string} style={{ left: `${pct(from as number)}%`, width: `${pct(to as number) - pct(from as number)}%`, background: LEVEL[k as Level].color }} />
              ))}
              {value !== null && <em style={{ left: `${pct(value)}%` }} />}
            </span>
            <span className="dv" style={lv ? { color: LEVEL[lv].color, background: LEVEL[lv].bg } : undefined}>
              {lv ? LEVEL_SHORT[lv] : "–"}
            </span>
          </Row>
        );
      })}
      <div className="dscale">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function Zone({ seg, cid, place, km, wd, monthly, f, origin, onClose }: { seg: SegmentProps; cid: string; place: string; km: number; wd: WatchData; monthly: Monthly; f: number; origin: number; onClose: () => void }) {
  const { data: summary } = useSummary();
  const { data: segFc } = useSegments();
  const assistant = useAssistant();
  const { setFocus } = useFocus();
  const n = monthly.n;
  const mc = monthly.cells[cid];
  // the panel follows the month shown on the map
  const fr = frameOf(f, n);
  const pp = fr.obs ? null : monthly.proj[fr.per as string]?.[cid];
  const here = { rail: (fr.obs ? mc?.rail[f] : pp?.rail[fr.m]) ?? null, tn: fr.obs ? mc?.tn[f] ?? null : null, pr: fr.obs ? mc?.pr[f] ?? null : null };
  const label = `${fr.label}${fr.obs && f === n - 1 && monthly.partial ? " (so far)" : ""}`;
  // open on the problem seen in the month that was clicked
  const [hz, setHz] = useState<Hazard>(() => {
    const o = frameOf(origin, n);
    const pr = o.obs ? mc?.pr[origin] : null;
    const tn = o.obs ? mc?.tn[origin] : null;
    return pr !== null && pr !== undefined && pr >= LIM.rain ? "rain" : tn !== null && tn !== undefined && tn <= LIM.cold ? "cold" : "heat";
  });
  useEffect(() => {
    if (!fr.obs && hz !== "heat") setHz("heat");
  }, [fr.obs, hz]);
  const [track, setTrack] = useState<string>("weak");
  const [laid, setLaid] = useState<string>("std");
  useEffect(() => {
    setFocus({ cellId: cid, segmentId: seg.id, indicator: "RAIL_AM", label: `${place} area` });
  }, [cid, seg.id, place, setFocus]);
  const lines = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of segFc?.features ?? []) if (x.properties.c === cid && x.properties.n) m.set(x.properties.n, (m.get(x.properties.n) ?? 0) + (x.properties.L ?? 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  }, [segFc, cid]);
  const records = useMemo(() => {
    const rec = (s: Series, better: (a: number, b: number) => boolean) => {
      let bi = -1;
      s.forEach((v, i) => {
        if (v !== null && (bi < 0 || better(v, s[bi] as number))) bi = i;
      });
      return bi < 0 ? null : { v: s[bi] as number, label: frameOf(bi, n).label };
    };
    return { heat: rec(mc?.rail ?? [], (a, b) => a > b), cold: rec(mc?.tn ?? [], (a, b) => a < b), rain: rec(mc?.pr ?? [], (a, b) => a > b) };
  }, [mc, n]);

  const c = summary?.cells[cid];
  if (!c || !mc) return null;
  const tri = (r: { early: number | null; late: number | null; fut?: Record<string, Record<string, (number | null)[]>> } | undefined): Tri => ({ past: r?.early ?? null, now: r?.late ?? null, fut: r?.fut?.ssp245?.["2041-2060"]?.[0] ?? null });
  const dfmt = (v: number | null) => (v === null ? "–" : v === 0 ? "0" : fmt(v, v < 10 ? 1 : 0));

  let scene: { rail?: number; limit?: number; cold?: number; rain?: number; breakAt?: number } = {};
  let bars: ReactNode = null;
  let level: Level | null = null;
  let headline = "";
  let detail = "";
  let days: { label: string; v: Tri } = { label: "", v: { past: null, now: null, fut: null } };
  let record = "";
  let facts: Record<string, unknown> = {};
  let trendInd = "HOT40";

  if (hz === "heat") {
    const scales: Scale[] = [
      { key: "weak", label: "Just repaired", sub: `holds ~${Math.round(wd.tn_typical + wd.allow.weak)} °C`, cuts: [wd.tn_typical + wd.allow.weak - 10, wd.tn_typical + wd.allow.weak, wd.tn_typical + wd.allow.weak + 6], up: true },
      { key: "average", label: "Standard", sub: `holds ~${Math.round(wd.tn_typical + wd.allow.average)} °C`, cuts: [wd.tn_typical + wd.allow.average - 10, wd.tn_typical + wd.allow.average, wd.tn_typical + wd.allow.average + 6], up: true },
      { key: "strong", label: "Modern", sub: `holds ~${Math.round(wd.tn_typical + wd.allow.strong)} °C`, cuts: [wd.tn_typical + wd.allow.strong - 10, wd.tn_typical + wd.allow.strong, wd.tn_typical + wd.allow.strong + 6], up: true },
    ];
    const s = scales.find((x) => x.key === track)!;
    const limit = s.cuts[1];
    const r = here.rail;
    scene = { rail: r ?? 20, limit };
    bars = <DangerBars value={r} unit="°" min={20} max={90} scales={scales} selected={track} onSelect={setTrack} />;
    if (r !== null) {
      level = levelOf(r, s);
      const m = Math.round(limit - r);
      headline = fr.obs ? `Rails reached ${r} °C on the hottest afternoon of ${label}.` : `In a typical ${MON[fr.m]} around ${fr.year}, rails would reach about ${r} °C on the hottest afternoon.`;
      detail =
        level === "low"
          ? `${s.label} track holds about ${Math.round(limit)} °C: plenty of margin, the track holds the heat.`
          : level === "moderate"
            ? `Only ${m} °C below what ${s.label.toLowerCase()} track holds: a hotter day or track work could make it move.`
            : level === "high"
              ? `${-m} °C over what ${s.label.toLowerCase()} track holds: it could buckle sideways (a “sun kink”). Speed limits and patrols are usual.`
              : `${-m} °C over what ${s.label.toLowerCase()} track holds: buckling is likely if the track is disturbed.`;
    }
    const h40 = tri(c.HOT40);
    const use35 = Math.max(h40.past ?? 0, h40.now ?? 0, h40.fut ?? 0) < 1;
    days = { label: `Days above ${use35 ? 35 : 40} °C a year`, v: use35 ? tri(c.HOT35) : h40 };
    trendInd = use35 ? "HOT35" : "HOT40";
    record = records.heat ? `Hottest rail since 1981: ${records.heat.v} °C · ${records.heat.label}` : "";
    facts = { hazard: "heat", month: label, hottest_rail_c: r, track: s.label, track_holds_c: Math.round(limit), danger: level };
  } else if (hz === "cold") {
    const mk = (key: string, shift: number, lbl: string): Scale => ({ key, label: lbl, sub: `laid at ${Math.round(wd.tn_typical + shift)} °C`, cuts: [-5, BREAK_AT + shift, BREAK_AT + shift - 5], up: false });
    const scales = [mk("std", 0, "Standard"), mk("warm", WARM_SHIFT, "Laid for heat")];
    const s = scales.find((x) => x.key === laid)!;
    const shift = laid === "warm" ? WARM_SHIFT : 0;
    const t = here.tn;
    scene = { cold: t ?? 5, breakAt: BREAK_AT + shift };
    bars = <DangerBars value={t} unit="°" min={-20} max={10} scales={scales} selected={laid} onSelect={setLaid} />;
    if (t !== null) {
      level = levelOf(t, s);
      const pull = Math.max(0, ((wd.tn_typical + shift - t) * TENSION_KN_PER_C) / 9.81);
      headline = `The coldest night of ${label} went down to ${t} °C.`;
      detail =
        (level === "low"
          ? "Mild for the track."
          : level === "moderate"
            ? "Hard frost: rails contract and pull hard; points can freeze."
            : level === "high"
              ? "Rail-break risk: welded rail can snap, most often at the welds."
              : "Very high rail-break risk: breaks and frozen points are likely.") + ` Each rail is pulled with about ${fmt(pull, 0)} tonnes${laid === "warm" ? " — more, because it was laid warmer to cope with summer" : ""}.`;
    }
    const c5 = tri(c.COLD5);
    const useFrost = Math.max(c5.past ?? 0, c5.now ?? 0) < 1;
    days = { label: useFrost ? "Frost days a year (below 0 °C)" : "Hard-frost days a year (−5 °C or colder)", v: useFrost ? tri(c.FROST) : c5 };
    trendInd = useFrost ? "FROST" : "COLD5";
    record = records.cold ? `Coldest night since 1981: ${records.cold.v} °C · ${records.cold.label}` : "";
    facts = { hazard: "cold", month: label, coldest_night_c: t, rail_laid_at_c: Math.round(wd.tn_typical + shift), danger: level };
  } else {
    const scales: Scale[] = [{ key: "rain", label: "Any track", sub: "drainage & ballast", cuts: [20, 50, 80], up: true }];
    const p = here.pr;
    scene = { rain: p ?? 0 };
    bars = <DangerBars value={p} unit=" mm" min={0} max={100} scales={scales} selected="rain" />;
    if (p !== null) {
      level = levelOf(p, scales[0]);
      headline = `The wettest day of ${label} brought ${p} mm of rain.`;
      detail =
        level === "low"
          ? "Normal rain for the track."
          : level === "moderate"
            ? "Heavy rain: drains, culverts and cuttings have to cope."
            : level === "high"
              ? "Downpour: water can wash ballast from under the track and flood cuttings."
              : "Extreme downpour: washouts and landslides are likely.";
    }
    const r20 = tri(c.R20);
    days = { label: "Days with 20 mm of rain or more a year", v: { past: r20.past, now: r20.now, fut: null } };
    trendInd = "R20";
    record = records.rain ? `Wettest day since 1981: ${records.rain.v} mm · ${records.rain.label}` : "";
    facts = { hazard: "heavy rain", month: label, wettest_day_mm: p, danger: level };
  }

  const chips: { h: Hazard; icon: ReactNode; text: string; bad: boolean }[] = [
    { h: "heat", icon: <Flame size={13} />, text: here.rail !== null ? `${here.rail}°` : "–", bad: (here.rail ?? 0) >= LIM.heat },
    { h: "cold", icon: <Snowflake size={13} />, text: here.tn !== null ? `${here.tn}°` : "–", bad: here.tn !== null && here.tn <= LIM.cold },
    { h: "rain", icon: <CloudRain size={13} />, text: here.pr !== null ? `${here.pr} mm` : "–", bad: (here.pr ?? 0) >= LIM.rain },
  ];
  const ERA = { past: "1980s", now: "Today", fut: "2050" } as const;

  return (
    <aside className="zone" aria-label={`${place} area`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seg.n || lines[0] || "Railway"}</div>
          <h2 style={{ fontSize: 30, marginTop: 4 }}>{place} area</h2>
          <div className="small muted" style={{ marginTop: 2 }}>
            {fmt(km, 0)} km of track{lines.length > 1 ? ` · ${lines.length} lines` : ""}
          </div>
        </div>
        <button className="btn ghost" onClick={onClose} aria-label="Close" style={{ padding: 6, minHeight: 0 }}>
          <X size={18} />
        </button>
      </div>

      <div className="zone-month">
        <span className="zm-label">{label}</span>
        {!fr.obs && <span className="tag-proj">typical year · projection</span>}
        {chips.map((x) => (
          <button key={x.h} className="zchip" style={x.bad ? { color: HZ_COLOR[x.h], borderColor: HZ_COLOR[x.h], fontWeight: 700 } : undefined} onClick={() => setHz(x.h)} disabled={x.text === "–"} title={HZ_LABEL[x.h]}>
            {x.icon} {x.text}
          </button>
        ))}
      </div>

      <div className="zone-tabs" role="tablist" aria-label="Problem">
        {(["heat", "cold", "rain"] as Hazard[]).map((h) => (
          <button key={h} role="tab" aria-selected={hz === h} onClick={() => setHz(h)} disabled={!fr.obs && h !== "heat"} title={!fr.obs && h !== "heat" ? "Projections cover heat only" : undefined} style={hz === h ? { borderColor: HZ_COLOR[h], color: HZ_COLOR[h] } : undefined}>
            {h === "heat" ? <Flame size={15} /> : h === "cold" ? <Snowflake size={15} /> : <CloudRain size={15} />} {h === "heat" ? "Heat" : h === "cold" ? "Cold" : "Rain"}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <RailScene hazard={hz} {...scene} />
      </div>

      <div className="danger">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="small ink2">How dangerous was it?</span>
          {level && (
            <span className="dlevel" style={{ color: LEVEL[level].color, background: LEVEL[level].bg }}>
              {LEVEL[level].label}
            </span>
          )}
        </div>
        {bars}
        {hz !== "rain" && <div className="tiny muted" style={{ marginTop: 2 }}>{hz === "heat" ? "Tap a track condition to see it drawn." : "Tap an option to see it drawn."}</div>}
        {level ? (
          <p style={{ fontSize: 15.5, lineHeight: 1.55, marginTop: 10 }}>
            <b>{headline}</b> {detail}
          </p>
        ) : (
          <p className="small muted" style={{ marginTop: 10 }}>No data for this month.</p>
        )}
      </div>

      <TrendCheck
        cid={cid}
        ind={trendInd}
        what={days.label.replace(" a year", "")}
        color={HZ_COLOR[hz]}
        footer={
          <>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              {(["past", "now", "fut"] as const)
                .filter((e) => days.v[e] !== null)
                .map((e, i) => (
                  <span key={e} className="row" style={{ gap: 6 }}>
                    {i > 0 && <span className="muted">→</span>}
                    <span className="zd">
                      <b>{dfmt(days.v[e])}</b> <span className="tiny muted">{ERA[e]}</span>
                    </span>
                  </span>
                ))}
            </div>
            {record && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                {record}
              </div>
            )}
          </>
        }
      />

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="btn"
          onClick={() =>
            assistant.explain({
              kind: "facts",
              title: `${place} area · ${label}`,
              facts: { place: `${place} area`, ...facts, [days.label]: days.v, record, source: "NASA POWER (MERRA-2) daily data and NASA NEX-GDDP-CMIP6; rail model and limits after the US FRA" },
              fallback: `${headline} ${detail} ${record}`,
            })
          }
        >
          <Sparkles size={14} /> Explain it
        </button>
        <ExpertButton tab="stats" indicator={trendInd} />
        {hz !== "rain" && (
          <Link className="btn primary" to={hz === "heat" ? `/lab?air=${Math.round((here.rail ?? 57) - 17)}&track=${track === "weak" ? "repaired" : track === "average" ? "standard" : "modern"}` : `/lab?mode=cold&night=${here.tn ?? -8}`}>
            Try it in the lab <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Objectives 3 and 4 of the challenge, in the panel: the 1981–2025 series for this area, its rate of change (Sen's slope)
 *  and whether it is real (Mann-Kendall with the Hamed–Rao correction, plus the classic t-test), from cells/<id>.json. */
function TrendCheck({ cid, ind, what, color, footer }: { cid: string; ind: string; what: string; color: string; footer?: ReactNode }) {
  const { data: cell } = useCell(cid);
  const t = cell?.trends[ind];
  const ys = cell?.indicators[ind];
  if (!cell || !t || !ys) return null;
  const years = cell.years;
  const W = 380;
  const H = 92;
  const base = H - 18;
  const top = Math.max(1, ...ys.map((v) => v ?? 0), t.sen_intercept + t.sen_slope * (ys.length - 1));
  const bw = W / ys.length;
  const y = (v: number) => base - (Math.max(0, v) / top) * (base - 8);
  const perDec = t.sen_slope * 10;
  const real = !t.rare && t.p_mk_hr < 0.05;
  const p = (v: number) => (v < 0.001 ? "< 0.001" : `= ${fmt(v, v < 0.01 ? 4 : 3)}`);
  const unit = what.toLowerCase().startsWith("days") || what.toLowerCase().includes("days") ? "days" : "";
  return (
    <div className="ztrend">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <b className="ztrend-t">Is the trend real?</b>
        <span className={`ztrend-v ${t.rare ? "rare" : real ? "yes" : "no"}`}>{t.rare ? "Too rare to test" : real ? "Real trend" : "Not significant yet"}</span>
      </div>
      <div className="small ink2" style={{ marginTop: 2 }}>
        {what}, every year since {years[0]}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${what}, every year ${years[0]}–${years[years.length - 1]}, with its trend line`} style={{ display: "block", marginTop: 6 }}>
        {ys.map((v, i) =>
          v === null ? null : (
            <rect key={years[i]} x={i * bw + 0.5} y={y(v)} width={Math.max(1, bw - 1.5)} height={base - y(v)} fill="#d5d8dd" rx={1}>
              <title>{`${years[i]}: ${fmt(v, 0)}`}</title>
            </rect>
          ),
        )}
        {!t.rare && <line x1={bw / 2} y1={y(t.sen_intercept)} x2={W - bw / 2} y2={y(t.sen_intercept + t.sen_slope * (ys.length - 1))} stroke={color} strokeWidth={2.5} strokeLinecap="round" />}
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line-2)" />
        <text x={0} y={H - 3} fontSize={11} fill="#646b76" fontFamily="Geist Mono, monospace">
          {years[0]}
        </text>
        <text x={W} y={H - 3} textAnchor="end" fontSize={11} fill="#646b76" fontFamily="Geist Mono, monospace">
          {years[years.length - 1]}
        </text>
      </svg>
      <p className="small" style={{ marginTop: 6, lineHeight: 1.5 }}>
        {t.rare ? (
          <>Too few such days here to measure a trend.</>
        ) : (
          <>
            <b>
              {signed(perDec, Math.abs(perDec) < 1 ? 2 : 1)} {unit} per decade
            </b>{" "}
            <span className="muted">
              · Mann-Kendall p {p(t.p_mk_hr)} · t-test p {p(t.p_ols)}
            </span>
            {!real && <span className="muted"> · could still be chance; a longer record may tell.</span>}
          </>
        )}
      </p>
      {footer}
    </div>
  );
}
