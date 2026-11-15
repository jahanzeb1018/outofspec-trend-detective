import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Printer, Share2, Sparkles } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { Loading, Prov, Seg, StatusChip } from "../components/ui";
import { heatColor } from "../colors";
import { fmt, signed } from "../config";
import { useCell, useRoutes, useSegments, useSummary } from "../data/load";
import { useWatch } from "../data/forecast";
import type { Route, Summary } from "../data/types";
import { STATUS_COLOR, STATUS_RANK, type Status } from "../model/watch";
import { useAssistant } from "../ai/AssistantContext";
import { calIndex, cleanStation, DAYS_IN, heatIndFor, lineBounds, MONTHS, smart } from "../v2/kit";
import { Odds, Story } from "../v2/ui";
import { Hold, type Ctx } from "./Case";

const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

export function TripCasePage() {
  const { rid = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data: routes } = useRoutes();
  const { data: summary } = useSummary();
  const route = routes?.find((r) => r.route_id === rid) ?? null;
  const date = /^\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? sp.get("date")! : "07-15";
  const i = Math.max(0, Number(sp.get("c") ?? 0) || 0);
  const set = (k: string, v: string) => setSp((p) => (p.set(k, v), p), { replace: true });

  const prof = useMemo(() => {
    if (!route || !summary) return null;
    const step = Math.max(1, Math.round(route.samples.length / 140));
    const pts = route.samples.filter((_, k) => k % step === 0);
    const v = pts.map((s) => ({ km: s.km, now: summary.cells[s.cell_id]?.HOT40?.late ?? 0, fut: summary.cells[s.cell_id]?.HOT40?.fut?.ssp245?.["2041-2060"]?.[0] ?? 0, cell: s.cell_id }));
    let best = v[0];
    for (const p of v) if (p.now > best.now) best = p;
    const cut = best.now * 0.7;
    let a = v.indexOf(best);
    let b = a;
    while (a > 0 && v[a - 1].now >= cut) a--;
    while (b < v.length - 1 && v[b + 1].now >= cut) b++;
    const from = [...route.stations].reverse().find((s) => s.km <= v[a].km + 5) ?? route.stations[0];
    const to = route.stations.find((s) => s.km >= v[b].km - 5) ?? route.stations[route.stations.length - 1];
    return { v, best, from, to, km: Math.max(1, Math.round(to.km - from.km)), cells: [...new Set(route.samples.map((s) => s.cell_id))] };
  }, [route, summary]);
  const hot = prof?.best.cell ?? null;
  const { data: hotCell } = useCell(hot);

  if (routes && !route)
    return (
      <div className="wrap page">
        <h2>We don't know that route yet.</h2>
        <Link className="btn primary" style={{ marginTop: 18 }} to="/">Back to start</Link>
      </div>
    );
  if (!route || !summary || !prof || !hot || !hotCell) return <div className="wrap page"><Loading what="your trip" /></div>;
  const ctx: Ctx = { cid: hot, place: hotCell.place, cs: summary.cells[hot], cell: hotCell, heatInd: heatIndFor(summary.cells[hot]), go: (k) => set("c", String(k)) };
  const T = { route, date, setDate: (d: string) => set("date", d), prof, summary, ctx };

  const cards: ReactNode[] = [<Opening key="o" t={T} />, <Guess key="g" t={T} />, <Profile key="p" t={T} />, <Hold key="h" ctx={ctx} />, <RouteWeek key="w" t={T} />, <Closed key="c" t={T} />];
  const k = Math.min(i, cards.length - 1);
  return (
    <Story i={k} n={cards.length} onGo={ctx.go} narrow={k > 0 && k !== 2}>
      {cards[k]}
    </Story>
  );
}

type T = {
  route: Route;
  date: string;
  setDate: (d: string) => void;
  prof: { v: { km: number; now: number; fut: number; cell: string }[]; best: { km: number; now: number; fut: number; cell: string }; from: { name: string; km: number }; to: { name: string; km: number }; km: number; cells: string[] };
  summary: Summary;
  ctx: Ctx;
};

