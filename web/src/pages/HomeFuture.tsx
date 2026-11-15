import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pause, Play } from "lucide-react";
import { fmt } from "../config";
import { useSummary } from "../data/load";

/** Days a year at 40 °C or more: measured 1981–1990 and 2016–2025 (NASA POWER), projected 2041–2060 and 2081–2100
 *  (median of the NASA NEX-GDDP-CMIP6 models, SSP2-4.5, delta method; see process.py). One NASA cell per area: the one
 *  with the most track. */
const ERAS = [
  { id: "early", label: "1980s" },
  { id: "late", label: "Today" },
  { id: "2041-2060", label: "2050" },
  { id: "2081-2100", label: "2090" },
] as const;
type Era = (typeof ERAS)[number]["id"];
type Ens = [number | null, number | null, number | null] | null;
const SCEN = "ssp245";
const CITIES = ["Sevilla", "Córdoba", "Badajoz", "Toledo", "Ciudad Real", "Madrid", "Zaragoza", "Murcia", "Valencia", "Granada", "Valladolid", "Barcelona"];
const isFut = (e: Era) => e.startsWith("20");
const days = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v < 0.5 ? "0" : v < 10 ? fmt(v, 1) : fmt(v, 0));

interface Area {
  place: string;
  v: Record<Era, number | null>;
  range: Record<"2041-2060" | "2081-2100", Ens>;
}

/** Start the animation once the section is on screen. */
function useOnScreen<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el || seen) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);
  return [setEl, seen] as const;
}

export function FutureSection({ info }: { info: Map<string, { place: string; km: number }> }) {
  const { data: summary } = useSummary();
  const [era, setEra] = useState<Era>("early");
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [boxRef, seen] = useOnScreen<HTMLElement>();

  useEffect(() => {
    if (seen) setPlaying(true);
  }, [seen]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setEra((e) => {
        const i = ERAS.findIndex((x) => x.id === e);
        if (i >= ERAS.length - 1) {
          setPlaying(false);
          return e;
        }
        return ERAS[i + 1].id;
      });
    }, 1500);
    return () => clearInterval(t);
  }, [playing]);

  const { areas, kmOver } = useMemo(() => {
    const kmOver: Record<Era, number> = { early: 0, late: 0, "2041-2060": 0, "2081-2100": 0 };
    if (!summary) return { areas: [] as Area[], kmOver };
    const best = new Map<string, { c: string; km: number }>();
    for (const [c, p] of info) {
      const b = best.get(p.place);
      if (!b || p.km > b.km) best.set(p.place, { c, km: p.km });
      const r = summary.cells[c]?.HOT40;
      const vals: Record<Era, number | null | undefined> = { early: r?.early, late: r?.late, "2041-2060": r?.fut?.[SCEN]?.["2041-2060"]?.[0], "2081-2100": r?.fut?.[SCEN]?.["2081-2100"]?.[0] };
      for (const e of ERAS) if ((vals[e.id] ?? 0) > 10) kmOver[e.id] += p.km;
    }
    const areas = [...best.entries()]
      .map(([place, b]): Area => {
        const r = summary.cells[b.c]?.HOT40;
        const f = r?.fut?.[SCEN];
        return {
          place,
          v: { early: r?.early ?? null, late: r?.late ?? null, "2041-2060": f?.["2041-2060"]?.[0] ?? null, "2081-2100": f?.["2081-2100"]?.[0] ?? null },
          range: { "2041-2060": (f?.["2041-2060"] as Ens) ?? null, "2081-2100": (f?.["2081-2100"] as Ens) ?? null },
        };
      })
      .sort((a, b) => (b.v["2081-2100"] ?? 0) - (a.v["2081-2100"] ?? 0));
    return { areas, kmOver };
  }, [summary, info]);

  const shown = all ? areas : areas.filter((a) => CITIES.includes(a.place));
  const top = Math.max(10, ...shown.flatMap((a) => ERAS.map((e) => a.v[e.id] ?? 0)));
  const pct = (v: number | null) => `${((v ?? 0) < 0.5 ? 0 : (v as number) / top) * 100}%`;
  const label = ERAS.find((e) => e.id === era)!.label;
  const play = () => {
    if (playing) return setPlaying(false);
    if (era === ERAS[ERAS.length - 1].id) setEra(ERAS[0].id);
    setPlaying(true);
  };

  return (
    <section className="fz" id="future" ref={boxRef} aria-labelledby="fz-title">
      <div className="fz-head">
        <div>
          <h2 id="fz-title">And in the future?</h2>
          <p>Days a year at 40 °C or more. Click a city.</p>
        </div>
        <div className="fz-now">
          <div className={`y ${isFut(era) ? "proj" : ""}`}>{label}</div>
          <div className="c">
            <b>{fmt(kmOver[era], 0)} km</b> of track with more than 10 days a year
          </div>
        </div>
      </div>

      <div className="fz-ctrl">
        <button className="hm-play" onClick={play} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="fz-eras" role="group" aria-label="Period">
          {ERAS.map((e) => (
            <button key={e.id} aria-pressed={era === e.id} className={isFut(e.id) ? "fut" : ""} onClick={() => (setPlaying(false), setEra(e.id))}>
              {e.label}
            </button>
          ))}
        </div>
        <div className="fz-key">
          <span>
            <i style={{ background: "var(--fz-past)" }} /> measured
          </span>
          <span>
            <i style={{ background: "var(--fz-fut)" }} /> projected
          </span>
          {isFut(era) && (
            <span>
              <i className="ghost" /> today
            </span>
          )}
        </div>
      </div>

      <ul className="fz-rows">
        {shown.map((a) => {
          const on = open === a.place;
          return (
            <li key={a.place} className={on ? "open" : ""}>
              <button className="fz-row" onClick={() => setOpen(on ? null : a.place)} aria-expanded={on}>
                <span className="nm">{a.place}</span>
                <span className="tr" aria-hidden>
                  {isFut(era) && <i className="ghost" style={{ width: pct(a.v.late) }} />}
                  <i className={`bar ${isFut(era) ? "fut" : ""}`} style={{ width: pct(a.v[era]) }} />
                </span>
                <span className="val">{days(a.v[era])}</span>
                <ChevronDown size={16} className="chev" />
              </button>
              {on && <Detail a={a} />}
            </li>
          );
        })}
      </ul>
      <button className="fz-more" onClick={() => setAll((x) => !x)}>
        {all ? "Show fewer areas" : `Show all ${areas.length} areas`}
      </button>
    </section>
  );
}

