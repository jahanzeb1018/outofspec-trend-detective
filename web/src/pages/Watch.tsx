import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { SpainMap, type Pulse } from "../components/SpainMap";
import { RailScene } from "../components/RailScene";
import { StatusChip } from "../components/ui";
import { fmt } from "../config";
import { useJson } from "../data/load";
import { useWatch, worstByCell } from "../data/forecast";
import { isAlert, isWarmSide, plainStatus, STATUS_COLOR, STATUS_LABEL, STATUS_RANK, type Status, type WatchData } from "../model/watch";
import { useFocus } from "../state/focus";
import { useAssistant } from "../ai/AssistantContext";
import { ExpertButton } from "../components/ExpertDrawer";

type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; lat: number; lon: number; place: string }>;
interface Replays {
  replays: { peak: string; hottest_cell: string; hottest_rail: number; frames: { date: string; network_mean_tmax: number; km: Record<string, number>; cells: Record<string, [number, number, number, Status]> }[] }[];
}
interface CellDay {
  status: Status;
  rail: number;
  pct: number;
  tmax: number;
  tmin: number;
  day: string;
}

const LEGEND: Status[] = ["ok", "unusual-warm", "heat-watch", "heat-warning", "unusual-cold", "cold-watch", "cold-warning"];
const date = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", o);
const short = (iso: string) => date(iso, { weekday: "short", day: "numeric" });
const long = (iso: string) => date(iso, { weekday: "short", day: "numeric", month: "short" });
const withYear = (iso: string) => date(iso, { day: "numeric", month: "short", year: "numeric" });
const rankText = (pct: number) => (pct >= 99.9 ? "among the hottest 0.1% of days here for the season" : `hotter than ${fmt(Math.min(99, Math.floor(pct)), 0)}% of days here for the season`);

