import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Verdict } from "./kit";
import { periodMean } from "./kit";
import { fmt } from "../config";

export function Stamp({ v, small }: { v: Verdict; small?: boolean }) {
  return <span className={`stamp ${v.cls === "rare" ? "none" : v.cls} ${small ? "sm" : ""}`}>{v.stamp}</span>;
}

/** Story frame: progress bars on top, round prev/next buttons, arrow keys. */
export function Story({ i, n, onGo, children, narrow }: { i: number; n: number; onGo: (i: number) => void; children: ReactNode; narrow?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" && i < n - 1) onGo(i + 1);
      if (e.key === "ArrowLeft" && i > 0) onGo(i - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [i, n, onGo]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);
  return (
    <div className="story">
      <div className="bars" aria-hidden>
        {Array.from({ length: n }, (_, k) => (
          <i key={k} className={k < i ? "done" : k === i ? "on" : ""} />
        ))}
      </div>
      <div key={i} className={`story-body card-in ${narrow ? "narrow" : ""}`}>
        {children}
      </div>
      <nav className="storynav" aria-label="Case navigation">
        <button onClick={() => onGo(i - 1)} disabled={i === 0} aria-label="Previous">
          <ArrowLeft size={20} />
        </button>
        <span className="count">
          {i + 1} / {n}
        </span>
        <button className="next" onClick={() => onGo(i + 1)} disabled={i === n - 1} aria-label="Next">
          <ArrowRight size={20} />
        </button>
      </nav>
    </div>
  );
}

/** One bar per year; the two compared decades in colour with their mean marked. */
export function YearBars({ years, values, unit, color = "#ef4b3c", early = [1981, 1990], late = [2016, 2025] }: { years: number[]; values: (number | null)[]; unit: string; color?: string; early?: [number, number]; late?: [number, number] }) {
  const W = 760;
  const H = 230;
  const m = { l: 34, r: 8, t: 26, b: 22 };
  const vmax = Math.max(1, ...values.map((v) => v ?? 0));
  const nice = vmax <= 5 ? 5 : vmax <= 10 ? 10 : Math.ceil(vmax / 10) * 10;
  const bw = (W - m.l - m.r) / years.length;
  const y = (v: number) => H - m.b - (v / nice) * (H - m.t - m.b);
  const e = periodMean(years, values, early[0], early[1]);
  const l = periodMean(years, values, late[0], late[1]);
  const xOf = (yr: number) => m.l + (yr - years[0]) * bw;
  const inE = (yr: number) => yr >= early[0] && yr <= early[1];
  const inL = (yr: number) => yr >= late[0] && yr <= late[1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Yearly ${unit}, ${years[0]}–${years[years.length - 1]}`}>
      {[0, nice / 2, nice].map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#26272b" />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end">{fmt(t, 0)}</text>
        </g>
      ))}
      {years.map((yr, i) => {
        const v = values[i];
        if (v === null || v === undefined) return null;
        return <rect key={yr} x={xOf(yr) + 1} y={y(v)} width={Math.max(1, bw - 2)} height={Math.max(0.5, y(0) - y(v))} rx={1.5} fill={inE(yr) ? "#8a8882" : inL(yr) ? color : "#3a3c42"} />;
      })}
      {e !== null && (
        <g>
          <line x1={xOf(early[0])} x2={xOf(early[1] + 1)} y1={y(e)} y2={y(e)} stroke="#f0efec" strokeWidth={2} />
          <text x={xOf(early[0])} y={y(e) - 6} style={{ fill: "#f0efec", fontWeight: 700 }}>{fmt(e, e < 10 ? 1 : 0)}</text>
        </g>
      )}
      {l !== null && (
        <g>
          <line x1={xOf(late[0])} x2={xOf(late[1] + 1)} y1={y(l)} y2={y(l)} stroke="#f0efec" strokeWidth={2} />
          <text x={xOf(late[1] + 1)} y={y(l) - 6} textAnchor="end" style={{ fill: "#f0efec", fontWeight: 700 }}>{fmt(l, l < 10 ? 1 : 0)}</text>
        </g>
      )}
      {[years[0], 1990, 2000, 2010, 2020, years[years.length - 1]].map((yr) => (
        <text key={yr} x={xOf(yr) + bw / 2} y={H - 6} textAnchor="middle">{yr}</text>
      ))}
    </svg>
  );
}

/** Warming stripes: each year coloured by its anomaly against 1981–2010. */
export function Stripes({ years, values, unit, decimals = 1 }: { years: number[]; values: (number | null)[]; unit: string; decimals?: number }) {
  const W = 760;
  const H = 150;
  const base = periodMean(years, values, 1981, 2010) ?? 0;
  const an = values.map((v) => (v === null ? null : v - base));
  const amp = Math.max(0.5, ...an.map((a) => Math.abs(a ?? 0)));
  const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, k) => Math.round(v + (c2[k] - v) * t)).join(",")})`;
  const MID = [58, 60, 66];
  const col = (a: number) => {
    const t = Math.max(-1, Math.min(1, a / amp));
    return t >= 0 ? mix(MID, [239, 75, 60], t) : mix(MID, [59, 130, 246], -t);
  };
  const bw = W / years.length;
  const e = periodMean(years, values, 1981, 1990);
  const l = periodMean(years, values, 2016, 2025);
  return (
    <div>
      <div className="row mono small" style={{ justifyContent: "space-between", color: "var(--ink-2)" }}>
        <span>1981–1990 · {fmt(e, decimals)} {unit}</span>
        <span>2016–2025 · {fmt(l, decimals)} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="chart" role="img" aria-label={`Stripes of yearly ${unit}`} style={{ marginTop: 8 }}>
        {years.map((yr, i) => (an[i] === null ? null : <rect key={yr} x={i * bw} y={0} width={bw + 0.5} height={H} fill={col(an[i] as number)} />))}
        {[years[0], 1990, 2000, 2010, 2020, years[years.length - 1]].map((yr) => (
          <text key={yr} x={(yr - years[0]) * bw + bw / 2} y={H + 14} textAnchor="middle">{yr}</text>
        ))}
      </svg>
      <div className="row small muted" style={{ gap: 8, marginTop: 4 }}>
        <span>Cooler</span>
        <span style={{ width: 120, height: 8, borderRadius: 4, background: "linear-gradient(90deg, rgb(59,130,246), rgb(58,60,66), rgb(239,75,60))" }} />
        <span>Hotter than 1981–2010</span>
      </div>
    </div>
  );
}

/** Unit chart: one square per day/night, then vs now; extra ones highlighted. */
export function UnitRows({ a, b, labelA, labelB, cold }: { a: number; b: number; labelA: string; labelB: string; cold?: boolean }) {
  const A = Math.round(a);
  const B = Math.round(b);
  const cap = 120;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <div className="mono small muted">{labelA} · {A}</div>
        <div className={`dots ${cold ? "cold" : ""}`} style={{ marginTop: 6 }}>
          {Array.from({ length: Math.min(A, cap) }, (_, i) => <i key={i} className="on" style={{ opacity: 0.55 }} />)}
        </div>
      </div>
      <div>
        <div className="mono small" style={{ color: "var(--ink)" }}>{labelB} · {B}</div>
        <div className={`dots ${cold ? "cold" : ""}`} style={{ marginTop: 6 }}>
          {Array.from({ length: Math.min(B, cap) }, (_, i) => <i key={i} className={i >= A && !cold ? "new" : "on"} />)}
        </div>
      </div>
      {Math.max(A, B) > cap && <div className="note">Capped at {cap} squares.</div>}
    </div>
  );
}

/** A short piece of track drawn straight or kinked, depending on the margin. */
export function Bend({ margin, height = 80 }: { margin: number; height?: number }) {
  const kink = margin < 0 ? Math.min(26, 9 + -margin * 2.5) : margin < 11 ? 3 : 0;
  const path = (yy: number) => {
    let s = `M10 ${yy}`;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const b = kink * Math.sin((t - 0.5) * Math.PI * 2) * Math.exp(-(((t - 0.5) / 0.16) ** 2));
      s += ` L${(10 + t * 380).toFixed(1)} ${(yy + b).toFixed(1)}`;
    }
    return s;
  };
  const col = margin < 0 ? "#ff5d50" : "#c9c7c1";
  return (
    <svg viewBox="0 0 400 70" width="100%" height={height} role="img" aria-label={margin < 0 ? "Track drawn kinked" : "Track drawn straight"}>
      {[30, 70, 110, 150, 190, 230, 270, 310, 350, 390].map((x) => (
        <line key={x} x1={x - 10} y1={14} x2={x - 10} y2={56} stroke="#4a4c52" strokeWidth={5} strokeLinecap="round" />
      ))}
      <path d={path(27)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .5s" }} />
      <path d={path(43)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .5s" }} />
    </svg>
  );
}

export function Odds({ n, of = 10, color = "#ef4b3c" }: { n: number; of?: number; color?: string }) {
  return (
    <div className="row" style={{ gap: 6 }} role="img" aria-label={`${n} in ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: i < n ? color : "#2a2b30", border: "1px solid #3a3c42" }} />
      ))}
    </div>
  );
}
