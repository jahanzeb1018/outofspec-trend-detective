import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { SpainMap, type Pulse } from "../components/SpainMap";
import { Loading, Prov, Seg, StatusChip } from "../components/ui";
import { fmt } from "../config";
import { useJson } from "../data/load";
import { useWatch, worstByCell } from "../data/forecast";
import { isAlert, isWarmSide, plainStatus, STATUS_COLOR, STATUS_LABEL, STATUS_RANK, type Status } from "../model/watch";
import { useFocus } from "../state/focus";
import { useAssistant } from "../ai/AssistantContext";

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

const dayLabel = (iso: string, withYear = false) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: withYear ? undefined : "short", day: "numeric", month: "short", year: withYear ? "numeric" : undefined });

export function WatchPage() {
  const watch = useWatch();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const { data: replays } = useJson<Replays>("replays.json");
  const { setFocus } = useFocus();
  const assistant = useAssistant();
  const [mode, setMode] = useState<"forecast" | "replay">("forecast");
  const [day, setDay] = useState<number>(-1); // -1 = whole week (worst)
  const [rep, setRep] = useState(2);
  const [frame, setFrame] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; source: "si" | "rules" } | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const info = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (mode === "replay") setFrame((f) => (f + 1) % (replays?.replays[rep]?.frames.length ?? 9));
      else setDay((d) => ((d + 2) % ((watch.data?.days.length ?? 7) + 1)) - 1);
    }, 1100);
    return () => clearInterval(t);
  }, [playing, mode, rep, replays, watch.data]);
  useEffect(() => {
    setBriefing(null);
  }, [mode, day, rep, frame]);

  // cell -> status for the current view
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
  const pulses: Pulse[] = ranked.filter(([, v]) => isAlert(v.status)).slice(0, 50).map(([cid, v]) => ({ lon: info.get(cid)?.lon ?? 0, lat: info.get(cid)?.lat ?? 0, color: STATUS_COLOR[v.status] })).filter((p) => p.lon !== 0);
  const focusCell = sel ?? ranked[0]?.[0] ?? "37.50_-5.625";
  const fc = cells[focusCell];
  const fi = info.get(focusCell);
  useEffect(() => {
    if (fi) setFocus({ cellId: focusCell, indicator: "HOT40", label: `${fi.place} area` });
  }, [focusCell, fi, setFocus]);

  const heatKm = kmBy["heat-watch"] + kmBy["heat-warning"];
  const coldKm = kmBy["cold-watch"] + kmBy["cold-warning"];
  const warmKm = kmBy["unusual-warm"];
  const coolKm = kmBy["unusual-cold"];
  const r = replays?.replays[rep];
  const headline =
    mode === "replay" && r
      ? `${dayLabel(r.frames[frame]?.date ?? r.peak, true)}: ${fmt(heatKm, 0)} km of track on heat alert${kmBy["heat-warning"] ? ` — ${fmt(kmBy["heat-warning"], 0)} km at warning level` : ""}.`
      : !watch.data
        ? "Checking the forecast for every section…"
        : heatKm
          ? `Heat watch on ${fmt(heatKm, 0)} km of track ${day < 0 ? "this week" : dayLabel(watch.data.days[day].date)}.`
          : coldKm
            ? `Cold watch on ${fmt(coldKm, 0)} km of track ${day < 0 ? "this week" : dayLabel(watch.data.days[day].date)}.`
            : warmKm
              ? `No heat watch ${day < 0 ? "this week" : dayLabel(watch.data.days[day].date)} — but ${fmt(warmKm, 0)} km will be unusually warm for the season.`
              : coolKm
                ? `No watch ${day < 0 ? "this week" : dayLabel(watch.data.days[day].date)} — ${fmt(coolKm, 0)} km unusually cold for the season.`
                : `All clear on the network ${day < 0 ? "this week" : dayLabel(watch.data.days[day].date)}.`;

  const facts = () => ({
    view: mode === "replay" ? `replay of ${r?.frames[frame]?.date}` : day < 0 ? "next 7 days (worst day per section)" : `forecast for ${watch.data?.days[day]?.date}`,
    km_heat_watch: Math.round(kmBy["heat-watch"]),
    km_heat_warning: Math.round(kmBy["heat-warning"]),
    km_cold_watch: Math.round(kmBy["cold-watch"]),
    km_cold_warning: Math.round(kmBy["cold-warning"]),
    km_unusually_warm_for_season_but_no_rail_risk: Math.round(warmKm),
    km_unusually_cold_for_season_above_freezing: Math.round(coolKm),
    top_places: ranked.slice(0, 6).map(([cid, v]) => ({ place: info.get(cid)?.place, day: v.day, status: STATUS_LABEL[v.status], rail_temp_c: Math.round(v.rail), max_air_c: Math.round(v.tmax), percentile_since_1981: Math.round(v.pct), min_air_c: Number.isFinite(v.tmin) ? Math.round(v.tmin) : null })),
  });
  const fallbackBrief = () => {
    const f = facts();
    if (!f.top_places.length) return "No section of the network shows unusual heat or cold for the season in this view. The watch compares each 50 km of track with its own 45-year NASA record.";
    const t = f.top_places[0];
    return `${headline} The strongest signal is near ${t.place} on ${dayLabel(t.day)}: ${t.status.toLowerCase()}, with rail up to ~${t.rail_temp_c} °C${t.percentile_since_1981 >= 90 ? ` (hotter than ${Math.min(99, t.percentile_since_1981)}% of days there for the season since 1981)` : ""}. This is a screening estimate, not an operational alert.`;
  };

  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ maxWidth: 760 }}>
          <div className="eyebrow">{mode === "forecast" ? "LIVE · NEXT 7 DAYS" : "REPLAY · NASA DATA"}</div>
          <h1 style={{ marginTop: 10, fontSize: "clamp(2rem, 4vw, 3rem)" }}>{headline}</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            {mode === "forecast"
              ? "Every 50 km of track, compared with its own 45-year NASA record: where the coming heat (or cold) is unusual, and where recently repaired track would run out of thermal margin."
              : "Re-live the hottest days in the NASA record, day by day, with the estimated rail temperature along the whole network."}
          </p>
          {mode === "forecast" && watch.data && !heatKm && replays && (
            <button className="btn primary" style={{ marginTop: 16 }} onClick={() => (setMode("replay"), setRep(replays.replays.length - 1), setFrame(4), setSel(null), setPlaying(false))}>
              <Play size={14} /> See a real heat watch: replay {dayLabel(replays.replays[replays.replays.length - 1].peak, true)}
            </button>
          )}
        </div>
        <Seg label="Mode" value={mode} onChange={(m) => (setPlaying(false), setMode(m), setSel(null))} options={[{ id: "forecast", label: "Next 7 days" }, { id: "replay", label: "Replay a heatwave" }]} />
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        {mode === "forecast" && watch.data && (
          <Seg
            label="Day"
            value={day}
            onChange={(d) => (setPlaying(false), setDay(d))}
            options={[{ id: -1, label: "This week" }, ...watch.data.days.map((d, i) => ({ id: i, label: dayLabel(d.date) }))]}
          />
        )}
        {mode === "replay" && replays && (
          <>
            <Seg label="Heatwave" value={rep} onChange={(i) => (setRep(i), setFrame(4), setPlaying(false))} options={replays.replays.map((x, i) => ({ id: i, label: dayLabel(x.peak, true) }))} />
            <input type="range" min={0} max={(r?.frames.length ?? 9) - 1} value={frame} onChange={(e) => (setPlaying(false), setFrame(Number(e.target.value)))} aria-label="Day of the heatwave" style={{ width: 220 }} />
            <span className="mono small">{r && dayLabel(r.frames[frame].date)}</span>
          </>
        )}
        <button className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 18 }}>
        <div className="mapcard" style={{ flex: "1 1 620px", minWidth: 0 }} data-tour="watch-map">
          <div className="mapbox" style={{ height: 600 }}>
            {!watch.data && mode === "forecast" && !watch.error ? <Loading what="the forecast" /> : null}
            <SpainMap segColors={colors} pulses={pulses} selectedCell={focusCell} onSegment={(p) => setSel(p.c)} onCell={(c) => setSel(c)} label="Rail heat and cold watch map" />
            {fc && fi && (
              <div className="float" style={{ right: 12, top: 12, width: 270 }} aria-live="polite">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 650, fontSize: 18 }}>{fi.place} area</span>
                  <StatusChip s={fc.status} />
                </div>
                <div className="tiny muted">{dayLabel(fc.day, mode === "replay")} · {fmt(fi.km, 0)} km of track</div>
                <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12, gap: 10 }}>
                  <div className="metric">
                    <div className="l" style={{ marginTop: 0 }}>Rail (sunny)</div>
                    <div className="v" style={{ fontSize: 26, color: fc.rail > 60 ? "var(--heat-4)" : "var(--ink)" }}>{fmt(fc.rail, 0)} °C</div>
                  </div>
                  <div className="metric">
                    <div className="l" style={{ marginTop: 0 }}>Air max · rank</div>
                    <div className="v" style={{ fontSize: 26 }}>{fmt(fc.tmax, 0)}°</div>
                    <div className="tiny muted">{fc.pct >= 99.9 ? "top 0.1% for the season" : `hotter than ${fmt(Math.min(99, fc.pct), 0)}% of days for the season`}</div>
                  </div>
                </div>
                <p className="small ink2" style={{ marginTop: 10 }}>{plainStatus(fc.status, fc)}</p>
              </div>
            )}
          </div>
          <div className="legend-row">
            {(["ok", "unusual-warm", "heat-watch", "heat-warning", "unusual-cold", "cold-watch", "cold-warning"] as Status[]).map((s) => (
              <span key={s}>
                <span className="sw" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <aside style={{ flex: "1 1 360px", minWidth: 0 }} className="stack">
          <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="card" style={{ padding: 16 }}>
              <div className="small muted">Heat watch / warning</div>
              <div className="big" style={{ fontSize: 32, color: heatKm ? "var(--heat-4)" : "var(--ink)" }}>{fmt(heatKm, 0)} km</div>
              {warmKm > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>+ {fmt(warmKm, 0)} km unusually warm</div>}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="small muted">Cold watch / warning</div>
              <div className="big" style={{ fontSize: 32, color: coldKm ? "var(--cold)" : "var(--ink)" }}>{fmt(coldKm, 0)} km</div>
              {coolKm > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>+ {fmt(coolKm, 0)} km unusually cold</div>}
            </div>
          </div>
          <div className="card" style={{ padding: 16 }} data-tour="watch-brief">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>Briefing</b>
              <button
                className="btn"
                style={{ minHeight: 32, padding: "5px 10px", fontSize: 13 }}
                disabled={briefBusy}
                onClick={async () => {
                  setBriefBusy(true);
                  setBriefing(await assistant.brief(facts(), fallbackBrief()));
                  setBriefBusy(false);
                }}
              >
                <Sparkles size={13} /> {briefBusy ? "Writing…" : "Brief me"}
              </button>
            </div>
            {briefing ? (
              <>
                <p style={{ marginTop: 10, lineHeight: 1.55 }}>{briefing.text}</p>
                <div style={{ marginTop: 8 }}>
                  <Prov kind={briefing.source === "si" ? "ai" : "rules"} />
                </div>
              </>
            ) : (
              <p className="small muted" style={{ marginTop: 8 }}>A three-sentence summary of this view, written from the numbers below.</p>
            )}
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <b>Where to watch</b> <span className="small muted">· {ranked.length} sections of ~50 km</span>
            </div>
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              {ranked.length === 0 && <p className="small muted" style={{ padding: 16 }}>Nothing unusual for the season.</p>}
              {ranked.slice(0, 30).map(([cid, v]) => (
                <button key={cid} onClick={() => setSel(cid)} style={{ display: "flex", width: "100%", gap: 12, alignItems: "center", textAlign: "left", border: 0, borderBottom: "1px solid var(--line)", background: cid === focusCell ? "var(--soft-2)" : "transparent", color: "var(--ink)", padding: "11px 16px", cursor: "pointer" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATUS_COLOR[v.status], flex: "0 0 auto" }} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{info.get(cid)?.place}</span> <span className="tiny muted">{dayLabel(v.day, mode === "replay")}</span>
                    <br />
                    <span className="small ink2">{isWarmSide(v.status) ? `rail ~${fmt(v.rail, 0)} °C · ${v.pct >= 99.9 ? "top 0.1%" : `hotter than ${fmt(Math.min(99, v.pct), 0)}% of days`} for the season` : Number.isFinite(v.tmin) ? `min ${fmt(v.tmin, 0)} °C` : ""}</span>
                  </span>
                  <StatusChip s={v.status} />
                </button>
              ))}
            </div>
          </div>
          <p className="note">
            Screening estimate from public data (forecast: Open-Meteo; climate: NASA POWER; rail model and margins: FRA-based). Not an operational alert — infrastructure managers rely on their own measurements. Open the Expert view for the method.
          </p>
        </aside>
      </div>
    </div>
  );
}
