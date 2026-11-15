import { useState } from "react";
import { useWidth } from "../components/charts/useWidth";
import { useSearchParams } from "react-router-dom";
import { StackedArea } from "../components/charts/StackedArea";
import { LineAgeChart, useLineRows, type LineRow } from "../components/charts/LineAge";
import { Loading } from "../components/ui";
import { fmt, signed } from "../config";
import { useAnnual, useNetwork, useSegments, useSummary } from "../data/load";

const d1 = (v: number) => fmt(v, v < 10 ? 1 : 0);

/** The selected line: the climate it was built for, today's and the future one, as three bars. */
function LinePanel({ r, era, rows, onSelect }: { r: LineRow; era: string; rows: LineRow[]; onSelect: (l: string) => void }) {
  const vals = [r.built, r.today, r.fut];
  const names = ["Built for", "Today", era];
  const W = 300;
  const H = 150;
  const base = H - 24;
  const top = Math.max(1, ...vals);
  const h = (v: number) => (v / top) * (base - 26);
  return (
    <aside className="la-panel" aria-live="polite">
      <select value={r.line} onChange={(e) => onSelect(e.target.value)} aria-label="High-speed line">
        {rows.map((x) => (
          <option key={x.line} value={x.line}>
            {x.short}
          </option>
        ))}
      </select>
      <h3>{r.short}</h3>
      <div className="small muted">
        Opened {r.year} · {fmt(r.km, 0)} km of track
      </div>
      <div className="small ink2" style={{ marginTop: 12 }}>
        Days a year at 40 °C
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="fz-bars" role="img" aria-label={names.map((n, i) => `${n}: ${d1(vals[i])} days`).join(", ")}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line-2)" />
        {vals.map((v, i) => {
          const cx = (W / 3) * (i + 0.5);
          const bh = Math.max(v > 0.05 ? 3 : 0, h(v));
          return (
            <g key={i}>
              {bh > 0 && <path d={`M${cx - 22},${base} V${base - bh + 5} q0,-5 5,-5 H${cx + 17} q5,0 5,5 V${base} Z`} fill={i === 2 ? "#c2410c" : i === 1 ? "#8b929c" : "#d5d8dd"} />}
              <text x={cx} y={base - bh - 8} textAnchor="middle" className="v">
                {d1(v)}
              </text>
              <text x={cx} y={H - 6} textAnchor="middle" className={i === 2 ? "k fut" : "k"}>
                {names[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="la-say">
        When it opened in {r.year}, this area had about <b>{d1(r.built)}</b> days a year at 40 °C. By {era}: about <b>{d1(r.fut)}</b>.
      </p>
      <p className="small ink2">Hottest rail of the year: {signed(r.dRail, 1)} °C vs 1995–2014.</p>
      {r.src && (
        <a className="tiny muted" href={r.src} target="_blank" rel="noreferrer">
          Opening date: source
        </a>
      )}
    </aside>
  );
}

const SCENS = [
  { id: "ssp245", label: "Intermediate emissions" },
  { id: "ssp585", label: "High emissions" },
] as const;

/** One stripe per year: km of track with more than 10 days at 40 °C (NASA POWER), then a typical 2050 year (median of the
 *  NEX-GDDP-CMIP6 models, 2041–2060). */
const STRIPE_STOPS: [number, number[]][] = [
  [0, [244, 239, 228]],
  [400, [253, 231, 176]],
  [1000, [251, 184, 104]],
  [1700, [242, 120, 58]],
  [2400, [214, 58, 47]],
  [3300, [138, 28, 43]],
];
function stripeColor(v: number) {
  if (v <= 0) return `rgb(${STRIPE_STOPS[0][1].join(",")})`;
  for (let i = 1; i < STRIPE_STOPS.length; i++)
    if (v <= STRIPE_STOPS[i][0]) {
      const [a, ca] = STRIPE_STOPS[i - 1];
      const [b, cb] = STRIPE_STOPS[i];
      const f = (v - a) / (b - a);
      return `rgb(${ca.map((x, k) => Math.round(x + (cb[k] - x) * f)).join(",")})`;
    }
  return `rgb(${STRIPE_STOPS[STRIPE_STOPS.length - 1][1].join(",")})`;
}

function Stripes({ years, km, fut }: { years: number[]; km: number[]; fut: number }) {
  const [ref, W] = useWidth<HTMLDivElement>(1100);
  const [hover, setHover] = useState<number | null>(null);
  const H = W < 560 ? 70 : 96;
  const gap = W < 560 ? 10 : 18;
  const futW = Math.max(84, W * 0.11); // wide enough for its "typical year" label, so it never touches "2025"
  const sw = (W - gap - futW) / years.length;
  const tip = hover === null ? null : hover < 0 ? { x: W - futW / 2, t: `2050 (typical year): ${fmt(fut, 0)} km` } : { x: hover * sw + sw / 2, t: `${years[hover]}: ${fmt(km[hover], 0)} km` };
  return (
    <div ref={ref} className="nh-stripes" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={`Km of track with more than 10 days a year at 40 °C, each year 1981–2025, and a typical year in 2050 (${fmt(fut, 0)} km)`}>
        <defs>
          <clipPath id="nh-clip-a">
            <rect x={0} y={0} width={W - gap - futW} height={H} rx={12} />
          </clipPath>
        </defs>
        <g clipPath="url(#nh-clip-a)">
          {km.map((v, i) => (
            <rect key={years[i]} x={i * sw} y={0} width={sw + 0.6} height={H} fill={stripeColor(v)} className="nh-stripe" style={{ animationDelay: `${i * 18}ms` }} onMouseEnter={() => setHover(i)} />
          ))}
        </g>
        <rect x={W - futW} y={0} width={futW} height={H} rx={12} fill={stripeColor(fut)} className="nh-stripe" style={{ animationDelay: `${km.length * 18 + 200}ms` }} onMouseEnter={() => setHover(-1)} />
        <text x={W - futW / 2} y={H / 2 + 6} textAnchor="middle" className="nh-futlabel">
          2050
        </text>
        <text x={0} y={H + 17} className="nh-axis">
          {years[0]}
        </text>
        <text x={W - gap - futW} y={H + 17} textAnchor="end" className="nh-axis">
          {years[years.length - 1]}
        </text>
        <text x={W - futW / 2} y={H + 17} textAnchor="middle" className="nh-axis">
          typical year
        </text>
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(tip.x, 90), W - 90), top: -30, transform: "translateX(-50%)" }}>
          {tip.t}
        </div>
      )}
    </div>
  );
}

