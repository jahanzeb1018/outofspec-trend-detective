import { useState } from "react";
import { Seg } from "./ui";
import { dtAllow, PRESET_FP, TENSION_KN_PER_C, TN_DIST } from "../model/buckling";
import { fmt } from "../config";

const TN = TN_DIST.values.reduce((a, v, i) => a + v * TN_DIST.probs[i], 0);

/** Interactive explainer: air temperature -> rail temperature -> push -> margin -> does the track bend? */
export function TrackDemo() {
  const [air, setAir] = useState(40);
  const [track, setTrack] = useState<"strong" | "weak">("strong");
  const allow = dtAllow(PRESET_FP[track]!);
  const rail = air + 17;
  const load = rail - TN;
  const margin = allow - load;
  const st = margin >= 11 ? { t: "Comfortable", c: "var(--ok)", n: "Plenty of room before the track moves." } : margin >= 0 ? { t: "Tight", c: "var(--tight)", n: "Close to the limit in the hottest hours." } : { t: "No margin", c: "var(--bad)", n: "The track could kink sideways — trains would have to slow down." };
  const kink = margin < 0 ? Math.min(26, 8 + -margin * 3) : margin < 11 ? 3 : 0;
  const path = (yy: number) => {
    let s = `M20 ${yy}`;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const b = kink * Math.sin((t - 0.5) * Math.PI * 2) * Math.exp(-(((t - 0.5) / 0.16) ** 2));
      s += ` L${(20 + t * 560).toFixed(1)} ${(yy + b).toFixed(1)}`;
    }
    return s;
  };
  const rails = margin < 0 ? "var(--bad)" : "var(--ink-2)";
  return (
    <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 28 }} data-tour="demo">
      <div className="stack" style={{ flex: "1 1 300px", gap: 22 }}>
        <label className="stack" style={{ gap: 10, fontWeight: 550 }}>
          <span className="row" style={{ justifyContent: "space-between" }}>
            <span>Afternoon air temperature</span>
            <span className="mono">{air} °C</span>
          </span>
          <input type="range" min={30} max={46} value={air} onChange={(e) => setAir(Number(e.target.value))} aria-label="Afternoon air temperature" />
        </label>
        <div className="stack" style={{ gap: 10 }}>
          <span style={{ fontWeight: 550 }}>Track</span>
          <Seg label="Track condition" value={track} onChange={setTrack} options={[{ id: "strong", label: "Modern" }, { id: "weak", label: "Just repaired" }]} />
        </div>
        <p className="note">Simplified from the US Federal Railroad Administration buckling model. Rail laid stress-free at {fmt(TN, 0)} °C; sun adds ~17 °C.</p>
      </div>
      <div className="stack" style={{ flex: "2 1 480px", gap: 18 }}>
        <div className="grid g3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="metric">
            <div className="l" style={{ marginTop: 0 }}>Rail in the sun</div>
            <div className="v">{rail} °C</div>
          </div>
          <div className="metric">
            <div className="l" style={{ marginTop: 0 }}>Push along each rail</div>
            <div className="v">{Math.max(0, Math.round((load * TENSION_KN_PER_C) / 9.81))} t</div>
          </div>
          <div className="metric">
            <div className="l" style={{ marginTop: 0 }}>Safety margin</div>
            <div className="v" style={{ color: st.c }}>
              {margin > 0 ? "+" : ""}
              {fmt(margin, 1)} °C
            </div>
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--soft-2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(4, Math.min(100, (100 * load) / allow))}%`, background: st.c, borderRadius: 999, transition: "width .3s, background .3s" }} />
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: st.c }}>{st.t}</span>
          <span className="small ink2">{st.n}</span>
        </div>
        <svg viewBox="0 0 600 90" width="100%" height="90" aria-label={margin < 0 ? "Track drawn kinked" : "Track drawn straight"} role="img">
          {[40, 100, 160, 220, 280, 340, 400, 460, 520].map((x) => (
            <line key={x} x1={x} y1={20} x2={x} y2={70} stroke="#9aa1ac" strokeWidth={4} />
          ))}
          <path d={path(36)} fill="none" stroke={rails} strokeWidth={6} strokeLinecap="round" />
          <path d={path(54)} fill="none" stroke={rails} strokeWidth={6} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
