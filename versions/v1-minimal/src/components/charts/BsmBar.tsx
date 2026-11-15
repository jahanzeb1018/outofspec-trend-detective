import { scaleLinear } from "d3-scale";
import { BAND_COLOR } from "../../colors";
import { fmt } from "../../config";
import { BSM_THRESHOLDS, bsmBand } from "../../model/buckling";
import { DataTable } from "./DataTable";

export interface BsmMarker {
  label: string;
  med: number;
  p10: number;
  p90: number;
  color: string;
}

export function BsmBar({ markers }: { markers: BsmMarker[] }) {
  const W = 620;
  const H = 54 + markers.length * 22;
  const lo = Math.min(-15, ...markers.map((m) => m.p10 - 2));
  const hi = Math.max(40, ...markers.map((m) => m.p90 + 2));
  const x = scaleLinear().domain([lo, hi]).range([10, W - 10]);
  const bands = [
    { from: lo, to: 0, k: "none", label: "No margin" },
    { from: 0, to: BSM_THRESHOLDS.adequate, k: "minimum", label: "Minimum" },
    { from: BSM_THRESHOLDS.adequate, to: BSM_THRESHOLDS.desired, k: "adequate", label: "Adequate" },
    { from: BSM_THRESHOLDS.desired, to: hi, k: "desired", label: "Desired" },
  ];
  return (
    <>
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Buckling safety margin: ${markers.map((m) => `${m.label} ${fmt(m.med)} °C`).join(", ")}`}>
      {bands.map((b) => (
        <g key={b.k}>
          <rect x={x(b.from)} width={x(b.to) - x(b.from)} y={10} height={18} fill={BAND_COLOR[b.k]} fillOpacity={0.85} />
          <text x={(x(b.from) + x(b.to)) / 2} y={23} textAnchor="middle" style={{ fill: "#fff", fontWeight: 700 }}>
            {b.label}
          </text>
        </g>
      ))}
      {[0, 11.1, 22.2].map((t) => (
        <text key={t} x={x(t)} y={42} textAnchor="middle">
          {t === 0 ? "0" : fmt(t, 0)} °C
        </text>
      ))}
      {markers.map((m, i) => {
        const yy = 58 + i * 22;
        return (
          <g key={m.label}>
            <line x1={x(m.p10)} x2={x(m.p90)} y1={yy} y2={yy} stroke={m.color} strokeWidth={2} />
            <circle cx={x(m.med)} cy={yy} r={6} fill={m.color} stroke="var(--surface)" strokeWidth={2} />
            <line x1={x(m.med)} x2={x(m.med)} y1={28} y2={yy - 6} stroke={m.color} strokeDasharray="2 2" />
            <text x={Math.min(W - 160, x(m.p90) + 8)} y={yy + 4} style={{ fill: "var(--text)", fontWeight: 600 }}>
              {m.label}: {fmt(m.med)} °C
            </text>
          </g>
        );
      })}
    </svg>
    <DataTable head={["Period", "Median margin", "10th–90th percentile", "FRA band"]} rows={markers.map((m) => [m.label, `${fmt(m.med)} °C`, `${fmt(m.p10)} to ${fmt(m.p90)} °C`, bsmBand(m.med)])} />
    </>
  );
}
