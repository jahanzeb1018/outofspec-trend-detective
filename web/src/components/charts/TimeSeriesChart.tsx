import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { fmt } from "../../config";
import type { Ens } from "../../data/types";
import { useWidth } from "./useWidth";

export interface TrendLine {
  slope: number; // per year
  lo: number;
  hi: number;
  pivotX: number; // year
  pivotY: number;
}

interface Props {
  years: number[];
  values: (number | null)[];
  unit: string;
  label: string;
  trend?: TrendLine | null;
  future?: Record<string, Record<string, Ens>> | null;
  decimals?: number;
  height?: number;
}

const SCEN_COLOR: Record<string, string> = { ssp245: "#f59e0b", ssp585: "#dc2626" };
const PERIOD_SPAN: Record<string, [number, number]> = { "2041-2060": [2041, 2060], "2081-2100": [2081, 2100] };

export function TimeSeriesChart({ years, values, unit, label, trend, future, decimals = 1, height = 260 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, W] = useWidth<HTMLDivElement>();
  const H = height;
  const m = { l: 44, r: 12, t: 14, b: 26 };
  const x1 = future ? 2100 : years[years.length - 1] + 1;
  const all: number[] = values.filter((v): v is number => v !== null);
  if (future) for (const s of Object.values(future)) for (const e of Object.values(s)) for (const v of e) if (v !== null) all.push(v);
  const dmin = Math.min(...all);
  const dmax = Math.max(...all);
  // counts near zero keep a zero baseline; levels far from zero (e.g. temperatures) zoom to the data so trends are visible
  const zoom = all.length > 0 && dmin > 0 && dmin > 0.25 * dmax;
  const lo = zoom ? dmin : Math.min(0, ...all);
  const hi = zoom ? dmax : Math.max(...all, 1);
  const pad = Math.max((hi - lo) * 0.08, zoom ? 0.2 : 0);
  const x = scaleLinear().domain([years[0] - 1, x1]).range([m.l, W - m.r]);
  const y = scaleLinear()
    .domain([zoom || lo < 0 || all.some((v) => v < 0) ? lo - pad : Math.max(0, lo - pad), hi + pad])
    .nice()
    .range([H - m.b, m.t]);

  const ma = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < values.length; i++) {
      const w = values.slice(Math.max(0, i - 4), Math.min(values.length, i + 6)).filter((v): v is number => v !== null);
      if (i >= 4 && i + 5 < values.length + 1 && w.length >= 8) out.push([years[i], w.reduce((a, b) => a + b, 0) / w.length]);
    }
    return out;
  }, [values, years]);

  const path = line<[number, number]>()
    .x((d) => x(d[0]))
    .y((d) => y(d[1]));
  const xTicks = future ? (W < 480 ? [1990, 2030, 2070] : [1990, 2010, 2030, 2050, 2070, 2090]) : x.ticks(W < 480 ? 5 : 8);
  const tl = trend
    ? {
        a: [years[0], trend.pivotY + trend.slope * (years[0] - trend.pivotX)] as [number, number],
        b: [years[years.length - 1], trend.pivotY + trend.slope * (years[years.length - 1] - trend.pivotX)] as [number, number],
        band: [
          [years[0], trend.pivotY + trend.hi * (years[0] - trend.pivotX)],
          [trend.pivotX, trend.pivotY],
          [years[years.length - 1], trend.pivotY + trend.hi * (years[years.length - 1] - trend.pivotX)],
          [years[years.length - 1], trend.pivotY + trend.lo * (years[years.length - 1] - trend.pivotX)],
          [trend.pivotX, trend.pivotY],
          [years[0], trend.pivotY + trend.lo * (years[0] - trend.pivotX)],
        ] as [number, number][],
      }
    : null;
  const hv = hover !== null ? { yr: years[hover], v: values[hover] } : null;

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${label}: annual values ${years[0]}–${years[years.length - 1]}${future ? " with projections to 2100" : ""}`}>
        <g className="grid">
          {y.ticks(5).map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {y.ticks(5).map((t) => (
          <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t, Math.abs(t) < 10 && t % 1 !== 0 ? 1 : 0)}
          </text>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={m.l} y={10} style={{ fontWeight: 700 }}>
          {unit}
        </text>
        {future && (
          <>
            <line x1={x(2025.5)} x2={x(2025.5)} y1={m.t} y2={H - m.b} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
            <text x={x(2025.5) + 4} y={m.t + 10} style={{ fontSize: 10 }}>
              today
            </text>
          </>
        )}
        {tl && <path d={`M${tl.band.map((p) => `${x(p[0])},${y(p[1])}`).join("L")}Z`} fill="#d9480f" fillOpacity={0.12} />}
        {ma.length > 1 && <path d={path(ma) ?? ""} fill="none" stroke="#8b97a8" strokeWidth={2} />}
        {tl && <line x1={x(tl.a[0])} y1={y(tl.a[1])} x2={x(tl.b[0])} y2={y(tl.b[1])} stroke="#d9480f" strokeWidth={2.4} />}
        {values.map((v, i) =>
          v === null ? null : (
            <circle key={years[i]} cx={x(years[i])} cy={y(v)} r={hover === i ? 5 : 3} fill="var(--text-2)" fillOpacity={0.85} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ),
        )}
        {future &&
          Object.entries(future).map(([s, per], si) =>
            Object.entries(per).map(([p, e]) => {
              const [a, b] = PERIOD_SPAN[p] ?? [0, 0];
              if (e[0] === null) return null;
              const off = si * 0.6;
              return (
                <g key={s + p}>
                  {e[1] !== null && e[2] !== null && <rect x={x(a)} width={x(b) - x(a)} y={y(e[2])} height={Math.max(1, y(e[1]) - y(e[2]))} fill={SCEN_COLOR[s]} fillOpacity={0.18} />}
                  <line x1={x(a)} x2={x(b)} y1={y(e[0]) + off} y2={y(e[0]) + off} stroke={SCEN_COLOR[s]} strokeWidth={3} />
                </g>
              );
            }),
          )}
      </svg>
      <div className="row tiny muted" style={{ gap: 14 }}>
        <span>● annual value (NASA POWER / MERRA-2)</span>
        <span style={{ color: "#8b97a8" }}>━ 10-year average</span>
        {trend && <span style={{ color: "#d9480f" }}>━ Sen trend · shaded: 95% CI</span>}
        {future && (
          <>
            <span style={{ color: SCEN_COLOR.ssp245 }}>━ SSP2-4.5 median · band: model range</span>
            <span style={{ color: SCEN_COLOR.ssp585 }}>━ SSP5-8.5</span>
          </>
        )}
      </div>
      {hv && hv.v !== null && (
        <div className="chart-tip" style={{ left: `${(x(hv.yr) / W) * 100}%`, top: 0 }}>
          {hv.yr}: {fmt(hv.v, decimals)} {unit}
        </div>
      )}
      <details className="table-view">
        <summary>Show data table</summary>
        <div className="table-wrap" style={{ maxHeight: 220 }}>
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((yr, i) => (
                <tr key={yr}>
                  <td>{yr}</td>
                  <td>{fmt(values[i], decimals)}</td>
                </tr>
              ))}
              {future &&
                Object.entries(future).flatMap(([s, per]) =>
                  Object.entries(per).map(([p, e]) => (
                    <tr key={s + p}>
                      <td>
                        {p} ({s})
                      </td>
                      <td>
                        {fmt(e[0], decimals)} (models {fmt(e[1], decimals)}–{fmt(e[2], decimals)})
                      </td>
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