const dateText = (d: string) => {
  const [m, dd] = d.split("-").map(Number);
  return `${dd} ${MONTHS[m - 1]}`;
};

function DatePick({ t }: { t: T }) {
  const [mm, dd] = t.date.split("-").map(Number);
  return (
    <div className="row" style={{ gap: 6 }}>
      <select aria-label="Day" value={dd} onChange={(e) => t.setDate(`${String(mm).padStart(2, "0")}-${e.target.value.padStart(2, "0")}`)}>
        {Array.from({ length: DAYS_IN[mm - 1] }, (_, k) => (
          <option key={k} value={k + 1}>{k + 1}</option>
        ))}
      </select>
      <select aria-label="Month" value={mm} onChange={(e) => t.setDate(`${e.target.value.padStart(2, "0")}-${String(Math.min(dd, DAYS_IN[Number(e.target.value) - 1])).padStart(2, "0")}`)}>
        {MONTHS.map((m, k) => (
          <option key={m} value={k + 1}>{m}</option>
        ))}
      </select>
    </div>
  );
}

function Opening({ t }: { t: T }) {
  const { data: segFc } = useSegments();
  const hsl = useMemo(() => {
    const ids = new Set(t.route.samples.map((s) => s.segment_id));
    return (segFc?.features ?? []).some((f) => ids.has(f.properties.id) && f.properties.t === "HSL");
  }, [segFc, t.route]);
  const colors = useMemo(() => Object.fromEntries(t.prof.cells.map((c) => [c, heatColor(t.summary.cells[c]?.HOT40?.late)])), [t]);
  return (
    <div className="split">
      <div className="l">
        <div className="mapcard" style={{ padding: 0, overflow: "hidden" }}>
          <div className="mapbox" style={{ height: "min(62vh, 560px)" }}>
            <SpainMap fit={lineBounds(t.route.geometry, 0.3)} route={t.route.geometry} segColors={colors} nav="none" label={`Map of the route ${t.route.name}`} />
          </div>
        </div>
      </div>
      <div className="r">
        <div className="eyebrow">Case file · your trip</div>
        <h1 style={{ marginTop: 10, fontSize: "clamp(2.4rem, 5vw, 3.8rem)" }}>{t.route.name}</h1>
        <ul className="facts">
          <li>
            <b>{fmt(t.route.length_km, 0)} km</b> on a {hsl ? "high-speed" : "conventional"} line
          </li>
          <li>
            Crosses <b>{t.prof.cells.length}</b> NASA data squares of 55 × 50 km
          </li>
          <li>
            Stops: <b>{t.route.stations.map((s) => cleanStation(s.name)).join(" · ")}</b>
          </li>
          <li>
            Hottest stretch today: <b>{cleanStation(t.prof.from.name)} – {cleanStation(t.prof.to.name)}</b>
          </li>
        </ul>
        <div style={{ marginTop: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Travel date</div>
          <DatePick t={t} />
        </div>
        <button className="btn hot" style={{ marginTop: 22 }} onClick={() => t.ctx.go(1)}>
          Investigate my trip <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function useOdds(t: T) {
  const [m, d] = t.date.split("-").map(Number);
  const di = calIndex(m, d);
  const doy = t.ctx.cell.doy;
  // the highest threshold that still happens in at least 3 of 10 recent years tells the clearest story
  const thr = [42, 40, 38, 35].find((t) => (doy?.[String(t)]?.["2016-2025"]?.[di] ?? 0) >= 30) ?? 35;
  const g = (k: string) => {
    const p = doy?.[String(thr)]?.[k]?.[di];
    return p === undefined ? null : Math.round(p / 10);
  };
  return { thr, early: g("1981-1990"), now: g("2016-2025"), fut: g("ssp245|2041-2060") };
}

function Guess({ t }: { t: T }) {
  const o = useOdds(t);
  const [g, setG] = useState(3);
  const [shown, setShown] = useState<null | "g" | "s">(null);
  return (
    <div>
      <div className="eyebrow">Before you see the data</div>
      <h2 style={{ marginTop: 10, maxWidth: 740 }}>
        Out of 10 years, in how many did it reach {o.thr} °C near {t.ctx.place} within a week of {dateText(t.date)}?
      </h2>
      <p className="ink2" style={{ marginTop: 10 }}>{t.ctx.place} is the hottest place on your route. Drag to guess for the last ten years.</p>
      <div className="guess">
        <div className="val">
          {g}
          <span className="muted" style={{ fontSize: 20, marginLeft: 10 }}>in 10 years</span>
        </div>
        <input type="range" min={0} max={10} value={g} onChange={(e) => (setG(Number(e.target.value)), setShown(null))} aria-label="Your guess" disabled={shown !== null} />
      </div>
      {shown === null ? (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn hot" onClick={() => setShown("g")}>Show me the reality</button>
          <button className="btn" onClick={() => setShown("s")}>I'd rather not guess</button>
        </div>
      ) : (
        <>
          <div className="stack" style={{ marginTop: 22, gap: 16 }}>
            {[
              { k: "1981–1990", n: o.early, c: "#8a8882" },
              { k: "2016–2025", n: o.now, c: "#ef4b3c" },
              { k: "2041–2060 (projection)", n: o.fut, c: "#ff6a3d" },
            ].map((x) => (
              <div key={x.k} className="row" style={{ gap: 16 }}>
                <span className="mono small" style={{ width: 190, color: "var(--ink-2)" }}>{x.k}</span>
                <Odds n={x.n ?? 0} color={x.c} />
                <b className="mono">{x.n ?? "–"} in 10</b>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 18, fontSize: 18 }}>
            {shown === "g" && o.now !== null ? (g === o.now ? "Spot on. " : g < o.now ? `It's more often than you thought (${o.now}, not ${g}). ` : `Less often than you guessed (${o.now}, not ${g}). `) : ""}
            Climate odds for your date, not a weather forecast.
          </p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => t.ctx.go(2)}>
            Follow the heat along the route <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function Profile({ t }: { t: T }) {
  const [when, setWhen] = useState<"now" | "fut">("now");
  const W = 1000;
  const H = 230;
  const len = t.route.length_km;
  const maxV = Math.ceil(Math.max(10, ...t.prof.v.map((p) => Math.max(p.now, p.fut))) / 10) * 10;
  const y = (v: number) => H - 30 - (v / maxV) * (H - 50);
  const pts = t.prof.v.map((p) => `${((p.km / len) * W).toFixed(1)},${y(when === "now" ? p.now : p.fut).toFixed(1)}`);
  const best = when === "now" ? t.prof.best.now : Math.max(...t.prof.v.map((p) => p.fut));
  return (
    <div>
      <div className="eyebrow">Clue · where your journey gets hottest</div>
      <h2 style={{ marginTop: 10, maxWidth: 860 }}>
        {best < 1 ? `No days above 40 °C along this route ${when === "now" ? "today" : "in 2041–2060"}.` : `The heat builds on the ${t.prof.km} km between ${cleanStation(t.prof.from.name)} and ${cleanStation(t.prof.to.name)}.`}
      </h2>
      <div style={{ marginTop: 16 }}>
        <Seg label="Period" value={when} onChange={setWhen} options={[{ id: "now", label: "Today (2016–2025)" }, { id: "fut", label: "2041–2060" }]} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Days at or above 40 °C along the route">
          <defs>
            <linearGradient id="tg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4b3c" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4b3c" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {[0, maxV / 2, maxV].map((v) => (
            <g key={v}>
              <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="#26272b" />
              <text x={4} y={y(v) - 4}>{fmt(v, 0)} days</text>
            </g>
          ))}
          <path d={`M0,${H - 30} L${pts.join(" L")} L${W},${H - 30} Z`} fill="url(#tg)" />
          <path d={`M${pts.join(" L")}`} fill="none" stroke="#ff6a3d" strokeWidth={2.5} />
          {t.route.stations.map((s, k) => (
            <g key={s.name}>
              <line x1={(s.km / len) * W} x2={(s.km / len) * W} y1={H - 30} y2={H - 22} stroke="#8a8882" />
              <text x={(s.km / len) * W} y={H - 6} textAnchor={k === 0 ? "start" : k === t.route.stations.length - 1 ? "end" : "middle"} style={{ fill: "#b9b7b1" }}>
                {cleanStation(s.name)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="ink2" style={{ marginTop: 12 }}>Days a year at or above 40 °C along the route, from NASA POWER (MERRA-2){when === "fut" ? " and the median of 6 NASA NEX-GDDP-CMIP6 models, intermediate emissions" : ""}.</p>
      <div className="means">
        <div className="eyebrow">What it means for your train</div>
        <p style={{ fontSize: 16.5, lineHeight: 1.55 }}>On very hot afternoons, operators may slow trains on the hottest stretches to protect the track. The longer the hot stretch, the more of your journey is exposed.</p>
      </div>
    </div>
  );
}

function RouteWeek({ t }: { t: T }) {
  const watch = useWatch();
  const week = useMemo(() => {
    if (!watch.data) return null;
    return watch.data.days.map((d) => {
      let rail = -99;
      let status: Status = "ok";
      let where = "";
      for (const c of t.prof.cells) {
        const x = d.cells[c];
        if (!x) continue;
        if (x.rail > rail) (rail = x.rail), (where = c);
        if (STATUS_RANK[x.status] > STATUS_RANK[status]) status = x.status;
      }
      return { date: d.date, rail, status, where };
    });
  }, [watch.data, t.prof.cells]);
  const worst = week?.reduce((a, d) => (STATUS_RANK[d.status] > STATUS_RANK[a.status] ? d : a), week[0]);
  return (
    <div>
      <div className="eyebrow row" style={{ gap: 8 }}>
        <span className="live-dot" /> Live · next 7 days on your route
      </div>
      <h2 style={{ marginTop: 10 }}>And if you travel this week?</h2>
      {!week && !watch.error && <Loading what="the forecast" />}
      {watch.error && <p className="warnbox" style={{ marginTop: 16 }}>The forecast is not available right now.</p>}
      {week && worst && (
        <>
          <div className="row" style={{ marginTop: 14 }}>
            {worst.status === "ok" ? <span className="chip st-ok">Nothing unusual this week</span> : <StatusChip s={worst.status} />}
          </div>
          <div className="weekstrip">
            {week.map((d) => (
              <div key={d.date} style={{ borderColor: d.status === "ok" ? undefined : STATUS_COLOR[d.status] }}>
                <div className="d">{dayLabel(d.date)}</div>
                <div className="r" style={{ color: d.rail >= 55 ? "var(--hot)" : "var(--ink)" }}>{fmt(d.rail, 0)}°</div>
                <div className="tiny muted">hottest rail</div>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            Hottest estimated rail temperature anywhere on the route each day (Open-Meteo forecast + our NASA-calibrated model). Screening estimate, not an operational alert. <Link to="/watch">Whole network →</Link>
          </p>
        </>
      )}
    </div>
  );
}

function Closed({ t }: { t: T }) {
  const navigate = useNavigate();
  const assistant = useAssistant();
  const o = useOdds(t);
  const [brief, setBrief] = useState<{ text: string; source: "si" | "rules" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const b = t.ctx.cell.buckling.average;
  const facts = () => ({
    trip: t.route.name,
    travel_date: dateText(t.date),
    hottest_place_on_route: t.ctx.place,
    hottest_stretch: `${cleanStation(t.prof.from.name)} - ${cleanStation(t.prof.to.name)} (${t.prof.km} km)`,
    years_in_10_with_a_day_at_or_above_c: o.thr,
    odds_1981_1990: o.early,
    odds_2016_2025: o.now,
    odds_2041_2060_projection: o.fut,
    days_per_year_above_40c_hottest_place_now: t.prof.best.now,
    typical_track_margin_c: { today: b?.recent?.bsm_med, y2041_2060: b?.["ssp245|2041-2060"]?.bsm_med },
  });
  const fallback = `On ${t.route.name}, the heat concentrates between ${cleanStation(t.prof.from.name)} and ${cleanStation(t.prof.to.name)}. Around ${dateText(t.date)}, ${t.ctx.place} reached ${o.thr} °C in ${o.now} of 10 recent years (${o.early} in the 1980s; about ${o.fut} by 2041–2060). These are climate odds, not a forecast.`;
  return (
    <div>
      <div className="casefile">
        <span className="stamp seal">Case closed</span>
        <div className="eyebrow">Trip file · {dateText(t.date).toUpperCase()}</div>
        <h2 style={{ marginTop: 8 }}>{t.route.name}</h2>
        <p style={{ marginTop: 6 }}>
          Hottest stretch: {cleanStation(t.prof.from.name)} – {cleanStation(t.prof.to.name)} ({t.prof.km} km), near {t.ctx.place}.
        </p>
        <table>
          <tbody>
            <tr>
              <td>Years in 10 reaching {o.thr} °C near your date</td>
              <td className="num">
                {o.early} → {o.now} → {o.fut}
              </td>
              <td className="mono tiny" style={{ textAlign: "right" }}>1980s → now → 2050</td>
            </tr>
            <tr>
              <td>Days ≥ 40 °C a year, {t.ctx.place}</td>
              <td className="num">
                {smart(t.ctx.cs.HOT40?.early)} → {smart(t.ctx.cs.HOT40?.late)}
              </td>
              <td className="mono tiny" style={{ textAlign: "right" }}>1980s → now</td>
            </tr>
            {b?.recent && (
              <tr>
                <td>Track margin, typical track (°C)</td>
                <td className="num">
                  {signed(b.recent.bsm_med, 1)} → {signed(b["ssp245|2041-2060"]?.bsm_med, 1)}
                </td>
                <td className="mono tiny" style={{ textAlign: "right" }}>now → 2050</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="tiny" style={{ marginTop: 12, color: "#6d6a62" }}>Climate odds from NASA POWER (MERRA-2) and NASA NEX-GDDP-CMIP6; track model after the US FRA. Not a weather forecast or an official assessment.</p>
      </div>
      <div className="row noprint" style={{ marginTop: 18 }}>
        <button
          className="btn hot"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setBrief(await assistant.brief(facts(), fallback));
            setBusy(false);
          }}
        >
          <Sparkles size={15} /> {busy ? "Writing…" : "Explain my trip"}
        </button>
        <button
          className="btn"
          onClick={async () => {
            const url = window.location.href.replace(/([?&])c=\d+/, "$1c=0");
            try {
              if (navigator.share) await navigator.share({ title: `${t.route.name} · Orbitrack`, url });
              else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }
            } catch {
              /* cancelled */
            }
          }}
        >
          <Share2 size={15} /> {copied ? "Link copied" : "Share"}
        </button>
        <button className="btn" onClick={() => window.print()}>
          <Printer size={15} /> Save as PDF
        </button>
        <button className="btn" onClick={() => navigate(`/case/${t.ctx.cid}`)}>
          Investigate {t.ctx.place} <ArrowRight size={15} />
        </button>
      </div>
      {brief && (
        <div className="card noprint" style={{ marginTop: 16 }}>
          <p style={{ lineHeight: 1.6, fontSize: 16.5 }}>{brief.text}</p>
          <div style={{ marginTop: 10 }}>
            <Prov kind={brief.source === "si" ? "ai" : "rules"} />
          </div>
        </div>
      )}
    </div>
  );
}
