import { useMemo, useState } from "react";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { fmt } from "../../config";
import type { Summary } from "../../data/types";
import type { SegmentFC } from "../../data/load";
import { DataTable } from "./DataTable";
import { useWidth } from "./useWidth";

/** One row per high-speed line: the climate it was built for and the one it will face.
 *  built = days a year at 40 °C in the ten years before it opened (NASA POWER, track-km weighted; from 1981);
 *  today = 2016–2025; future = median of the NEX-GDDP-CMIP6 models for the chosen scenario and period. */
export interface LineRow {
  line: string;
  short: string;
  year: number;
  km: number;
  src: string | null;
  built: number;
  today: number;
  fut: number;
  dRail: number;
}

type Annual = { years: number[]; values: Record<string, Record<string, (number | null)[]>> };

export function useLineRows(segs: SegmentFC | null, summary: Summary | null, annual: Annual | null, scen: string, per: string) {
  return useMemo(() => {
    if (!segs || !summary || !annual) return null;
    const groups = new Map<string, { year: number; src: string | null; km: number; built: number; today: number; fut: number; ref: number; rf: number; rr: number }>();
    const conv = { km: 0, today: 0, fut: 0 };
    const yIdx = (y: number) => annual.years.indexOf(y);
    for (const f of segs.features) {
      const p = f.properties;
      const c = summary.cells[p.c];
      const h = c?.HOT40;
      if (!h) continue;
      const fut = h.fut?.[scen]?.[per]?.[0] ?? null;
      if (fut === null || h.late === null || h.ref === null) continue;
      const L = p.L ?? 0;
      if (p.t !== "HSL") {
        conv.km += L;
        conv.today += L * h.late;
        conv.fut += L * fut;
        continue;
      }
      if (!p.yl || !p.y) continue;
      const series = annual.values.HOT40?.[p.c] ?? [];
      const yrs = [];
      for (let y = Math.max(annual.years[0], p.y - 10); y <= Math.max(annual.years[0] + 9, p.y - 1); y++) yrs.push(series[yIdx(y)]);
      const vals = yrs.filter((v): v is number => v !== null && v !== undefined);
      const built = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : h.early ?? 0;
      const g = groups.get(p.yl) ?? { year: p.y, src: p.ys, km: 0, built: 0, today: 0, fut: 0, ref: 0, rf: 0, rr: 0 };
      g.km += L;
      g.built += L * built;
      g.today += L * h.late;
      g.fut += L * fut;
      g.rf += L * (c.RAIL_AM?.fut?.[scen]?.[per]?.[0] ?? 0);
      g.rr += L * (c.RAIL_AM?.ref ?? 0);
      groups.set(p.yl, g);
    }
    const rows: LineRow[] = [...groups.entries()]
      .filter(([, g]) => g.km > 20)
      .map(([line, g]) => ({
        line,
        short: line.replace(/^LAV /, "").replace(/ \(.*\)$/, ""),
        year: g.year,
        km: g.km,
        src: g.src,
        built: g.built / g.km,
        today: g.today / g.km,
        fut: g.fut / g.km,
        dRail: (g.rf - g.rr) / g.km,
      }))
      .sort((a, b) => a.year - b.year);
    return { rows, conv: { km: conv.km, today: conv.today / Math.max(1, conv.km), fut: conv.fut / Math.max(1, conv.km) } };
  }, [segs, summary, annual, scen, per]);
}

