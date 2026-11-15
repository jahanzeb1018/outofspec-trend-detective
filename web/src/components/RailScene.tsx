import { useEffect, useRef, useState } from "react";

export type Hazard = "heat" | "cold" | "rain";

/** Rail colour from cool steel to glowing red. */
export function railColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [40, [107, 114, 128]],
    [50, [180, 170, 150]],
    [55, [245, 158, 11]],
    [60, [239, 106, 58]],
    [66, [200, 30, 30]],
  ];
  if (t <= stops[0][0]) return `rgb(${stops[0][1].join(",")})`;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const f = (t - t0) / (t1 - t0);
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(",")})`;
}

function useTween(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - k) ** 3;
      const x = a + (target - a) * e;
      from.current = x;
      setV(x);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const W = 420;
const H = 250;
const HZ = 92; // horizon
const VPX = 210;

const mix = (a: number[], b: number[], f: number) => `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * Math.max(0, Math.min(1, f)))).join(",")})`;

/**
 * A stretch of track seen from the cab, showing one hazard:
 *  heat — rails tinted by temperature, heat haze, sideways "sun kink" past what the track can take;
 *  cold — frost and snow, steel-blue rails, a snapped rail on very cold nights;
 *  rain — downpour, puddles, ballast washed out from under the track on extreme days.
 */
export function RailScene({ hazard = "heat", rail = 40, limit = 60, cold = 5, rain = 0, breakAt = -10 }: { hazard?: Hazard; rail?: number; limit?: number; cold?: number; rain?: number; breakAt?: number }) {
  const heat = hazard === "heat";
  const margin = limit - rail;
  const amp = useTween(heat ? (margin < 0 ? Math.min(34, 15 + -margin * 2.5) : margin < 5 ? 3 : 0) : 0);
  const temp = useTween(heat ? rail : 30);
  const frost = useTween(hazard === "cold" ? Math.max(0, Math.min(1, (3 - cold) / 13)) : 0); // 0 at +3 °C, 1 at −10 °C
  const wet = useTween(hazard === "rain" ? Math.max(0, Math.min(1, rain / 60)) : 0); // 1 at 60 mm/day
  const washout = hazard === "rain" && rain >= 50;
  const broken = hazard === "cold" && cold <= breakAt;
  const sag = useTween(washout ? 9 : 0);

  const h = heat ? Math.max(0, Math.min(1, (temp - 40) / 26)) : 0;
  const col = heat ? railColor(temp) : hazard === "cold" ? mix([120, 128, 140], [70, 110, 190], frost) : mix([110, 116, 126], [80, 86, 96], wet);
  const y = (t: number) => HZ + (H - HZ) * t + sag * Math.exp(-(((t - 0.62) / 0.07) ** 2)) * t;
  const half = (t: number) => 3 + 112 * t;
  const shift = (t: number) => {
    const u = (t - 0.6) / 0.13;
    return amp * Math.sin(u * 1.6) * Math.exp(-u * u * 0.6) * (0.35 + t);
  };
  const cx = (t: number) => VPX + shift(t);
  const ts = Array.from({ length: 60 }, (_, i) => 0.02 + (0.98 * i) / 59);
  const railPts = (side: -1 | 1) => ts.map((t) => [cx(t) + side * half(t), y(t), t] as const);
  const yb = (t: number) => HZ + (H - HZ) * t; // ballast does not sag
  const ballast = [...ts.map((t) => `${(cx(t) - half(t) * 1.55).toFixed(1)},${yb(t).toFixed(1)}`), ...[...ts].reverse().map((t) => `${(cx(t) + half(t) * 1.55).toFixed(1)},${yb(t).toFixed(1)}`)].join(" ");
  const sleepers = Array.from({ length: 16 }, (_, k) => 0.06 + 0.94 * ((k + 1) / 16) ** 1.7);
  const tagT = 0.74;
  const [lx, ly] = [cx(tagT) + half(tagT), y(tagT)];

  const sky0 = heat ? [Math.round(222 + 30 * h), Math.round(236 - 12 * h), Math.round(250 - 50 * h)] : hazard === "cold" ? [Math.round(214 - 40 * frost), Math.round(226 - 30 * frost), Math.round(240 - 10 * frost)] : [Math.round(200 - 70 * wet), Math.round(208 - 70 * wet), Math.round(216 - 60 * wet)];
  const ground0 = hazard === "cold" ? mix([232, 226, 211], [244, 247, 252], frost * 1.2) : hazard === "rain" ? mix([232, 226, 211], [178, 172, 156], wet) : "rgb(232,226,211)";
  const ballastCol = hazard === "cold" ? mix([184, 176, 160], [214, 220, 230], frost) : hazard === "rain" ? mix([184, 176, 160], [140, 134, 122], wet) : "#b8b0a0";
  const sunR = 15 + 5 * h;
  const sunCol = `rgb(250, ${Math.round(204 - 90 * h)}, ${Math.round(80 - 60 * h)})`;
  const tag = heat ? `${Math.round(temp)} °C` : hazard === "cold" ? `${Math.round(cold)} °C` : `${Math.round(rain)} mm`;
  const tagSub = heat ? "rail temperature" : hazard === "cold" ? "coldest night" : "rain in one day";
  const gapT = [0.66, 0.705];
  const warn = heat && margin < 0 ? { t: "⚠ Sun kink", c: "#c62828" } : broken ? { t: "⚠ Rail break risk", c: "#1d4ed8" } : hazard === "cold" && cold <= -7 ? { t: "❄ Severe frost", c: "#1d4ed8" } : hazard === "cold" && cold <= -5 ? { t: "❄ Hard frost", c: "#2563eb" } : washout ? { t: "⚠ Washout risk", c: "#0f766e" } : hazard === "rain" && rain >= 30 ? { t: "Heavy rain", c: "#0e7490" } : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${hazard} scene: ${tag}${warn ? `, ${warn.t}` : ""}`} style={{ display: "block", borderRadius: 14 }}>
      <defs>
        <linearGradient id="rs-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={`rgb(${sky0.join(",")})`} />
          <stop offset="100%" stopColor={hazard === "rain" ? mix([248, 247, 242], [170, 176, 184], wet) : "#f8f7f2"} />
        </linearGradient>
        <filter id="rs-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={HZ + 1} fill="url(#rs-sky)" />
      <path d={`M0 ${HZ} L60 ${HZ - 14} L120 ${HZ - 6} L190 ${HZ - 18} L260 ${HZ - 8} L330 ${HZ - 20} L420 ${HZ - 6} L420 ${HZ} Z`} fill={hazard === "cold" ? mix([214, 210, 196], [236, 240, 247], frost) : "#d6d2c4"} />
      <rect x="0" y={HZ} width={W} height={H - HZ} fill={ground0} />

      {/* sky object */}
      {heat && (
        <g transform="translate(352 38)">
          {Array.from({ length: 10 }, (_, k) => (
            <line key={k} x1={0} y1={-(sunR + 5)} x2={0} y2={-(sunR + 11 + 6 * h)} stroke={sunCol} strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${k * 36})`} opacity={0.8} />
          ))}
          <circle r={sunR} fill={sunCol} />
        </g>
      )}
      {hazard === "cold" && (
        <g transform="translate(352 38)">
          <circle r={14} fill="#f3f4f6" />
          <circle r={14} cx={7} cy={-4} fill={`rgb(${sky0.join(",")})`} />
        </g>
      )}
      {hazard === "rain" && (
        <g opacity={0.35 + 0.6 * wet}>
          {[[90, 30, 1], [250, 22, 1.3], [360, 40, 1.1]].map(([x0, y0, s]) => (
            <g key={x0} transform={`translate(${x0} ${y0}) scale(${s})`} fill="#7b8491">
              <circle cx={0} cy={6} r={14} />
              <circle cx={18} cy={0} r={18} />
              <circle cx={38} cy={7} r={13} />
              <rect x={0} y={6} width={38} height={14} />
            </g>
          ))}
        </g>
      )}

      {/* ballast, washout hole, sleepers */}
      <polygon points={ballast} fill={ballastCol} />
      {washout && <ellipse cx={cx(0.63)} cy={yb(0.63) + 4} rx={half(0.63) * 1.25} ry={9} fill="#5b4a36" opacity={0.85} />}
      {hazard === "rain" && wet > 0.2 && [0.35, 0.82, 0.95].map((t, k) => <ellipse key={k} cx={cx(t) + (k % 2 ? 1 : -1) * half(t) * 1.3} cy={yb(t) + 3} rx={8 + 18 * t} ry={2 + 4 * t} fill="#8fb3c9" opacity={0.6 * wet} />)}
      {sleepers.map((t) => (
        <line key={t} x1={cx(t) - half(t) * 1.25} x2={cx(t) + half(t) * 1.25} y1={y(t)} y2={y(t)} stroke={hazard === "cold" ? mix([125, 116, 102], [150, 160, 175], frost) : "#7d7466"} strokeWidth={1 + 7 * t} strokeLinecap="round" />
      ))}
      {hazard === "cold" && frost > 0.3 && sleepers.map((t, k) => (k % 2 ? <line key={`f${k}`} x1={cx(t) - half(t)} x2={cx(t) + half(t) * 0.6} y1={y(t) - 1} y2={y(t) - 1} stroke="#ffffff" strokeWidth={0.6 + 2.5 * t} strokeLinecap="round" opacity={frost} /> : null))}

      {/* glow under hot rails */}
      {heat && h > 0.45 &&
        ([-1, 1] as const).map((s) => (
          <polyline key={`g${s}`} points={railPts(s).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")} fill="none" stroke={col} strokeWidth={9} opacity={(h - 0.45) * 1.4} filter="url(#rs-glow)" />
        ))}
      {/* rails: segments get thicker towards the viewer; a gap when a rail snaps */}
      {([-1, 1] as const).map((s) => {
        const p = railPts(s);
        return p.slice(1).map(([x, yy, t], i) => (broken && s === 1 && t > gapT[0] && t < gapT[1] ? null : <line key={`${s}${i}`} x1={p[i][0]} y1={p[i][1]} x2={x} y2={yy} stroke={col} strokeWidth={0.8 + 5 * t} strokeLinecap="round" />));
      })}
      {broken && <path d={`M${cx(gapT[0]) + half(gapT[0]) - 6} ${y(gapT[0]) - 8} l 5 6 l -4 4 l 6 6`} fill="none" stroke="#1d4ed8" strokeWidth={2} />}

      {/* weather */}
      {heat && temp >= 52 &&
        [0, 1, 2].map((k) => (
          <path key={k} className="haze" d={`M${150 + k * 45} ${150 - k * 6} q 8 -10 0 -20 q -8 -10 0 -20`} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" opacity={0.5} style={{ animationDelay: `${k * 0.5}s` }} />
        ))}
      {hazard === "cold" && frost > 0.15 &&
        Array.from({ length: Math.round(10 + 30 * frost) }, (_, k) => (
          <circle key={k} className="snow" cx={(k * 97) % W} cy={(k * 53) % (H - 20)} r={1.2 + (k % 3) * 0.6} fill="#ffffff" opacity={0.9} style={{ animationDelay: `${(k % 7) * 0.4}s` }} />
        ))}
      {hazard === "rain" && wet > 0.05 &&
        Array.from({ length: Math.round(12 + 60 * wet) }, (_, k) => (
          <line key={k} className="rain" x1={(k * 53) % W} y1={(k * 37) % H} x2={((k * 53) % W) - 4} y2={((k * 37) % H) + 12} stroke="#5f7d95" strokeWidth={1.3} opacity={0.65} style={{ animationDelay: `${(k % 9) * 0.09}s` }} />
        ))}

      {/* tag */}
      <line x1={lx} y1={ly} x2={lx + 46} y2={ly - 34} stroke="#0c0d0f" strokeWidth={1.2} />
      <g transform={`translate(${Math.min(W - 112, lx + 40)} ${ly - 74})`}>
        <rect width="104" height="46" rx="10" fill="#0c0d0f" />
        <text x="52" y="23" textAnchor="middle" style={{ fill: "#fff", fontFamily: "var(--mono)", fontWeight: 700, fontSize: 19 }}>{tag}</text>
        <text x="52" y="37" textAnchor="middle" style={{ fill: "#b9c0c9", fontSize: 9.5 }}>{tagSub}</text>
      </g>
      {warn && (
        <g transform={`translate(${Math.max(8, cx(0.6) - 175)} ${y(0.6) - 30})`}>
          <rect width={warn.t.length * 7.2 + 18} height="26" rx="13" fill={warn.c} />
          <text x={(warn.t.length * 7.2 + 18) / 2} y="17.5" textAnchor="middle" style={{ fill: "#fff", fontWeight: 700, fontSize: 12 }}>{warn.t}</text>
        </g>
      )}
    </svg>
  );
}

/** A value on a coloured scale with reference marks (track limits, frost thresholds, rain thresholds). */
export function Gauge({ value, min, max, gradient, marks, unit = "°" }: { value: number; min: number; max: number; gradient: string; marks: { v: number; label: string; bold?: boolean; row?: number }[]; unit?: string }) {
  const x = (v: number) => `${((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100}%`;
  return (
    <div style={{ position: "relative", padding: `26px 0 ${marks.some((m) => m.row) ? 50 : 34}px` }} aria-label={`${Math.round(value)}${unit}`}>
      <div style={{ height: 10, borderRadius: 5, background: gradient }} />
      <div style={{ position: "absolute", left: x(value), top: 0, transform: "translateX(-50%)", textAlign: "center", transition: "left .6s" }}>
        <div className="mono" style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
          {Math.round(value)}
          {unit}
        </div>
        <div style={{ width: 0, height: 0, margin: "1px auto 0", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #0c0d0f" }} />
      </div>
      {marks.map((l) => (
        <div key={l.label} style={{ position: "absolute", left: x(l.v), top: 22, transform: "translateX(-50%)", textAlign: "center" }}>
          <div style={{ width: 2, height: 18 + (l.row ?? 0) * 16, margin: "0 auto", background: l.bold ? "#0c0d0f" : "#9aa1ac" }} />
          <div className="tiny" style={{ whiteSpace: "nowrap", color: l.bold ? "var(--ink)" : "var(--muted)", fontWeight: l.bold ? 650 : 400 }}>
            {l.label}
          </div>
        </div>
      ))}
    </div>
  );
}
