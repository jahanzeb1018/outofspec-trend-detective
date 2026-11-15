import { scaleLinear } from "d3-scale";
import { area, curveBasis } from "d3-shape";
import { fmt } from "../../config";
import { DataTable } from "./DataTable";

interface Dist {
  label: string;
  values: number[]; // daily excess T_rail - T_N (degC)
  color: string;
}

export function LoadStrengthChart({ dists, allow }: { dists: Dist[]; allow: { med: number; lo: number; hi: number } }) {
  const W = 620;
  const H = 250;
  const m = { l: 36, r: 12, t: 16, b: 46 };
  const lo = -30;
  const hi = Math.max(allow.hi + 10, 55);
  const bins = 64;
  const bw = (hi - lo) / bins;
  const hists = dists.map((d) => {
    const h = new Array(bins).fill(0);
    for (const v of d.values) {
      const i = Math.floor((v - lo) / bw);
      if (i >= 0 && i < bins) h[i]++;
    }
    const n = d.values.length || 1;
    return h.map((c, i) => [lo + (i + 0.5) * bw, c / n / bw] as [number, number]);
  });
  const ymax = Math.max(0.01, ...hists.flat().map((p) => p[1]));
  const x = scaleLinear().domain([lo, hi]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, ymax * 1.1]).range([H - m.b, m.t]);
  const ar = area<[number, number]>()
    .x((p) => x(p[0]))
    .y0(y(0))
    .y1((p) => y(p[1]))
    .curve(curveBasis);
  const exceed = dists.map((d) => (d.values.length ? (100 * d.values.filter((v) => v > allow.med).length) / d.values.length : 0));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Distribution of daily rail-temperature excess over the neutral temperature compared with the allowable increase">
        <rect x={x(allow.lo)} width={Math.max(2, x(allow.hi) - x(allow.lo))} y={m.t} height={H - m.b - m.t} fill="#d32f2f" fillOpacity={0.12} />
        <rect x={x(allow.med)} width={x(hi) - x(allow.med)} y={m.t} height={H - m.b - m.t} fill="#d32f2f" fillOpacity={0.06} />
        <line x1={x(allow.med)} x2={x(allow.med)} y1={m.t} y2={H - m.b} stroke="#d32f2f" strokeWidth={2.5} />
        <text x={x(allow.med) + 5} y={m.t + 10} style={{ fill: "#d32f2f", fontWeight: 700 }}>
          allowable ΔT ≈ {fmt(allow.med)} °C
        </text>
        {hists.map((h, i) => (
          <path key={dists[i].label} d={ar(h) ?? ""} fill={dists[i].color} fillOpacity={0.35} stroke={dists[i].color} strokeWidth={1.5} />
        ))}
        {x.ticks(8).map((t) => (
          <text key={t} x={x(t)} y={H - m.b + 16} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={W - m.r} y={H - 4} textAnchor="end" style={{ fontWeight: 600 }}>
          rail temperature − neutral temperature (°C)
        </text>
      </svg>
      <div className="row tiny" style={{ gap: 14 }}>
        {dists.map((d, i) => (
          <span key={d.label} style={{ color: d.color, fontWeight: 600 }}>
            ■ {d.label} · {fmt(exceed[i], 2)}% of warm-season days beyond the line
          </span>
        ))}
      </div>
      <DataTable
        head={["Period", "Days", "Median excess", "Hottest 1% of days", "Share beyond the allowable line"]}
        rows={dists.map((d, i) => {
          const s = [...d.values].sort((a, b) => a - b);
          const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
          return [d.label, s.length, `${fmt(q(0.5))} °C`, `${fmt(q(0.99))} °C`, `${fmt(exceed[i], 2)}%`];
        })}
      />
    </div>
  );
}
