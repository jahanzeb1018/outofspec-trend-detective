import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { DataTable } from "./DataTable";

export interface StripBand {
  label: string;
  colors: string[]; // one per sample
  values: string[]; // tooltip text per sample
}

interface Props {
  lengthKm: number;
  kms: number[];
  stations: { name: string; km: number }[];
  bands: StripBand[];
  places: string[];
}

export function RouteStrip({ lengthKm, kms, stations, bands, places }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const top = 68;
  const bandH = 30;
  const H = top + bands.length * (bandH + 22) + 6;
  const x = scaleLinear().domain([0, Math.max(1, lengthKm)]).range([10, W - 10]);
  const step = kms.length > 1 ? kms[1] - kms[0] : 1;
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.target as SVGRectElement).getBoundingClientRect();
    const km = x.invert(((e.clientX - r.left) / r.width) * (W - 20) + 10);
    let best = 0;
    for (let i = 0; i < kms.length; i++) if (Math.abs(kms[i] - km) < Math.abs(kms[best] - km)) best = i;
    setHover(best);
  };
  return (
    <div className="strip-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" style={{ minWidth: 560 }} role="img" aria-label={`Route strip, ${Math.round(lengthKm)} km, ${bands.map((b) => b.label).join(" and ")}`}>
        <line x1={x(0)} x2={x(lengthKm)} y1={30} y2={30} stroke="var(--text)" strokeWidth={2} />
        {stations.map((s, i) => (
          <g key={s.name + i}>
            <circle cx={x(s.km)} cy={30} r={5} fill="var(--surface)" stroke="var(--text)" strokeWidth={2} />
            <text x={x(s.km)} y={18} textAnchor={i === 0 ? "start" : i === stations.length - 1 ? "end" : "middle"} style={{ fill: "var(--text)", fontWeight: 700, fontSize: 12 }}>
              {s.name}
            </text>
          </g>
        ))}
        {bands.map((b, bi) => {
          const y0 = top + bi * (bandH + 22);
          return (
            <g key={b.label}>
              <text x={10} y={y0 - 5} style={{ fontWeight: 600 }}>
                {b.label}
              </text>
              {kms.map((k, i) => (
                <rect key={k} x={x(k)} width={Math.max(0.5, x(k + step) - x(k)) + 0.4} y={y0} height={bandH} fill={b.colors[i]} />
              ))}
            </g>
          );
        })}
        {hover !== null && <line x1={x(kms[hover])} x2={x(kms[hover])} y1={26} y2={H} stroke="var(--text)" strokeWidth={1.5} />}
        <rect x={10} y={top} width={W - 20} height={H - top} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="note" style={{ marginTop: 4 }}>
          <b>km {Math.round(kms[hover])}</b> · {places[hover]} · {bands.map((b) => `${b.label}: ${b.values[hover]}`).join(" · ")}
        </div>
      )}
      <DataTable
        summary="Show data table (every 10 km)"
        head={["km", "Where", ...bands.map((b) => b.label)]}
        rows={kms.flatMap((k, i) => (i % 10 === 0 || i === kms.length - 1 ? [[Math.round(k), places[i], ...bands.map((b) => b.values[i])]] : []))}
      />
    </div>
  );
}