export function NetworkPage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const scen = sp.get("scen") === "ssp585" ? "ssp585" : "ssp245";
  const per = "2041-2060";
  const key = `${scen}|${per}`;
  const { data: network } = useNetwork();
  const { data: summary } = useSummary();
  const { data: segs } = useSegments();
  const { data: annual } = useAnnual();
  const age = useLineRows(segs, summary, annual, scen, per);
  const [pick, setPick] = useState<string | null>(null);

  if (!network || !summary) return <div className="wrap"><Loading what="the future network" /></div>;
  if (!summary.models.length)
    return (
      <div className="wrap" style={{ paddingTop: 36 }}>
        <h1>The network in 2050</h1>
        <p className="warnbox" style={{ marginTop: 16 }}>The NASA NEX-GDDP-CMIP6 projections have not been processed yet. Run the pipeline (see README).</p>
      </div>
    );
  const card = network.future_cards[key];
  const ratio = card.km_hot40_gt10 / Math.max(1, card.km_hot40_gt10_ref);
  const era = "2050";
  const sumHot = (v: number[] | undefined) => (v ?? []).slice(3).reduce((a, b) => a + b, 0);
  const top = Math.max(...network.top10.map((t) => t.sen), 1);
  const scenName = scen === "ssp245" ? "intermediate emissions" : "high emissions";
  const older = age ? [...age.rows].filter((r) => r.year <= 2005).sort((a, b) => b.fut - a.fut)[0] ?? age.rows[0] : null;
  const selRow = age ? age.rows.find((r) => r.line === pick) ?? older : null;

  return (
    <div className="wrap nf" style={{ paddingTop: 20 }}>
      <section className="nh" aria-labelledby="nh-title" data-tour="net-cards">
        <div className="nh-top">
          <div className="nh-year" aria-hidden>
            2050
          </div>
          <div className="nh-text">
            <h1 id="nh-title" className="nh-big">
              <b>{fmt(card.km_hot40_gt10, 0)} km</b> of Spain's railway will face ten or more days a year above 40&nbsp;°C.
            </h1>
            <p className="nh-sub">
              {fmt(ratio, 0)} times more than in 1995–2014. Median of {summary.models.length} NASA climate models.
            </p>
            <div className="nh-scen" role="group" aria-label="Emissions">
              {SCENS.map((sc) => (
                <button key={sc.id} aria-pressed={scen === sc.id} onClick={() => set({ scen: sc.id === "ssp245" ? null : sc.id })}>
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Stripes years={network.stacked.years} km={network.stacked.observed.map((o) => sumHot(o))} fut={sumHot(network.stacked.future[key])} />
        <p className="nh-cap">Each stripe is a year: km of track with more than ten days at 40 °C. Measured by NASA, then 2050.</p>
      </section>

      <section className="card nf-card nf-age">
        <h2>Older lines, hotter places?</h2>
        <p>Each high-speed line was designed for the climate of its time. Grey ring: days at 40 °C when it was built. Orange bubble: days at 40 °C by {era}. Click one.</p>
        {age && selRow ? (
          <div className="la-grid">
            <div style={{ minWidth: 0 }}>
              <LineAgeChart rows={age.rows} conv={age.conv} era={era} selected={selRow.line} onSelect={setPick} />
            </div>
            <LinePanel r={selRow} era={era} rows={age.rows} onSelect={setPick} />
          </div>
        ) : (
          <Loading what="the lines" />
        )}
      </section>

      <section className="card nf-card">
        <h2>Track by days at 40 °C a year</h2>
        <p>
          Each year, Spain's {fmt(network.stacked.observed[0].reduce((a, b) => a + b, 0), 0)} km of track, coloured by how many days reached 40&nbsp;°C. Grey: none; the redder, the more days. On the right, a typical year around 2050 according to the climate models ({scenName}).
        </p>
        <div style={{ marginTop: 14 }}>
          <StackedArea
            classes={network.stacked.classes}
            years={network.stacked.years}
            observed={network.stacked.observed}
            columns={[{ label: "2050", sub: "typical year", values: network.stacked.future[`${scen}|2041-2060`] }]}
          />
        </div>
      </section>

      <section className="card nf-card">
        <h2>Where heat grows fastest</h2>
        <p>Extra days at 40 °C per decade since 1981 (NASA, significant trends only).</p>
        <ul className="nf-rows nf-rows2">
          {network.top10.map((t) => (
            <li key={t.segment_id}>
              <span className="nm">
                <b>{t.place}</b>
                <em>{t.line}</em>
              </span>
              <span className="tr" aria-hidden>
                <i style={{ width: `${(t.sen / top) * 100}%` }} />
              </span>
              <span className="val">{signed(t.sen, 1)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