export function WatchPage() {
  const watch = useWatch();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const { data: replays } = useJson<Replays>("replays.json");
  const { data: wd } = useJson<WatchData>("watch.json");
  const { setFocus } = useFocus();
  const assistant = useAssistant();
  const [mode, setMode] = useState<"forecast" | "replay">("forecast");
  const [day, setDay] = useState<number>(-1); // -1 = whole week (worst day per section)
  const [rep, setRep] = useState(2);
  const [frame, setFrame] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const info = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (mode === "replay") setFrame((f) => (f + 1) % (replays?.replays[rep]?.frames.length ?? 9));
      else setDay((d) => ((d + 2) % ((watch.data?.days.length ?? 7) + 1)) - 1);
    }, 1100);
    return () => clearInterval(t);
  }, [playing, mode, rep, replays, watch.data]);

  // section -> status for the current view
  const cells: Record<string, CellDay> = useMemo(() => {
    const out: Record<string, CellDay> = {};
    if (mode === "forecast" && watch.data) {
      if (day < 0) {
        const w = worstByCell(watch.data.days);
        for (const [cid, v] of Object.entries(w)) {
          const d = watch.data.days.find((x) => x.date === v.day)!.cells[cid];
          out[cid] = { status: v.status, rail: v.rail, pct: v.pct, tmax: d.tmax, tmin: d.tmin, day: v.day };
        }
      } else {
        const d = watch.data.days[day];
        for (const [cid, v] of Object.entries(d.cells)) out[cid] = { ...v, day: d.date };
      }
    }
    if (mode === "replay" && replays) {
      const f = replays.replays[rep]?.frames[frame];
      if (f) for (const [cid, v] of Object.entries(f.cells)) out[cid] = { tmax: v[0], rail: v[1], pct: v[2], status: v[3], tmin: NaN, day: f.date };
    }
    return out;
  }, [mode, watch.data, day, replays, rep, frame]);

  const kmBy = useMemo(() => {
    const k = Object.fromEntries(Object.keys(STATUS_LABEL).map((s) => [s, 0])) as Record<Status, number>;
    for (const [cid, v] of Object.entries(cells)) k[v.status] += info.get(cid)?.km ?? 0;
    return k;
  }, [cells, info]);
  const ranked = useMemo(
    () =>
      Object.entries(cells)
        .filter(([, v]) => v.status !== "ok")
        .sort((a, b) => STATUS_RANK[b[1].status] - STATUS_RANK[a[1].status] || (isWarmSide(b[1].status) ? b[1].rail - a[1].rail : a[1].tmin - b[1].tmin)),
    [cells],
  );
  const colors = useMemo(() => Object.fromEntries(Object.entries(cells).map(([cid, v]) => [cid, STATUS_COLOR[v.status]])), [cells]);
  const pulses: Pulse[] = ranked
    .filter(([, v]) => isAlert(v.status))
    .slice(0, 50)
    .map(([cid, v]) => ({ lon: info.get(cid)?.lon ?? 0, lat: info.get(cid)?.lat ?? 0, color: STATUS_COLOR[v.status] }))
    .filter((p) => p.lon !== 0);
  const focusCell = sel ?? ranked[0]?.[0] ?? "37.50_-5.625";
  const fc = cells[focusCell];
  const fi = info.get(focusCell);
  useEffect(() => {
    if (fi) setFocus({ cellId: focusCell, indicator: "HOT40", label: `${fi.place} area` });
  }, [focusCell, fi, setFocus]);

  const heatKm = kmBy["heat-watch"] + kmBy["heat-warning"];
  const coldKm = kmBy["cold-watch"] + kmBy["cold-warning"];
  const oddKm = kmBy["unusual-warm"] + kmBy["unusual-cold"];
  const r = replays?.replays[rep];
  const when = mode === "replay" ? "that day" : day < 0 ? "this week" : watch.data ? long(watch.data.days[day].date) : "";
  const status = !watch.data && mode === "forecast" ? "Checking the forecast for every section…" : heatKm ? `Heat watch on ${fmt(heatKm, 0)} km of track ${when}.` : coldKm ? `Cold watch on ${fmt(coldKm, 0)} km of track ${when}.` : `All clear ${when}: no section needs watching.`;
  const bigLabel = mode === "replay" ? (r ? withYear(r.frames[frame]?.date ?? r.peak) : "") : day < 0 ? "This week" : watch.data ? long(watch.data.days[day].date) : "";
  const present = LEGEND.filter((s) => s === "ok" || kmBy[s] > 0);
  const limit = wd ? Math.round(wd.tn_typical + wd.allow.weak) : 60;
  const coldSide = fc ? fc.status !== "ok" && !isWarmSide(fc.status) && Number.isFinite(fc.tmin) : false;
  const latest = replays ? replays.replays.length - 1 : 0;
  const narrow = typeof window !== "undefined" && window.innerWidth < 760;
  // one row per place (an area can span two NASA squares): keep its worst square
  const watchList = useMemo(() => {
    const seen = new Set<string>();
    return ranked.filter(([cid]) => {
      const p = info.get(cid)?.place ?? cid;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  }, [ranked, info]);

  const switchMode = (m: "forecast" | "replay") => {
    setPlaying(false);
    setMode(m);
    setSel(null);
    if (m === "replay") {
      setRep(latest);
      setFrame(4);
    }
  };

  return (
    <div className="wt">
      <div className="hm-box wt-map" data-tour="watch-map">
        <SpainMap segColors={colors} pulses={pulses} selectedCell={focusCell} onSegment={(p) => setSel(p.c)} onCell={(c) => setSel(c)} lineWidth={1.25} pad={narrow ? 16 : { top: 110, bottom: 150, left: 40, right: 40 }} label="Rail heat and cold watch map" />

        <div className="hm-title">
          <h1>{mode === "forecast" ? "Rail watch, next 7 days." : "A real heatwave, day by day."}</h1>
          <p>{status}</p>
          {mode === "forecast" && watch.data && !heatKm && replays && (
            <button className="hm-pill hm-next" onClick={() => switchMode("replay")}>
              <Play size={13} /> See a real heat watch: {withYear(replays.replays[latest].peak)}
            </button>
          )}
        </div>

        <div className="wt-mode seg" role="group" aria-label="Mode">
          <button aria-pressed={mode === "forecast"} onClick={() => switchMode("forecast")}>
            Next 7 days
          </button>
          <button aria-pressed={mode === "replay"} onClick={() => switchMode("replay")}>
            Past heatwaves
          </button>
        </div>

        <div className="hm-year">
          <div className="y wt-y">{bigLabel}</div>
          {mode === "replay" && <span className="tag">replay · NASA data</span>}
          <div className="hm-counts">
            <span className={heatKm ? "on" : ""}>
              <i style={{ background: STATUS_COLOR["heat-warning"] }} />
              <b>{fmt(heatKm, 0)}</b> km heat watch
            </span>
            <span className={coldKm ? "on" : ""}>
              <i style={{ background: STATUS_COLOR["cold-watch"] }} />
              <b>{fmt(coldKm, 0)}</b> km cold watch
            </span>
            <span className={oddKm ? "on" : ""}>
              <i style={{ background: STATUS_COLOR["unusual-warm"] }} />
              <b>{fmt(oddKm, 0)}</b> km unusual for the season
            </span>
          </div>
        </div>

        <div className="hm-time">
          <button className="hm-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {mode === "forecast" && watch.data && (
            <div className="wt-days" role="group" aria-label="Day">
              <button aria-pressed={day === -1} onClick={() => (setPlaying(false), setDay(-1))}>
                Week
              </button>
              {watch.data.days.map((d, i) => (
                <button key={d.date} aria-pressed={day === i} onClick={() => (setPlaying(false), setDay(i))}>
                  {short(d.date)}
                </button>
              ))}
            </div>
          )}
          {mode === "replay" && replays && r && (
            <>
              <div className="wt-days" role="group" aria-label="Heatwave">
                {replays.replays.map((x, i) => (
                  <button key={x.peak} aria-pressed={rep === i} onClick={() => (setRep(i), setFrame(4), setPlaying(false))}>
                    {date(x.peak, { month: "short", year: "numeric" })}
                  </button>
                ))}
              </div>
              <div className="hm-track">
                <input type="range" min={0} max={r.frames.length - 1} value={frame} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} aria-label="Day of the heatwave" />
                <div className="hm-ticks">
                  <span style={{ left: "0%" }}>{date(r.frames[0].date, { day: "numeric", month: "short" })}</span>
                  <span style={{ left: "100%" }}>{date(r.frames[r.frames.length - 1].date, { day: "numeric", month: "short" })}</span>
                </div>
              </div>
            </>
          )}
          <div className="hm-legend wt-legend" aria-label="Legend">
            {present.map((s) => (
              <span key={s}>
                <i className="dot" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <aside className="wt-side" aria-live="polite">
        {fc && fi ? (
          <>
            <div className="eyebrow">{mode === "replay" ? withYear(fc.day) : long(fc.day)}</div>
            <h2 style={{ fontSize: 28, marginTop: 4 }}>{fi.place} area</h2>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <StatusChip s={fc.status} />
              <span className="small muted">{fmt(fi.km, 0)} km of track</span>
            </div>
            <div style={{ marginTop: 12 }}>{coldSide ? <RailScene hazard="cold" cold={fc.tmin} /> : <RailScene hazard="heat" rail={fc.rail} limit={limit} />}</div>
            <div className="wt-nums">
              {coldSide ? (
                <div>
                  <span>Coldest night</span>
                  <b style={{ color: "var(--cold)" }}>{fmt(fc.tmin, 0)} °C</b>
                </div>
              ) : (
                <>
                  <div>
                    <span>Rail in the sun</span>
                    <b style={{ color: fc.rail >= limit ? "var(--heat-4)" : undefined }}>{fmt(fc.rail, 0)} °C</b>
                    <em>limit ~{limit} °C if just repaired</em>
                  </div>
                  <div>
                    <span>Hottest air</span>
                    <b>{fmt(fc.tmax, 0)} °C</b>
                    <em>{rankText(fc.pct)}</em>
                  </div>
                </>
              )}
            </div>
            <p className="wt-say">{plainStatus(fc.status, fc)}</p>
            <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              data-tour="watch-brief"
              onClick={() =>
                assistant.explain({
                  kind: "facts",
                  title: `${fi.place} area · ${mode === "replay" ? withYear(fc.day) : long(fc.day)}`,
                  facts: { place: `${fi.place} area`, day: fc.day, view: mode === "replay" ? "replay of a past heatwave (NASA data)" : "7-day forecast", status: STATUS_LABEL[fc.status], rail_temp_c: Math.round(fc.rail), just_repaired_track_holds_c: limit, max_air_c: Math.round(fc.tmax), percentile_for_season_since_1981: Math.round(fc.pct), min_air_c: Number.isFinite(fc.tmin) ? Math.round(fc.tmin) : null, source: "forecast: Open-Meteo; climate record: NASA POWER (MERRA-2) since 1981; rail limits after the US FRA" },
                  fallback: plainStatus(fc.status, fc),
                })
              }
            >
              <Sparkles size={14} /> Explain it
            </button>
            <ExpertButton tab="model" />
            </div>
          </>
        ) : (
          <p className="small muted">{mode === "forecast" && !watch.data ? "Loading the forecast…" : "Click a line on the map."}</p>
        )}

        <div className="wt-list">
          <div className="small ink2" style={{ fontWeight: 600 }}>
            {heatKm || coldKm ? "Where to watch" : "Unusual for the season"} {when}
          </div>
          {watchList.length === 0 ? (
            <p className="small muted" style={{ marginTop: 6 }}>
              Nothing unusual for the season.
            </p>
          ) : (
            watchList.slice(0, 5).map(([cid, v]) => (
              <button key={cid} className={cid === focusCell ? "on" : ""} onClick={() => setSel(cid)}>
                <i style={{ background: STATUS_COLOR[v.status] }} />
                <b>{info.get(cid)?.place}</b>
                <span>{mode === "replay" ? "" : short(v.day)}</span>
                <em>{STATUS_LABEL[v.status]}</em>
              </button>
            ))
          )}
        </div>
        <p className="tiny muted" style={{ marginTop: 14 }}>
          Screening estimate from public data (forecast: Open-Meteo; record: NASA POWER since 1981; rail limits: US FRA). Not an operational alert.
        </p>
      </aside>
    </div>
  );
}