export function LineAgeChart({ rows, conv, era, selected, onSelect }: { rows: LineRow[]; conv: { fut: number }; era: string; selected: string | null; onSelect: (l: string) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>(760);
  const [hover, setHover] = useState<string | null>(null);
  const H = W < 560 ? 300 : 380;
  const m = { l: 40, r: 16, t: 26, b: 34 };
  const x = scaleLinear().domain([1988, 2026]).range([m.l + 6, W - m.r - 6]);
  const top = Math.max(10, conv.fut, ...rows.map((r) => Math.max(r.fut, r.built)));
  const y = scaleLinear().domain([0, top * 1.12]).nice().range([H - m.b, m.t]);
  const rad = scaleSqrt().domain([0, Math.max(...rows.map((r) => r.km), 1)]).range([5, W < 560 ? 16 : 24]);
  // labels: the hottest lines and the selected one, skipping any that would collide
  const placed: { x0: number; x1: number; y: number }[] = [];
  const labels = new Map<string, { x: number; y: number; anchor: "start" | "end" }>();
  for (const r of [...rows].sort((a, b) => (b.line === selected ? 1 : 0) - (a.line === selected ? 1 : 0) || b.fut - a.fut)) {
    const cx = x(r.year);
    const cy = y(r.fut);
    const w = r.short.length * 6.6;
    const right = cx + rad(r.km) + 6 + w < W - m.r;
    const lx = right ? cx + rad(r.km) + 6 : cx - rad(r.km) - 6;
    const box = { x0: right ? lx : lx - w, x1: right ? lx + w : lx, y: cy };
    if (placed.some((b) => Math.abs(b.y - box.y) < 15 && b.x0 < box.x1 && box.x0 < b.x1)) continue;
    placed.push(box);
    labels.set(r.line, { x: lx, y: cy + 4, anchor: right ? "start" : "end" });
  }
  const hv = rows.find((r) => r.line === hover) ?? null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`High-speed lines: opening year against days a year at 40 °C by ${era}`} onMouseLeave={() => setHover(null)}>
        <rect x={m.l} y={m.t} width={x(2006) - m.l} height={Math.max(0, y(conv.fut) - m.t)} fill="#d63a2f" fillOpacity={0.06} />
        <text x={m.l + 8} y={m.t + 14} style={{ fill: "#b42318", fontWeight: 700, fontSize: 12 }}>
          older and hotter: check first
        </text>
        <g className="grid">
          {y.ticks(5).map((t) => (
            <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {y.ticks(5).map((t) => (
          <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t, 0)}
          </text>
        ))}
        {[1990, 2000, 2010, 2020].map((t) => (
          <text key={t} x={x(t)} y={H - 12} textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={m.l} y={12} style={{ fontWeight: 650, fill: "var(--ink-2)" }}>
          days a year at 40 °C
        </text>
        {W >= 560 && (
          <text x={W - m.r} y={H - 12} textAnchor="end" style={{ fill: "var(--ink-2)" }}>
            year opened →
          </text>
        )}
        <line x1={m.l} x2={W - m.r} y1={y(conv.fut)} y2={y(conv.fut)} stroke="#8b929c" strokeDasharray="5 5" />
        <text x={W - m.r} y={y(conv.fut) - 6} textAnchor="end" style={{ fill: "var(--ink-2)" }} stroke="#fff" strokeWidth={4} paintOrder="stroke">
          conventional lines: {fmt(conv.fut, 0)} days
        </text>
        {rows.map((r) => {
          const on = r.line === selected;
          const dim = hover !== null && r.line !== hover && !on;
          const cx = x(r.year);
          return (
            <g key={r.line} style={{ cursor: "pointer" }} opacity={dim ? 0.45 : 1} onMouseEnter={() => setHover(r.line)} onClick={() => onSelect(r.line)}>
              <line x1={cx} x2={cx} y1={y(r.built)} y2={y(r.fut)} stroke="#c2410c" strokeOpacity={0.5} strokeWidth={2} />
              <circle cx={cx} cy={y(r.built)} r={4.5} fill="#fff" stroke="#8b929c" strokeWidth={2} />
              <circle cx={cx} cy={y(r.fut)} r={rad(r.km)} fill="#c2410c" fillOpacity={0.75} stroke={on ? "var(--ink)" : "#fff"} strokeWidth={on ? 2.5 : 2} />
              <circle cx={cx} cy={y(r.fut)} r={Math.max(rad(r.km), 14)} fill="transparent" />
              {labels.has(r.line) && (
                <text x={labels.get(r.line)!.x} y={labels.get(r.line)!.y} textAnchor={labels.get(r.line)!.anchor} style={{ fill: "var(--ink)", fontWeight: on ? 700 : 550, fontSize: 12, fontFamily: "var(--font)" }} stroke="#fff" strokeWidth={4} paintOrder="stroke">
                  {r.short}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hv && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(x(hv.year), 110), W - 110), top: Math.max(0, y(hv.fut) - 70), transform: "translateX(-50%)" }}>
          <b>{hv.short}</b> · opened {hv.year} · {fmt(hv.km, 0)} km
          <div>
            built for {fmt(hv.built, hv.built < 10 ? 1 : 0)} days a year at 40 °C → {era}: {fmt(hv.fut, hv.fut < 10 ? 1 : 0)}
          </div>
        </div>
      )}
      <div className="la-legend">
        <span>
          <i className="o" /> Built for: its climate before opening (10-year average)
        </span>
        <span>
          <i className="f" /> In {era} (bigger bubble = longer line)
        </span>
        <span>
          <i className="d" /> Conventional lines in {era}
        </span>
      </div>
      <DataTable
        head={["Line", "Opened", "km", "Days ≥ 40 °C when built", "Today", era]}
        rows={rows.map((r) => [r.line, r.year, fmt(r.km, 0), fmt(r.built, 1), fmt(r.today, 1), fmt(r.fut, 1)])}
      />
    </div>
  );
}
