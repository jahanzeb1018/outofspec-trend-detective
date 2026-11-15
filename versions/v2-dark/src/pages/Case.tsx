import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Printer, Share2, Sparkles } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { Loading, Prov, Seg, StatusChip } from "../components/ui";
import { fmt, signed } from "../config";
import { useCell, useNetwork, useSegments, useSummary, useValidation } from "../data/load";
import { useWatch } from "../data/forecast";
import type { CellDetail, CellIndicatorSummary, Summary } from "../data/types";
import { plainStatus, STATUS_COLOR, STATUS_RANK, type Status } from "../model/watch";
import { useAssistant } from "../ai/AssistantContext";
import { band, CLUE, cellBounds, chanceWords, DAYS_OF_DATA, heatIndFor, nearestStation, PRESET_LABEL, periodMean, smart, verdictOf } from "../v2/kit";
import { Bend, Stamp, Story, Stripes, UnitRows, YearBars } from "../v2/ui";

export type Ctx = {
  cid: string;
  place: string;
  cs: Summary["cells"][string];
  cell: CellDetail;
  heatInd: "HOT40" | "HOT35" | "TXX";
  go: (i: number) => void;
};

const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

export function CasePage() {
  const { cid = "" } = useParams();
  const [sp, setSp] = useSearchParams();
  const { data: summary } = useSummary();
  const { data: cell, error } = useCell(cid || null);
  const i = Math.max(0, Number(sp.get("c") ?? 0) || 0);
  const go = (k: number) => setSp((p) => (p.set("c", String(k)), p), { replace: true });

  if (error) return <NotFound />;
  if (!summary || !cell) return <div className="wrap page"><Loading what="the case file" /></div>;
  const cs = summary.cells[cid];
  if (!cs) return <NotFound />;
  const ctx: Ctx = { cid, place: cell.place, cs, cell, heatInd: heatIndFor(cs), go };
  return <CaseStory ctx={ctx} i={i} />;
}

function NotFound() {
  return (
    <div className="wrap page">
      <h2>We don't have a case file for that place.</h2>
      <p className="ink2" style={{ marginTop: 10 }}>Cases cover the 159 NASA grid cells crossed by Spain's railway.</p>
      <Link className="btn primary" style={{ marginTop: 18 }} to="/">Back to start</Link>
    </div>
  );
}

function CaseStory({ ctx, i }: { ctx: Ctx; i: number }) {
  const { cs, heatInd } = ctx;
  const clues = useMemo(() => {
    const list: string[] = [heatInd, "RAIL_AM"];
    if (cs.TN20 && !cs.TN20.rare && (cs.TN20.late ?? 0) >= 1) list.push("TN20");
    if (cs.FROST && !cs.FROST.rare && (cs.FROST.early ?? 0) >= 1) list.push("FROST");
    return list.filter((x, k) => list.indexOf(x) === k && cs[x]);
  }, [cs, heatInd]);
  const rest = useMemo(() => ["HOT35", "HOT40", "TXX", "HOTSPELL", "TN20", "FROST", "COLD5", "R20"].filter((x) => !clues.includes(x) && cs[x] && !cs[x].rare), [clues, cs]);

  const cards: ReactNode[] = [
    <Opening key="open" ctx={ctx} nClues={clues.length + rest.length} />,
    <Guess key="guess" ctx={ctx} />,
    ...clues.map((ind, k) => <Clue key={ind} ctx={ctx} ind={ind} k={k + 1} n={clues.length} />),
    rest.length ? <Rest key="rest" ctx={ctx} inds={rest} /> : null,
    <Hold key="hold" ctx={ctx} />,
    <Week key="week" ctx={ctx} />,
    <Future key="future" ctx={ctx} />,
    <Closed key="closed" ctx={ctx} inds={[...clues, ...rest]} />,
  ].filter(Boolean);
  const k = Math.min(i, cards.length - 1);
  return (
    <Story i={k} n={cards.length} onGo={ctx.go} narrow={k > 0}>
      {cards[k]}
    </Story>
  );
}

