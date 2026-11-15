import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Globe2, LocateFixed, Map as MapIcon, RotateCcw } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { heatColor } from "../colors";
import { fmt } from "../config";
import { useAnnual, useJson, useSummary } from "../data/load";
import type { SegmentProps } from "../data/types";
import { useAssistant } from "../ai/AssistantContext";
import { findRoute, findSpanishCell, findWorldPlace, norm } from "../ai/knowledge";
import { parseDate } from "../v2/kit";

type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; lat: number; lon: number; place: string }>;
const SEEN = "oos-intro-v2";
const FRAME_MS = 260;

const EXAMPLES = ["Madrid to Sevilla on 15 July", "Is it getting hotter near Córdoba?", "Will the tracks near Zaragoza hold?"];

export function StartPage() {
  const navigate = useNavigate();
  const assistant = useAssistant();
  const { data: annual } = useAnnual();
  const { data: summary } = useSummary();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const info = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);
  const totalKm = useMemo(() => [...info.values()].reduce((s, c) => s + c.km, 0), [info]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const seen = (() => {
    try {
      return sessionStorage.getItem(SEEN) === "1";
    } catch {
      return false;
    }
  })();

  const years = annual?.years ?? [];
  const nFrames = years.length + 1; // + 2050 projection
  const [f, setF] = useState(-1); // -1 = not started
  const [playing, setPlaying] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<SegmentProps | null>(null);
  const [copy2, setCopy2] = useState(false);
  const started = useRef(false);

  // start (or jump to the end) once data is in
  useEffect(() => {
    if (!annual || !summary || started.current) return;
    started.current = true;
    if (seen || reduce) {
      setF(nFrames - 1);
      setCopy2(true);
    } else {
      setF(0);
      setPlaying(true);
    }
  }, [annual, summary, seen, reduce, nFrames]);
  useEffect(() => {
    if (!playing) return;
    const t1 = setTimeout(() => setCopy2(true), 1800);
    const t = setInterval(() => {
      setF((x) => {
        if (x >= nFrames - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, FRAME_MS);
    return () => (clearInterval(t), clearTimeout(t1));
  }, [playing, nFrames]);
  const done = f === nFrames - 1 && !playing;
  useEffect(() => {
    if (done)
      try {
        sessionStorage.setItem(SEEN, "1");
      } catch {
        /* storage unavailable */
      }
  }, [done]);

  // colours and counters for the current frame
  const frame = useMemo(() => {
    if (!annual || !summary || f < 0) return null;
    const proj = f >= years.length;
    const colors: Record<string, string> = {};
    let km = 0;
    for (const cid of Object.keys(summary.cells)) {
      const v = proj ? summary.cells[cid].HOT40?.fut?.ssp245?.["2041-2060"]?.[0] ?? null : annual.values.HOT40?.[cid]?.[f] ?? null;
      if (v !== null && v >= 0.5) {
        colors[cid] = heatColor(v);
        km += info.get(cid)?.km ?? 0;
      }
    }
    return { proj, label: proj ? "2050" : String(years[f]), colors, km };
  }, [annual, summary, f, years, info]);

  const stats = useMemo(() => {
    if (!annual || !summary) return null;
    const kmYear = (i: number) => Object.keys(summary.cells).reduce((s, cid) => s + ((annual.values.HOT40?.[cid]?.[i] ?? 0) >= 0.5 ? info.get(cid)?.km ?? 0 : 0), 0);
    const last = years.length - 1;
    const e = years.slice(0, 10).map((_, i) => kmYear(i));
    return { last: years[last], kmLast: kmYear(last), km80s: e.reduce((a, b) => a + b, 0) / e.length };
  }, [annual, summary, years, info]);

  async function go(text: string) {
    const t = norm(text);
    if (!t.trim()) return;
    setBusy(true);
    try {
      if (/(this week|esta semana|alert|alerta|watch|forecast|prevision|today|hoy)/.test(t)) return navigate("/watch");
      const route = await findRoute(text);
      if (route) {
        const d = parseDate(text);
        return navigate(`/case/trip/${route.route_id}${d ? `?date=${d}` : ""}`);
      }
      const cell = await findSpanishCell(text);
      if (cell) return navigate(`/case/${cell.cell}`);
      const wp = await findWorldPlace(text);
      if (wp) return navigate(`/detective?lat=${wp.lat}&lon=${wp.lon}&place=${encodeURIComponent(`${wp.n}, ${wp.c}`)}&param=T2M_MAX&ind=ge%3A35`);
      if (/(map|mapa)/.test(t)) return navigate("/maps");
      if (/(2050|2100|future|futuro)/.test(t)) return navigate("/network");
      assistant.ask(text);
    } finally {
      setBusy(false);
    }
  }

  function nearMe() {
    if (!navigator.geolocation || !summary) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: la, longitude: lo } = pos.coords;
        let best: [string, number] | null = null;
        for (const cid of Object.keys(summary.cells)) {
          const [a, b] = cid.split("_").map(Number);
          const d = Math.hypot(a - la, (b - lo) * Math.cos((la * Math.PI) / 180));
          if (!best || d < best[1]) best = [cid, d];
        }
        if (best && best[1] < 0.7) navigate(`/case/${best[0]}`);
        else navigate(`/detective?lat=${la.toFixed(3)}&lon=${lo.toFixed(3)}&place=${encodeURIComponent("Your location")}&param=T2M_MAX&ind=ge%3A35`);
      },
      () => navigate("/maps"),
      { timeout: 8000 },
    );
  }

  const narrow = typeof window !== "undefined" && window.innerWidth < 760;
  const pad = narrow ? { top: 190, bottom: 360, left: 8, right: 8 } : { top: 80, bottom: 260, left: Math.min(480, window.innerWidth * 0.33), right: Math.min(340, window.innerWidth * 0.24) };
  const selInfo = sel ? info.get(sel.c) : null;
  const selHot = sel && summary ? summary.cells[sel.c]?.HOT40?.late : null;

  return (
    <div className={`stage${done ? " done" : ""}`}>
      <SpainMap
        className="map"
        segColors={frame?.colors ?? null}
        glow
        lineWidth={1.15}
        pad={pad}
        nav={narrow ? "none" : "bottom-left"}
        selectedSegment={sel?.id ?? null}
        onSegment={(p) => done && setSel(p)}
        label="Spain's railway lighting up in each year it reached 40 °C"
      />
      <div className="stage-copy">
        <h1 className="rise">Since 1981, NASA has measured the heat over every kilometre of Spain's railway.</h1>
        {copy2 && <p className="rise">Each section lights up in the years it reached 40 °C — air hot enough to push the rails towards 60 °C.</p>}
      </div>
      {frame && (
        <div className="yearbox" aria-live="off">
          <div className={`y ${frame.proj ? "proj" : ""}`}>{frame.label}</div>
          <div className="c">
            {frame.proj ? "projection · intermediate emissions · " : ""}
            <b>{fmt(frame.km, 0)}</b> / {fmt(totalKm, 0)} km over 40 °C
          </div>
          {done && (
            <button className="btn small ghost noprint" style={{ pointerEvents: "auto", marginTop: 8 }} onClick={() => (setF(0), setPlaying(true), setSel(null))}>
              <RotateCcw size={13} /> Replay
            </button>
          )}
        </div>
      )}
      {!done && f >= 0 && (
        <button className="btn skip" onClick={() => (setF(nFrames - 1), setPlaying(false), setCopy2(true))}>
          Skip <ArrowRight size={15} />
        </button>
      )}
      {done && (
        <div className="askpanel">
          {sel && selInfo && (
            <div className="sheet">
              <div>
                <div className="t">{selInfo.place} area</div>
                <div className="s">{fmt(selHot, selHot !== null && selHot !== undefined && selHot < 10 ? 1 : 0)} days ≥ 40 °C a year · {sel.n || "railway"}</div>
              </div>
              <button className="btn hot small" onClick={() => navigate(`/case/${sel.c}`)}>
                Investigate {selInfo.place} <ArrowRight size={14} />
              </button>
              <button className="round" style={{ width: 34, height: 34 }} onClick={() => setSel(null)} aria-label="Close">
                ×
              </button>
            </div>
          )}
          {stats && (
            <div className="kicker">
              In {stats.last}, {fmt(stats.kmLast, 0)} km of track hit 40 °C. In the 1980s: about {fmt(stats.km80s, 0)} km a year.
            </div>
          )}
          <h2>Where does your train go?</h2>
          <form
            className="askbig"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              go(q);
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A trip, a town or a line…" aria-label="A trip, a town or a line" autoFocus={!narrow} />
            <button type="submit" disabled={busy || !q.trim()} aria-label="Investigate">
              <ArrowRight size={20} />
            </button>
          </form>
          <div className="examples">
            <span>For example:</span>
            {EXAMPLES.map((x) => (
              <button key={x} onClick={() => (setQ(x), go(x))}>
                «{x}»
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="pill" onClick={nearMe}>
              <LocateFixed size={15} /> Near me
            </button>
            <button className="pill" onClick={() => navigate("/watch")}>
              <span className="live-dot" /> This week's heat watch
            </button>
            <button className="pill" onClick={() => navigate("/maps")}>
              <MapIcon size={15} /> Railway maps
            </button>
            <button className="pill" onClick={() => navigate("/detective")}>
              <Globe2 size={15} /> Anywhere on Earth
            </button>
          </div>
          <div className="fineprint">Independent project with open data from NASA POWER, NASA NEX-GDDP-CMIP6, NOAA and OpenStreetMap. Not an official NASA product.</div>
        </div>
      )}
    </div>
  );
}
