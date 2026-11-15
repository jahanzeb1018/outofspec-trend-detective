import { scaleLinear } from "d3-scale";
import { area, stack } from "d3-shape";
import { PALETTES } from "../../colors";
import { fmt } from "../../config";
import { DataTable } from "./DataTable";

interface Props {
  classes: string[];
  years: number[];
  observed: number[][];
  columns: { label: string; values: number[] }[];
}

export function StackedArea({ classes, years, observed, columns }: Props) {
  const W = 680;
  const H = 280;
  const m = { l: 52, r: 12, t: 24, b: 40 };
  const colW = 46;
  const plotR = W - m.r - columns.length * (colW + 8);
  const total = Math.max(...observed.map((r) => r.reduce((a, b) => a + b, 0)), 1);
  const x = scaleLinear().domain([years[0], years[years.length - 1]]).range([m.l, plotR - 26]);
  const y = scaleLinear().domain([0, total]).range([H - m.b, m.t]);
  const colors = ["#e3e6ea", ...PALETTES.heat.slice(1, 6)];
  const rows = observed.map((r, i) => Object.fromEntries([["year", years[i]], ...classes.map((c, k) => [c, r[k]])]));
  const series = stack<Record<string, number>>().keys(classes)(rows as Record<string, number>[]);
  const ar = area<[number, number] & { data: Record<string, number> }>()
    .x((d) => x(d.data.year))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Kilometres of track by number of days at or above 40 °C, observed 1981–2025 and projected">
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="2 3" />
            <text x={m.l - 6} y={y(t) + 4} textAnchor="end">
              {fmt(t, 0)}
            </text>
          </g>
        ))}
        {series.map((s, k) => (
          <path key={classes[k]} d={ar(s as never) ?? ""} fill={colors[k]} />
        ))}
        {[1985, 1995, 2005, 2015, 2025].map((t) => (
          <text key={t} x={x(t)} y={H - m.b + 16} textAnchor="middle">
            {t}
          </text>
        ))}
        {columns.map((c, ci) => {
          const x0 = plotR + ci * (colW + 8);
          let acc = 0;
          return (
            <g key={c.label}>
              {c.values.map((v, k) => {
                const yy = y(acc + v);
                const h = y(acc) - yy;
                acc += v;
                return <rect key={k} x={x0} width={colW} y={yy} height={h} fill={colors[k]} />;
              })}
              <text x={x0 + colW / 2} y={H - m.b + 16} textAnchor="middle" style={{ fontWeight: 700 }}>
                {c.label.split(" ")[0]}
              </text>
              <text x={x0 + colW / 2} y={H - m.b + 30} textAnchor="middle" style={{ fontSize: 9 }}>
                {c.label.split(" ").slice(1).join(" ")}
              </text>
            </g>
          );
        })}
        <text x={m.l} y={12} style={{ fontWeight: 700 }}>
          km of track
        </text>
      </svg>
      <div className="row tiny" style={{ gap: 10 }}>
        <span className="muted">Days ≥ 40 °C per year:</span>
        {classes.map((c, k) => (
          <span key={c}>
            <span style={{ display: "inline-block", width: 10, height: 10, background: colors[k], borderRadius: 2, marginRight: 4 }} />
            {c}
          </span>
        ))}
      </div>
      <DataTable
        head={["Period", ...classes.map((c) => `${c} days`)]}
        rows={[...years.map((y, i) => [y, ...observed[i].map((v) => fmt(v, 0))]), ...columns.map((c) => [c.label, ...c.values.map((v) => fmt(v, 0))])]}
      />
    </div>
  );
}