/* ---------------- 1 · opening ---------------- */
function Opening({ ctx, nClues }: { ctx: Ctx; nClues: number }) {
  const { data: segFc } = useSegments();
  const { data: val } = useValidation();
  const lines = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of segFc?.features ?? []) if (f.properties.c === ctx.cid && f.properties.n) m.set(f.properties.n, (m.get(f.properties.n) ?? 0) + (f.properties.L ?? 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [segFc, ctx.cid]);
  const st = nearestStation(val, ctx.cell.lat, ctx.cell.lon);
  return (
    <div className="split">
      <div className="l">
        <div className="mapcard" style={{ padding: 0, overflow: "hidden" }}>
          <div className="mapbox" style={{ height: "min(62vh, 560px)" }}>
            <SpainMap fit={cellBounds(ctx.cid, 0.45)} segColors={{ [ctx.cid]: "#ff6a3d" }} selectedCell={ctx.cid} nav="none" label={`Map of the railway around ${ctx.place}`} />
          </div>
        </div>
      </div>
      <div className="r">
        <div className="eyebrow">Case file · {ctx.place} area</div>
        <h1 style={{ marginTop: 10, fontSize: "clamp(3rem, 7vw, 5rem)" }}>{ctx.place}</h1>
        <ul className="facts">
          <li>
            <b>{fmt(ctx.cell.track_km, 0)} km</b> of track in a 55 × 50 km NASA data square
          </li>
          <li>
            <b>{fmt(DAYS_OF_DATA, 0)}</b> days of NASA data, 1981–2025
          </li>
          {lines.length > 0 && (
            <li>
              Lines: <b>{lines.slice(0, 2).join(" · ")}</b>
              {lines.length > 2 ? ` +${lines.length - 2}` : ""}
            </li>
          )}
          <li>
            <b>{nClues}</b> clues under suspicion
          </li>
          {st && (
            <li>
              Witness: weather station <b>{titleCase(st.name)}</b>, {fmt(st.d, 0)} km away
            </li>
          )}
        </ul>
        <button className="btn hot" style={{ marginTop: 26 }} onClick={() => ctx.go(1)}>
          Start the investigation <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const TEMP = new Set(["RAIL_AM", "TXX", "TXP95", "TNN"]);
const val = (ind: string, v: number | null | undefined) => (TEMP.has(ind) ? fmt(v, 1) : smart(v));

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/* ---------------- 2 · guess ---------------- */
function Guess({ ctx }: { ctx: Ctx }) {
  const r = ctx.cs[ctx.heatInd];
  const isTemp = ctx.heatInd === "TXX";
  const late = r?.late ?? 0;
  const early = r?.early ?? 0;
  const max = isTemp ? 48 : Math.max(30, Math.ceil((late * 1.8) / 5) * 5);
  const min = isTemp ? 30 : 0;
  const [g, setG] = useState<number>(isTemp ? 38 : Math.round(max / 3));
  const [shown, setShown] = useState<null | "guess" | "skip">(null);
  const thr = ctx.heatInd === "HOT40" ? 40 : 35;
  const diff = g - late;
  return (
    <div>
      <div className="eyebrow">Before you see the data</div>
      <h2 style={{ marginTop: 10, maxWidth: 720 }}>
        {isTemp ? `How hot do you think the hottest day of the year gets around ${ctx.place} now?` : `How many days a year do you think it now reaches ${thr} °C around ${ctx.place}?`}
      </h2>
      <p className="ink2" style={{ marginTop: 10 }}>Drag to make your guess. Then we'll show you what 45 years of NASA data say.</p>
      <div className="guess">
        <div className="val">
          {fmt(g, isTemp ? 1 : 0)}
          <span className="muted" style={{ fontSize: 20, marginLeft: 10 }}>{isTemp ? "°C" : "days a year"}</span>
        </div>
        <input type="range" min={min} max={max} step={isTemp ? 0.5 : 1} value={g} onChange={(e) => (setG(Number(e.target.value)), setShown(null))} aria-label="Your guess" disabled={shown !== null} />
      </div>
      {shown === null ? (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn hot" onClick={() => setShown("guess")}>
            Show me the reality
          </button>
          <button className="btn" onClick={() => setShown("skip")}>
            I'd rather not guess
          </button>
        </div>
      ) : (
        <>
          <div className="reveal">
            {shown === "guess" && (
              <div>
                <div className="k">Your guess</div>
                <div className="v">{fmt(g, isTemp ? 1 : 0)}</div>
              </div>
            )}
            <div>
              <div className="k">1981–1990</div>
              <div className="v" style={{ color: "var(--ink-2)" }}>{smart(early)}</div>
            </div>
            <div>
              <div className="k">2016–2025</div>
              <div className="v" style={{ color: "var(--hot)" }}>{smart(late)}</div>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 18 }}>
            {shown === "guess" && Math.abs(diff) <= Math.max(1, late * 0.15)
              ? "Sharp eye — that's about right. "
              : shown === "guess"
                ? diff < 0
                  ? `You guessed ${fmt(-diff, isTemp ? 1 : 0)} ${isTemp ? "°C" : "days"} too low. Most people underestimate how much it has changed. `
                  : `You guessed ${fmt(diff, isTemp ? 1 : 0)} ${isTemp ? "°C" : "days"} too high. `
                : ""}
            {isTemp ? `The hottest day went from ${smart(early)} to ${smart(late)} °C.` : late > early ? `It went from ${smart(early)} to ${smart(late)} days a year.` : `It is ${smart(late)} days a year now.`}
          </p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => ctx.go(2)}>
            Look at the evidence <ArrowRight size={16} />
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- clue cards ---------------- */
function Clue({ ctx, ind, k, n }: { ctx: Ctx; ind: string; k: number; n: number }) {
  const { data: val } = useValidation();
  const assistant = useAssistant();
  const r = ctx.cs[ind] as CellIndicatorSummary;
  const v = verdictOf(r);
  const meta = CLUE[ind];
  const years = ctx.cell.years;
  const series = ctx.cell.indicators[ind] ?? [];
  const isTemp = ind === "RAIL_AM" || ind === "TXX";
  const st = ind === ctx.heatInd ? nearestStation(val, ctx.cell.lat, ctx.cell.lon) : null;
  const wE = st ? periodMean(st.series.years, st.series.hot35_obs, 1981, 1990) : null;
  const wL = st ? periodMean(st.series.years, st.series.hot35_obs, 2016, 2025) : null;
  const tr = ctx.cell.trends[ind];
  return (
    <div>
      <div className="eyebrow">
        Clue {k} of {n} · {meta.short}
      </div>
      <div className="bignums">
        <div>
          <div className="lbl">1981–1990</div>
          <div className="n old">{isTemp ? fmt(r.early, 1) : smart(r.early)}</div>
        </div>
        <div className="arrow">→</div>
        <div>
          <div className="lbl">2016–2025</div>
          <div className="n">{isTemp ? fmt(r.late, 1) : smart(r.late)}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 10, gap: 16 }}>
        <span className="ink2">{meta.unit}</span>
        <Stamp v={v} />
      </div>
      <div style={{ marginTop: 22 }}>
        {isTemp ? (
          <Stripes years={years} values={series} unit="°C" />
        ) : (ind === "TN20" || ind === "FROST") && Math.max(r.early ?? 0, r.late ?? 0) <= 120 ? (
          <UnitRows a={r.early ?? 0} b={r.late ?? 0} labelA="1981–1990, per year" labelB="2016–2025, per year" cold={ind === "FROST"} />
        ) : (
          <>
            <YearBars years={years} values={series} unit={meta.unit} color={meta.cold ? "#5b9bff" : "#ef4b3c"} />
            <div className="note" style={{ marginTop: 4 }}>Each bar is a year. In colour, the two decades we compare; the white line is their average.</div>
          </>
        )}
      </div>
      <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.55 }}>
        {v.plain} The chance of a trend like this appearing by luck alone: <b>{chanceWords(r.p)}</b>. Trend: {signed(r.sen, isTemp ? 2 : 1)} {isTemp ? "°C" : ""} per decade (likely range {signed(r.lo, isTemp ? 2 : 1)} to {signed(r.hi, isTemp ? 2 : 1)}).
      </p>
      {st && wE !== null && wL !== null && (
        <div className="witness">
          <b>Witness:</b> weather station {titleCase(st.name)}, {fmt(st.d, 0)} km away, counts its own days at or above 35 °C: <b>{fmt(wE, 0)}</b> a year in 1981–1990 and <b>{fmt(wL, 0)}</b> in 2016–2025 (NOAA GHCN-Daily, independent of the NASA model).
        </div>
      )}
      <div className="means">
        <div className="eyebrow">What it means for the track</div>
        <p style={{ fontSize: 16.5, lineHeight: 1.55 }}>{meta.means}</p>
      </div>
      <details className="tech">
        <summary>Technical details</summary>
        <div style={{ marginTop: 10 }}>
          <Kv k="Sen's slope" v={`${signed(r.sen, 2)} per decade`} p="Median of all pairwise slopes — robust to single extreme years." />
          <Kv k="95% interval" v={`${signed(r.lo, 2)} to ${signed(r.hi, 2)}`} p="Range of slopes compatible with the data." />
          <Kv k="Mann-Kendall p" v={fmt(r.p, 4)} p="Hamed–Rao correction for year-to-year memory (can only make it more cautious)." />
          <Kv k="FDR q" v={fmt(r.q, 4)} p="Benjamini–Hochberg across all 159 cells: guards against chance hits when testing many places." />
          {tr && <Kv k="OLS t-test p" v={fmt(tr.p_ols, 4)} p={`Kendall τ = ${fmt(tr.tau, 2)} · n = ${tr.n} years`} />}
          <Kv k="Data" v="NASA POWER" p="MERRA-2 reanalysis (temperature) and CERES/SRB (sunshine), daily, 1981–2025." />
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => assistant.explain({ kind: "cell", cellId: ctx.cid, indicator: ind, segment: `${ctx.place} area` })}>
            <Sparkles size={13} /> Explain it in plain words
          </button>
        </div>
      </details>
    </div>
  );
}