function Detail({ a }: { a: Area }) {
  const vals = ERAS.map((e) => a.v[e.id]);
  const rng = [null, null, a.range["2041-2060"], a.range["2081-2100"]];
  const top = Math.max(1, ...vals.map((v) => v ?? 0), ...rng.map((r) => r?.[2] ?? 0));
  const rare = top < 1.5;
  const W = 380;
  const H = 170;
  const base = H - 26;
  const h = (v: number | null) => ((v ?? 0) / top) * (base - 28);
  return (
    <div className="fz-detail">
      <svg viewBox={`0 0 ${W} ${H}`} className="fz-bars" role="img" aria-label={ERAS.map((e, i) => `${e.label}: ${days(vals[i])} days`).join(", ")}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line-2)" />
        {ERAS.map((e, i) => {
          const cx = (W / 4) * (i + 0.5);
          const v = vals[i];
          const r = rng[i];
          const bh = Math.max(v && v > 0 ? 3 : 0, h(v));
          const lab = r && r[2] !== null ? base - h(r[2]) - 8 : base - bh - 8;
          return (
            <g key={e.id}>
              {bh > 0 && <path d={`M${cx - 22},${base} V${base - bh + 5} q0,-5 5,-5 H${cx + 17} q5,0 5,5 V${base} Z`} fill={isFut(e.id) ? "var(--fz-fut)" : "var(--fz-past)"} />}
              {r && r[1] !== null && r[2] !== null && r[2] > r[1] && <line x1={cx} x2={cx} y1={base - h(r[1])} y2={base - h(r[2])} stroke="var(--ink)" strokeWidth={1.5} />}
              <text x={cx} y={lab} textAnchor="middle" className="v">
                {days(v)}
              </text>
              <text x={cx} y={H - 7} textAnchor="middle" className={isFut(e.id) ? "k fut" : "k"}>
                {e.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fz-side">
        <p className="fz-say">
          {rare ? (
            <>40 °C is still rare around {a.place}, even in 2090.</>
          ) : (
            <>
              Around {a.place}: <b>{days(a.v.early)}</b> days a year in the 1980s, <b>{days(a.v.late)}</b> today and about <b>{days(a.v["2041-2060"])}</b> by 2050.
            </>
          )}
        </p>
        <p className="tiny muted">The thin line shows how much the climate models disagree.</p>
        <details className="fz-how">
          <summary>How do we know?</summary>
          <ul>
            <li>
              <b>1980s and today:</b> measured with NASA POWER data, every day since 1981.
            </li>
            <li>
              <b>2050 and 2090:</b> 6 NASA climate models (NEX-GDDP-CMIP6), with intermediate emissions.
            </li>
            <li>Each model says how much warmer every month gets. We add that to real NASA days and count again.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
