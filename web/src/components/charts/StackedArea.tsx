import { scaleLinear } from "d3-scale";
import { area, stack } from "d3-shape";
import { PALETTES } from "../../colors";
import { fmt } from "../../config";
import { DataTable } from "./DataTable";
import { useWidth } from "./useWidth";

interface Props {
  classes: string[];
  years: number[];
  observed: number[][];
  /** Typical-year bars shown after the measured years (e.g. 2050 from the climate models). */
  columns: { label: string; sub: string; values: number[] }[];
}

/** Legend wording for the day classes produced by the pipeline ("0", "1–5", …, ">30"). */
const classLabel = (c: string) => (c === "0" ? "none" : c.startsWith(">") ? `over ${c.slice(1)}` : c);

/** One timeline: measured years as a stacked area, a divider, then typical-year bars from the models. */
export function StackedArea({ classes, years, observed, columns }: Props) {
  // drawn at the container's real width, so it fits a phone without sideways scrolling and text stays readable
  const [ref, W] = useWidth<HTMLDivElement>(680);
  const narrow = W < 520;
  const H = narrow ? 250 : 300;
  const m = { l: narrow ? 46 : 52, r: 12, t: 44, b: 40 };
  const colW = narrow ? 46 : 64;
  const gap = narrow ? 26 : 40;
  const areaR = W - m.r - columns.length * (colW + gap);
  const sepX = areaR + gap / 2;
  const total = Math.max(...observed.map((r) => r.reduce((a, b) => a + b, 0)), 1);
  const x = scaleLinear().domain([years[0], years[years.length - 1]]).range([m.l, areaR]);
  const y = scaleLinear().domain([0, total]).range([H - m.b, m.t]);
  const colors = ["#e3e6ea", ...PALETTES.heat.slice(1, 6)];
  const rows = observed.map((r, i) => Object.fromEntries([["year", years[i]], ...classes.map((c, k) => [c, r[k]])]));
  const series = stack<Record<string, number>>().keys(classes)(rows as Record<string, number>[]);
  const ar = area<[number, number] & { data: Record<string, number> }>()
    .x((d) => x(d.data.year))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]));
  const first = years[0];
  const last = years[years.length - 1];
  const ticks = [first, ...(narrow ? [2000] : [1990, 2000, 2010]).filter((t) => t > first + 4 && t < last - 4), last];
  const head = { fontWeight: 700, fill: "var(--ink)", fontFamily: "inherit", fontSize: 12 } as const;
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Kilometres of track by number of days at or above 40 °C: measured each year ${first}–${last}, then ${columns.map((c) => `${c.label} (${c.sub})`).join(", ")}`}>
        <text x={m.l} y={14} style={head}>
          {narrow ? "Measured, each year" : "Measured by NASA, year by year"}
        </text>
        {columns.length > 0 && (
          <text x={W - m.r} y={14} textAnchor="end" style={head}>
            {narrow ? "Models" : "Climate models"}
          </text>
        )}
        <text x={m.l - 6} y={m.t - 12} textAnchor="end">
          km
        </text>
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
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - m.b + 16} textAnchor={t === first ? "start" : t === last ? "end" : "middle"}>
            {t}
          </text>
        ))}
        {columns.length > 0 && <line x1={sepX} x2={sepX} y1={22} y2={H - m.b + 24} stroke="#8b929c" strokeDasharray="3 4" />}
        {columns.map((c, ci) => {
          const x0 = areaR + gap + ci * (colW + gap);
          let acc = 0;
          return (
            <g key={c.label}>
              {c.values.map((v, k) => {
                const yy = y(acc + v);
                const h = y(acc) - yy;
                acc += v;
                return <rect key={k} x={x0} width={colW} y={yy} height={h} fill={colors[k]} />;
              })}
              <text x={x0 + colW / 2} y={H - m.b + 16} textAnchor="middle" style={{ fontWeight: 700, fill: "var(--ink)" }}>
                {c.label}
              </text>
              <text x={x0 + colW / 2} y={H - m.b + 30} textAnchor="middle" style={{ fontSize: 9.5 }}>
                {c.sub}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="row tiny" style={{ gap: 10, marginTop: 6 }}>
        <span className="muted">Days at 40 °C or more in the year:</span>
        {classes.map((c, k) => (
          <span key={c}>
            <span style={{ display: "inline-block", width: 10, height: 10, background: colors[k], borderRadius: 2, marginRight: 4 }} />
            {classLabel(c)}
          </span>
        ))}
      </div>
      <DataTable
        head={["Period", ...classes.map((c) => `${c} days`)]}
        rows={[...years.map((y, i) => [y, ...observed[i].map((v) => fmt(v, 0))]), ...columns.map((c) => [`${c.label} (${c.sub})`, ...c.values.map((v) => fmt(v, 0))])]}
      />
    </div>
  );
}