function Kv({ k, v, p }: { k: string; v: string; p: string }) {
  return (
    <div className="kv">
      <div>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
      </div>
      <p>{p}</p>
    </div>
  );
}

/* ---------------- the rest ---------------- */
function Rest({ ctx, inds }: { ctx: Ctx; inds: string[] }) {
  const none = inds.filter((x) => verdictOf(ctx.cs[x]).cls === "none").length;
  return (
    <div>
      <div className="eyebrow">The rest of the file</div>
      <h2 style={{ marginTop: 10 }}>{none === 0 ? "More clues point the same way." : none < inds.length ? "More clues — and some that don't move." : "Not finding a change is also a clue."}</h2>
      <p className="ink2" style={{ marginTop: 10, maxWidth: 640 }}>
        {none ? "Some measurements swing too much from year to year to call. We won't say they change if the data don't hold it up." : "These were checked with the same tests."}
      </p>
      <div className="stack" style={{ marginTop: 22, gap: 12 }}>
        {inds.map((x) => {
          const r = ctx.cs[x];
          const v = verdictOf(r);
          return (
            <div key={x} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{CLUE[x]?.title ?? x}</b>
                <Stamp v={v} small />
              </div>
              <p className="ink2 small" style={{ marginTop: 6 }}>
                {val(x, r.early)} → {val(x, r.late)} {CLUE[x]?.unit ?? ""} (1981–1990 → 2016–2025).
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- will the track hold? ---------------- */
export function Hold({ ctx }: { ctx: Ctx }) {
  const { data: segFc } = useSegments();
  const firstSeg = useMemo(() => (segFc?.features ?? []).find((f) => f.properties.c === ctx.cid)?.properties.id, [segFc, ctx.cid]);
  const [preset, setPreset] = useState<"strong" | "average" | "weak">("average");
  const b = ctx.cell.buckling[preset];
  const panels = [
    { k: "Today (2006–2025)", r: b?.recent },
    { k: "2041–2060", r: b?.["ssp245|2041-2060"] },
  ];
  return (
    <div>
      <div className="eyebrow">The question that matters</div>
      <h2 style={{ marginTop: 10 }}>Will the track around {ctx.place} hold the heat?</h2>
      <p className="ink2" style={{ marginTop: 10, maxWidth: 680 }}>
        Steel rails expand in the heat. If they can't, the track can kink sideways — a "sun kink". We run the US Federal Railroad Administration buckling model on every summer day of the NASA record.
      </p>
      <div style={{ marginTop: 18 }}>
        <Seg label="Track condition" value={preset} onChange={setPreset} options={(["strong", "average", "weak"] as const).map((p) => ({ id: p, label: PRESET_LABEL[p] }))} />
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        {panels.map(({ k, r }) =>
          r ? (
            <div key={k} className="card">
              <div className="mono small muted">{k}</div>
              <div style={{ fontSize: 34, fontWeight: 650, letterSpacing: "-0.03em", color: band(r.bsm_med).c, marginTop: 6 }}>{band(r.bsm_med).t}</div>
              <Bend margin={r.bsm_med} height={64} />
              <div className="row" style={{ gap: 20 }}>
                <div className="metric">
                  <div className="v" style={{ fontSize: 24 }}>{signed(r.bsm_med, 1)} °C</div>
                  <div className="l">safety margin, hottest day</div>
                </div>
                <div className="metric">
                  <div className="v" style={{ fontSize: 24 }}>{fmt(r.days_mean, r.days_mean < 10 ? 1 : 0)}</div>
                  <div className="l">days a year with no margin</div>
                </div>
              </div>
            </div>
          ) : (
            <div key={k} className="card muted">Not available.</div>
          ),
        )}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        “Just repaired” = ballast not yet settled after maintenance, when track is weakest. Results depend on these assumptions; this is not an assessment of any real line.{" "}
        {firstSeg && <Link to={`/lab?seg=${firstSeg}`}>Open the full track lab →</Link>}
      </p>
    </div>
  );
}

/* ---------------- this week ---------------- */
function Week({ ctx }: { ctx: Ctx }) {
  const watch = useWatch();
  const days = watch.data?.days.map((d) => ({ date: d.date, x: d.cells[ctx.cid] })).filter((d) => d.x) ?? [];
  const worst = days.reduce<(typeof days)[number] | null>((a, d) => (!a || STATUS_RANK[d.x.status] > STATUS_RANK[a.x.status] || (d.x.status === a.x.status && d.x.rail > a.x.rail) ? d : a), null);
  return (
    <div>
      <div className="eyebrow row" style={{ gap: 8 }}>
        <span className="live-dot" /> Live · next 7 days
      </div>
      <h2 style={{ marginTop: 10 }}>And this week around {ctx.place}?</h2>
      {!watch.data && !watch.error && <Loading what="the forecast" />}
      {watch.error && <p className="warnbox" style={{ marginTop: 16 }}>The forecast is not available right now.</p>}
      {worst && (
        <>
          <div className="row" style={{ marginTop: 14, gap: 12 }}>
            <StatusChip s={worst.x.status as Status} />
            <span className="ink2">{plainStatus(worst.x.status as Status, worst.x)}</span>
          </div>
          <div className="weekstrip">
            {days.map((d) => (
              <div key={d.date} style={{ borderColor: d.x.status === "ok" ? undefined : STATUS_COLOR[d.x.status as Status] }}>
                <div className="d">{dayLabel(d.date)}</div>
                <div className="r" style={{ color: d.x.rail >= 55 ? "var(--hot)" : "var(--ink)" }}>{fmt(d.x.rail, 0)}°</div>
                <div className="tiny muted">rail · air {fmt(d.x.tmax, 0)}°</div>
              </div>
            ))}
          </div>
          {(() => {
            const top = Math.max(...days.map((d) => d.x.rail));
            return (
              <p style={{ marginTop: 18, fontSize: 18 }}>
                Hottest rail this week: <b>{fmt(top, 0)} °C</b> — {top >= 55 ? "inside" : top >= 48 ? "approaching" : "far below"} the 55–60 °C range where track engineers start to worry.
              </p>
            );
          })()}
          <p className="note" style={{ marginTop: 12 }}>
            Rail temperature estimated from the Open-Meteo forecast with our NASA-calibrated model, compared with this place's own 1981–2025 record. A screening estimate, not an operational alert.{" "}
            <Link to="/watch">See the whole network →</Link>
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- 2050 ---------------- */
function Future({ ctx }: { ctx: Ctx }) {
  const { data: network } = useNetwork();
  const [scen, setScen] = useState<"ssp245" | "ssp585">("ssp245");
  const r = ctx.cs[ctx.heatInd];
  const f1 = r?.fut?.[scen]?.["2041-2060"]?.[0] ?? null;
  const f2 = r?.fut?.[scen]?.["2081-2100"]?.[0] ?? null;
  const an = network?.analogs[`${scen}|2041-2060`]?.find((a) => a.from === ctx.cid);
  const isTemp = ctx.heatInd === "TXX";
  return (
    <div>
      <div className="eyebrow">The future · 6 NASA NEX-GDDP-CMIP6 climate models</div>
      <h2 style={{ marginTop: 10 }}>
        {an?.ok && an.to_place && an.to_place !== ctx.place ? (
          <>
            By 2050, {ctx.place} will feel like <span style={{ color: "var(--hot)" }}>{an.to_place}</span> today.
          </>
        ) : an && !an.ok ? (
          <>By 2050, {ctx.place} will have a climate no Spanish railway has today.</>
        ) : (
          <>{ctx.place} keeps heating up.</>
        )}
      </h2>
      <div style={{ marginTop: 16 }}>
        <Seg label="Emissions" value={scen} onChange={setScen} options={[{ id: "ssp245", label: "Intermediate emissions" }, { id: "ssp585", label: "High emissions" }]} />
      </div>
      <div className="bignums" style={{ marginTop: 22 }}>
        <div>
          <div className="lbl">2016–2025</div>
          <div className="n old">{smart(r?.late)}</div>
        </div>
        <div className="arrow">→</div>
        <div>
          <div className="lbl">2041–2060</div>
          <div className="n">{smart(f1)}</div>
        </div>
        <div className="arrow">→</div>
        <div>
          <div className="lbl">2081–2100</div>
          <div className="n" style={{ color: "var(--hot)" }}>{smart(f2)}</div>
        </div>
      </div>
      <p className="ink2" style={{ marginTop: 10 }}>{CLUE[ctx.heatInd].unit} · median of 6 models{isTemp ? "" : ""}</p>
      <p className="note" style={{ marginTop: 16, maxWidth: 680 }}>
        Scenarios, not forecasts: the outcome depends on emissions. Projections are NASA's bias-corrected NEX-GDDP-CMIP6 models applied to the 1995–2014 NASA record (delta method). “Feels like” matches days ≥ 40 °C, hot-day temperature, warm nights and frost.{" "}
        <Link to={`/network?scen=${scen}`}>The whole network in 2050 →</Link>
      </p>
    </div>
  );
}

/* ---------------- case closed ---------------- */
function Closed({ ctx, inds }: { ctx: Ctx; inds: string[] }) {
  const navigate = useNavigate();
  const assistant = useAssistant();
  const [brief, setBrief] = useState<{ text: string; source: "si" | "rules" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const rows = inds.map((x) => ({ x, r: ctx.cs[x], v: verdictOf(ctx.cs[x]) }));
  const real = rows.filter((r) => r.v.cls === "up" || r.v.cls === "down").length;
  const bsm = ctx.cell.buckling.average;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
  const facts = () => ({
    place: `${ctx.place} area (NASA cell ${ctx.cid})`,
    track_km: Math.round(ctx.cell.track_km),
    clues: rows.map(({ x, r, v }) => ({ clue: CLUE[x]?.title ?? x, mean_1981_1990: r.early, mean_2016_2025: r.late, verdict: v.stamp, p_mann_kendall: r.p, q_fdr: r.q })),
    typical_track_margin_c: { today: bsm?.recent?.bsm_med, y2041_2060: bsm?.["ssp245|2041-2060"]?.bsm_med },
  });
  const fallback = `${ctx.place}: ${real} of ${rows.length} clues show a confirmed change since the 1980s. ${rows
    .filter((r) => r.v.cls === "up")
    .map((r) => `${CLUE[r.x]?.title ?? r.x} rose from ${smart(r.r.early)} to ${smart(r.r.late)}`)
    .slice(0, 2)
    .join("; ")}. Typical track keeps a ${signed(bsm?.recent?.bsm_med, 1)} °C margin on the hottest day today and ${signed(bsm?.["ssp245|2041-2060"]?.bsm_med, 1)} °C by 2041–2060.`;
  return (
    <div>
      <div className="casefile">
        <span className="stamp seal">Case closed</span>
        <div className="eyebrow">
          Case file nº {ctx.cid} · {today}
        </div>
        <h2 style={{ marginTop: 8 }}>The {ctx.place} case</h2>
        <p style={{ marginTop: 6 }}>
          {real} of {rows.length} clues point to a real change.
        </p>
        <table>
          <tbody>
            {rows.map(({ x, r, v }) => (
              <tr key={x}>
                <td>{CLUE[x]?.title ?? x}</td>
                <td className="num">
                  {val(x, r.early)} → {val(x, r.late)}
                </td>
                <td style={{ textAlign: "right", width: 150 }}>
                  <Stamp v={v} small />
                </td>
              </tr>
            ))}
            {bsm?.recent && (
              <tr>
                <td>Track margin, typical track (°C)</td>
                <td className="num">
                  {signed(bsm.recent.bsm_med, 1)} → {signed(bsm["ssp245|2041-2060"]?.bsm_med, 1)}
                </td>
                <td style={{ textAlign: "right" }} className="mono tiny">
                  today → 2050
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="tiny" style={{ marginTop: 12, color: "#6d6a62" }}>Data: NASA POWER (MERRA-2) 1981–2025 · NASA NEX-GDDP-CMIP6 · NOAA GHCN-Daily · FRA buckling model · © OpenStreetMap contributors. Not an official NASA product.</p>
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
          <Sparkles size={15} /> {busy ? "Writing…" : "Explain my case"}
        </button>
        <button
          className="btn"
          onClick={async () => {
            const url = window.location.href.replace(/([?&])c=\d+/, "$1c=0");
            try {
              if (navigator.share) await navigator.share({ title: `The ${ctx.place} case · OutOfSpec`, url });
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
        <button className="btn" onClick={() => navigate("/")}>
          Investigate another place
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
