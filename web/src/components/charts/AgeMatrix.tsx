import { scaleLinear, scaleSqrt } from "d3-scale";
import { fmt } from "../../config";
import { DataTable } from "./DataTable";

interface Pt {
  line: string;
  year: number | null;
  km: number;
  d_hot40: number;
}

export function AgeMatrix({ points }: { points: Pt[] }) {
  const W = 640;
  const H = 300;
  const m = { l: 46, r: 16, t: 16, b: 34 };
  const conv = points.filter((p) => p.year === null);
  const hsl = points.filter((p) => p.year !== null);
  const x = scaleLinear().domain([1986, 2026]).range([m.l + 70, W - m.r]);
  const ys = points.map((p) => p.d_hot40);
  const y = scaleLinear().domain([Math.min(0, ...ys), Math.max(...ys, 1) * 1.1]).nice().range([H - m.b, m.t]);
  const r = scaleSqrt().domain([0, Math.max(...points.map((p) => p.km), 1)]).range([3, 22]);
  const medY = ys.length ? [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)] : 0;
  return (
    <>
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Line opening year versus projected change in days at or above 40 °C">
      <rect x={m.l} y={m.t} width={x(2005) - m.l} height={y(medY) - m.t} fill="#d32f2f" fillOpacity={0.07} />
      <text x={m.l + 4} y={m.t + 12} style={{ fill: "#d32f2f", fontWeight: 700 }}>
        older + more heat = priority
      </text>
      <line x1={m.l} x2={W - m.r} y1={y(medY)} y2={y(medY)} stroke="var(--border)" strokeDasharray="3 3" />
      {y.ticks(5).map((t) => (
        <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">
          +{fmt(t, 0)}
        </text>
      ))}
      {[1990, 2000, 2010, 2020].map((t) => (
        <text key={t} x={x(t)} y={H - 12} textAnchor="middle">
          {t}
        </text>
      ))}
      <text x={m.l + 30} y={H - 12} textAnchor="middle">
        conv.
      </text>
      {conv.map((p) => (
        <g key={p.line}>
          <circle cx={m.l + 30} cy={y(p.d_hot40)} r={r(p.km)} fill="#8b97a8" fillOpacity={0.6} stroke="#8b97a8" />
          <title>{`${p.line}: ${fmt(p.km, 0)} km, ${fmt(p.d_hot40)} more days ≥40 °C`}</title>
        </g>
      ))}
      {hsl.map((p) => (
        <g key={p.line}>
          <circle cx={x(p.year!)} cy={y(p.d_hot40)} r={r(p.km)} fill="#ff6a2b" fillOpacity={0.55} stroke="#d9480f" />
          <title>{`${p.line} (opened ${p.year}): ${fmt(p.km, 0)} km, +${fmt(p.d_hot40)} days ≥40 °C by 2041–2060 (SSP2-4.5)`}</title>
          {p.km >= 120 && (
            <text x={x(p.year!)} y={y(p.d_hot40) - r(p.km) - 3} textAnchor="middle" style={{ fontSize: 10 }}>
              {p.line.replace("LAV ", "").replace(/ \(.*\)/, "")}
            </text>
          )}
        </g>
      ))}
      <text x={W - m.r} y={m.t + 4} textAnchor="end" style={{ fontWeight: 600 }}>
        extra days ≥ 40 °C/yr (2041–2060, SSP2-4.5 vs 1995–2014)
      </text>
    </svg>
    <DataTable head={["Line", "Opened", "km", "Extra days ≥40 °C"]} rows={points.map((p) => [p.line, p.year ?? "–", fmt(p.km, 0), `+${fmt(p.d_hot40)}`])} />
    </>
  );
}
