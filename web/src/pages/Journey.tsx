import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { RailScene } from "../components/RailScene";
import { J_CELLS, J_MADRID_X, J_MADRID_Y, J_PORTUGAL, J_ROUTES, J_SEVILLE, J_SEVILLE_X, J_SEVILLE_Y, J_SPAIN } from "../content/journeyGeo";

/** "How it works": the journey of the data, from orbit to the screen, as a short animated film in nine scenes.
 *  Every number shown is the one the app uses (see README and Methods). */
const STEP_MS = 8000;
const STEPS = [
  { t: "It starts in orbit, and on the ground", d: "Satellites measure sunlight, clouds and the air above Spain every day. Weather stations on the ground add millions more readings.", s: "NASA satellites (incl. CERES) · weather stations and other observations" },
  { t: "NASA joins the dots", d: "NASA's GEOS model blends all those readings into one complete picture of the weather, hour by hour, in squares about 50 km wide. NASA POWER turns it into daily numbers.", s: "MERRA-2 (NASA GMAO) · CERES · NASA POWER" },
  { t: "We take 159 squares", d: "The ones Spain's railway crosses, every day from 1 January 1981 to 11 November 2026.", s: "NASA POWER daily data · 16,751 days per square" },
  { t: "Every kilometre gets its square", d: "13,426 km of railway, cut into 4,831 pieces. Each piece takes the weather of the square it runs through.", s: "Railway: © OpenStreetMap contributors" },
  { t: "From air to rail", d: "Steel in the sun runs hotter than the air: up to 25 °C more, less when it is windy. Past about 60 °C, freshly repaired track can buckle.", s: "Rail model anchored to US FRA field data · Kish et al. 2013" },
  { t: "Is the change real?", d: "For every square we measure the trend and test it, so one hot decade is not mistaken for a real change.", s: "Sen's slope · Mann-Kendall (Hamed–Rao) · t-test · false-discovery check" },
  { t: "Checked against reality", d: "NASA's temperatures match 10 weather stations in Spain. And real US track buckles happened mostly on days NASA marks as very hot.", s: "NOAA GHCN-Daily · US FRA accident data" },
  { t: "Then, the future", d: "Six NASA climate models say how much warmer each month gets. We add that warming to real NASA days and run everything again.", s: "NASA NEX-GDDP-CMIP6 · delta method" },
  { t: "To you", d: "Month by month since 1981, this week's heat watch, any date of your trip, the track lab and 2050.", s: "This week's forecast for the heat watch: Open-Meteo" },
];

const d = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
const HEAT = ["#e5e7eb", "#fde7b0", "#fbb868", "#f2783a", "#d63a2f"];

function useCount(to: number, ms: number, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return v;
}

function Satellite({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-44} y={-6} width={30} height={12} rx={2} fill="#2563eb" stroke="#1e3a8a" />
      <rect x={14} y={-6} width={30} height={12} rx={2} fill="#2563eb" stroke="#1e3a8a" />
      <line x1={-29} y1={-6} x2={-29} y2={6} stroke="#93c5fd" />
      <line x1={29} y1={-6} x2={29} y2={6} stroke="#93c5fd" />
      <rect x={-14} y={-10} width={28} height={20} rx={4} fill="#e5e7eb" stroke="#6b7280" />
      <circle cx={0} cy={14} r={4} fill="#9ca3af" />
    </g>
  );
}

function Station({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={0} y2={-46} stroke="#4b5563" strokeWidth={3} />
      <rect x={-9} y={-24} width={18} height={14} rx={2} fill="#f9fafb" stroke="#6b7280" />
      <g className="jy-spin" style={{ transformOrigin: `0px -50px` }}>
        <line x1={-12} y1={-50} x2={12} y2={-50} stroke="#4b5563" strokeWidth={2} />
        <circle cx={-12} cy={-50} r={3.5} fill="#f2783a" />
        <circle cx={12} cy={-50} r={3.5} fill="#f2783a" />
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------- 1 · orbit and ground */
function Scene1() {
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A satellite crosses the sky above the Earth while a weather station collects readings">
      <defs>
        <linearGradient id="j1sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1d3a" />
          <stop offset="0.55" stopColor="#2a4a7f" />
          <stop offset="1" stopColor="#9cc3ea" />
        </linearGradient>
        <linearGradient id="j1beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={800} height={450} fill="url(#j1sky)" />
      {[[60, 40], [140, 90], [250, 30], [330, 70], [470, 45], [560, 95], [610, 25], [90, 150], [720, 160]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill="#fff" className="jy-twinkle" style={d(i * 230)} />
      ))}
      <g className="jy-fade" style={d(200)}>
        <circle cx={712} cy={64} r={30} fill="#fbbf24" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={712 + Math.cos(a) * 40} y1={64 + Math.sin(a) * 40} x2={712 + Math.cos(a) * 52} y2={64 + Math.sin(a) * 52} stroke="#fbbf24" strokeWidth={4} strokeLinecap="round" />;
        })}
      </g>
      <circle cx={400} cy={1180} r={930} fill="#bfe0ff" opacity={0.35} />
      <circle cx={400} cy={1180} r={912} fill="#3f7fc0" />
      <path d="M150 290 Q260 262 380 268 Q470 258 560 276 Q620 286 650 300 L650 330 L150 330 Z" fill="#d9cfb2" opacity={0.95} />
      <path d="M0 320 Q400 230 800 320 L800 450 L0 450 Z" fill="#e8e0cc" />
      <g className="jy-orbit-a">
        <polygon points="0,14 -60,190 60,190" fill="url(#j1beam)" className="jy-pulse" />
        <Satellite />
        <rect x={-42} y={-44} width={84} height={22} rx={11} fill="#fff" opacity={0.92} />
        <text x={0} y={-28} textAnchor="middle" className="jy-tag">
          satellite
        </text>
      </g>
      <g className="jy-orbit-b" opacity={0.8}>
        <Satellite s={0.55} />
      </g>
      <Station x={190} y={318} />
      <g className="jy-fade" style={d(1200)}>
        <rect x={136} y={345} width={128} height={22} rx={11} fill="#fff" opacity={0.92} />
        <text x={200} y={361} textAnchor="middle" className="jy-tag">
          weather station
        </text>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- 2 · the model */
function Scene2() {
  const rows: [string, string][] = [
    ["Hottest", "41 °C"],
    ["Coldest", "23 °C"],
    ["Wind", "2.1 m/s"],
    ["Sunshine", "8.4 kWh/m²"],
    ["Rain", "0 mm"],
  ];
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Readings from satellites and weather stations flow into a globe that stands for NASA's model, which produces a card of daily numbers">
      <rect width={800} height={450} fill="#f4f7fb" />
      {[150, 300].map((y, i) => (
        <g key={y} className="jy-fade" style={d(i * 250)}>
          <circle cx={90} cy={y} r={34} fill="#fff" stroke="#d5d8dd" />
          {i === 0 && (
            <g transform={`translate(90 ${y}) scale(0.62)`}>
              <Satellite />
            </g>
          )}
          {i === 1 && <Station x={90} y={y + 22} />}
          <path d={`M126 ${y} C 200 ${y}, 220 225, 280 225`} fill="none" stroke="#93c5fd" strokeWidth={3} className="jy-flow" />
        </g>
      ))}
      <g className="jy-pop" style={d(500)}>
        <circle cx={400} cy={225} r={112} fill="#dbeafe" stroke="#60a5fa" strokeWidth={2} />
        <path d="M330 170 Q360 150 400 160 Q440 168 455 190 Q440 215 410 220 Q385 245 360 236 Q336 220 330 170Z" fill="#c9bfa1" opacity={0.85} />
      </g>
      {[-60, -20, 20, 60].map((o, i) => (
        <ellipse key={`m${o}`} cx={400} cy={225} rx={Math.abs(o) + 18} ry={112} fill="none" stroke="#3b82f6" strokeWidth={1.2} pathLength={1} className="jy-draw" style={d(900 + i * 150)} />
      ))}
      {[-70, -35, 0, 35, 70].map((o, i) => (
        <line key={`p${o}`} x1={400 - Math.sqrt(112 ** 2 - o ** 2)} x2={400 + Math.sqrt(112 ** 2 - o ** 2)} y1={225 + o} y2={225 + o} stroke="#3b82f6" strokeWidth={1.2} pathLength={1} className="jy-draw" style={d(1400 + i * 120)} />
      ))}
      <text x={400} y={372} textAnchor="middle" className="jy-label jy-fade" style={d(1800)}>
        MERRA-2 · every hour, every 50 km
      </text>
      <path d="M515 225 L560 225" stroke="#94a3b8" strokeWidth={3} markerEnd="url(#j2arrow)" className="jy-fade" style={d(2400)} />
      <defs>
        <marker id="j2arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#94a3b8" />
        </marker>
      </defs>
      <g className="jy-pop" style={d(2600)}>
        <rect x={570} y={110} width={200} height={232} rx={16} fill="#fff" stroke="#e6e8eb" />
        <text x={588} y={140} className="jy-mini">
          NASA POWER
        </text>
        <text x={588} y={158} className="jy-mini muted">
          one square · one day
        </text>
      </g>
      {rows.map(([k, v], i) => (
        <g key={k} className="jy-fade" style={d(3000 + i * 450)}>
          <line x1={588} x2={752} y1={176 + i * 33} y2={176 + i * 33} stroke="#eef0f2" />
          <text x={588} y={198 + i * 33} className="jy-row">
            {k}
          </text>
          <text x={752} y={198 + i * 33} textAnchor="end" className="jy-row b">
            {v}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Iberia({ children, faint }: { children?: ReactNode; faint?: boolean }) {
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Spain and Portugal">
      <rect width={800} height={450} fill="#eaf2fa" />
      <path d={J_PORTUGAL} fill="#efece4" stroke="#d6cfbf" />
      <path d={J_SPAIN} fill={faint ? "#f4f0e6" : "#f7f3ea"} stroke="#cfc6b3" strokeWidth={1.2} />
      {children}
    </svg>
  );
}

/* ---------------------------------------------------------------- 3 · 159 squares */
function Scene3() {
  const n = useCount(159, 4000, 300);
  const days = useCount(16751, 2400, 4300);
  return (
    <div className="jy-layer">
      <Iberia>
        {J_CELLS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill="#fbbf24" fillOpacity={0.55} stroke="#fff" strokeWidth={1} className="jy-pop" style={d(300 + i * 25)} />
        ))}
      </Iberia>
      <div className="jy-count">
        <b>{n}</b> squares
        <br />
        <b>{days.toLocaleString("en-US")}</b> days each
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 4 · the railway */
function Scene4() {
  const km = useCount(13426, 3000, 400);
  return (
    <div className="jy-layer">
      <Iberia faint>
        {J_CELLS.map(([x, y, w, h], i) => (
          <rect key={`g${i}`} x={x} y={y} width={w} height={h} fill="#e5e7eb" fillOpacity={0.6} stroke="#fff" />
        ))}
        {J_CELLS.map(([x, y, w, h, l], i) => (
          <rect key={`h${i}`} x={x} y={y} width={w} height={h} fill={HEAT[l]} stroke="#fff" className="jy-fade" style={d(3800 + (i % 40) * 30)} />
        ))}
        {J_ROUTES.map((p, i) => (
          <path key={i} d={p} fill="none" stroke="#0c0d0f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="jy-draw" style={d(200 + i * 120)} />
        ))}
      </Iberia>
      <div className="jy-count">
        <b>{km.toLocaleString("en-US")}</b> km of track
        <br />
        <span className="jy-fade" style={d(3800)}>
          coloured by days at 40 °C today
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 5 · air to rail */
function Scene5() {
  const air = useCount(46, 6200, 600);
  const a = Math.max(24, air);
  const rail = a + 17;
  return (
    <div className="jy-layer jy-rail">
      <div className="jy-railscene">
        <RailScene hazard="heat" rail={rail} limit={60} />
      </div>
      <div className="jy-fx">
        <div>
          <b>{a}°</b>
          <em>air</em>
        </div>
        <i>+</i>
        <div>
          <b>17°</b>
          <em>sun on steel</em>
        </div>
        <i>=</i>
        <div style={{ color: rail >= 60 ? "#d63a2f" : undefined }}>
          <b>{rail}°</b>
          <em>rail</em>
        </div>
      </div>
      <div className="jy-limit" style={{ color: rail >= 60 ? "#d63a2f" : undefined }}>
        {rail >= 60 ? "Past 60 °C: just-repaired track buckles" : "Just-repaired track holds up to about 60 °C"}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 6 · is it real? */
function Scene6() {
  const ys = J_SEVILLE;
  const n = ys.length;
  const x0 = 80;
  const x1 = 740;
  const base = 380;
  const top = 50;
  const bw = (x1 - x0) / n;
  const yv = (v: number) => base - (v / 45) * (base - top);
  const slope = 0.4104;
  const sorted = [...ys].sort((a, b) => a - b);
  const med = (sorted[(n - 1) >> 1] + sorted[n >> 1]) / 2;
  const icpt = med - slope * ((n - 1) / 2);
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Bars of days at 40 °C near Seville grow year by year from 1981 to 2025, a rising trend line is drawn, and a stamp says real trend, p = 0.0008">
      <rect width={800} height={450} fill="#fbfbf8" />
      <text x={x0} y={34} className="jy-label">
        Days at 40 °C a year near Seville
      </text>
      {[10, 20, 30, 40].map((g) => (
        <g key={g}>
          <line x1={x0} x2={x1} y1={yv(g)} y2={yv(g)} stroke="#eef0f2" />
          <text x={x0 - 8} y={yv(g) + 4} textAnchor="end" className="jy-mini muted">
            {g}
          </text>
        </g>
      ))}
      {ys.map((v, i) => (
        <rect key={i} x={x0 + i * bw + 1} y={yv(v)} width={bw - 2} height={base - yv(v)} rx={2} fill={i >= n - 10 ? "#f2783a" : "#cbd0d6"} className="jy-grow" style={d(200 + i * 60)} />
      ))}
      <line x1={x0} x2={x1} y1={base} y2={base} stroke="#d5d8dd" />
      <text x={x0} y={base + 22} className="jy-mini muted">
        1981
      </text>
      <text x={x1} y={base + 22} textAnchor="end" className="jy-mini muted">
        2025
      </text>
      <line x1={x0 + bw / 2} y1={yv(icpt)} x2={x1 - bw / 2} y2={yv(icpt + slope * (n - 1))} stroke="#d63a2f" strokeWidth={4} strokeLinecap="round" pathLength={1} className="jy-draw" style={d(3200)} />
      <g className="jy-stamp" style={d(4600)}>
        <g transform="translate(230 92) rotate(-6)">
          <rect x={0} y={0} width={300} height={74} rx={12} fill="#fff" stroke="#0c0d0f" strokeWidth={3} />
          <text x={150} y={33} textAnchor="middle" className="jy-stamp-t">
            REAL TREND
          </text>
          <text x={150} y={58} textAnchor="middle" className="jy-mini">
            +4.1 days per decade · p = 0.0008
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- 7 · checked against reality */
function Scene7() {
  const hist = [8, 6, 5, 9, 10, 23, 26, 23, 47, 105];
  const bx = 450;
  const bw = 30;
  const base = 360;
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A weather station and a satellite agree on the temperature, and a bar chart shows that most real track buckles in the US happened on the hottest days">
      <rect width={800} height={450} fill="#f7f8fa" />
      <g className="jy-fade" style={d(200)}>
        <Station x={110} y={300} />
        <text x={110} y={330} textAnchor="middle" className="jy-mini">
          NOAA station
        </text>
      </g>
      <g className="jy-fade" style={d(500)}>
        <g transform="translate(290 210) scale(0.8)">
          <Satellite />
        </g>
        <text x={290} y={330} textAnchor="middle" className="jy-mini">
          NASA
        </text>
      </g>
      <g className="jy-fade" style={d(800)}>
        <rect x={60} y={70} width={280} height={110} rx={14} fill="#fff" stroke="#e6e8eb" />
        <text x={76} y={92} className="jy-mini muted">
          daily temperature, one year
        </text>
      </g>
      {[0, 1].map((k) => (
        <polyline
          key={k}
          points={Array.from({ length: 41 }, (_, i) => {
            const x = 76 + i * 6.2;
            const y = 150 - 34 * Math.sin((i / 40) * Math.PI) - (k ? 2 : 0) + 4 * Math.sin(i * 1.7 + (k ? 0.3 : 0));
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ")}
          fill="none"
          stroke={k ? "#2563eb" : "#4b5563"}
          strokeWidth={2.5}
          strokeLinejoin="round"
          pathLength={1}
          className="jy-draw"
          style={d(1000)}
        />
      ))}
      <g className="jy-pop" style={d(1800)}>
        <rect x={120} y={360} width={160} height={40} rx={20} fill="#0c0d0f" />
        <text x={200} y={386} textAnchor="middle" className="jy-pill">
          r = 0.97 · 10 stations
        </text>
      </g>
      <text x={bx} y={70} className="jy-label jy-fade" style={d(2200)}>
        262 real track buckles (US)
      </text>
      <text x={bx} y={92} className="jy-mini muted jy-fade" style={d(2200)}>
        by how hot NASA says that day was →
      </text>
      {hist.map((v, i) => (
        <rect key={i} x={bx + i * bw} y={base - v * 2.2} width={bw - 4} height={v * 2.2} rx={3} fill={i === 9 ? "#d63a2f" : i >= 7 ? "#f2a78a" : "#cbd0d6"} className="jy-grow" style={d(2500 + i * 160)} />
      ))}
      <line x1={bx} x2={bx + 10 * bw} y1={base} y2={base} stroke="#d5d8dd" />
      <text x={bx} y={base + 20} className="jy-mini muted">
        cooler days
      </text>
      <text x={bx + 10 * bw} y={base + 20} textAnchor="end" className="jy-mini muted">
        hottest
      </text>
      <g className="jy-pop" style={d(4600)}>
        <rect x={bx} y={170} width={196} height={34} rx={17} fill="#d63a2f" />
        <text x={bx + 98} y={192} textAnchor="middle" className="jy-pill">
          40% on the hottest 10%
        </text>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- 8 · the future */
function Scene8() {
  const models = ["GISS", "ACCESS", "EC-Earth", "MPI", "MRI", "NorESM"];
  const days = useMemo(() => Array.from({ length: 20 }, (_, i) => 30 + ((i * 37) % 23) - 6), []);
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Six climate models each add warming to a row of real days, which turn into hotter days in 2050">
      <rect width={800} height={450} fill="#fbf7f1" />
      <text x={400} y={34} textAnchor="middle" className="jy-label jy-fade">
        6 NASA climate models
      </text>
      {models.map((m, i) => {
        const cx = 145 + i * 102;
        return (
          <g key={m} className="jy-pop" style={d(200 + i * 220)}>
            <circle cx={cx} cy={92} r={30} fill="#dbeafe" stroke="#60a5fa" />
            <ellipse cx={cx} cy={92} rx={12} ry={30} fill="none" stroke="#3b82f6" />
            <line x1={cx - 30} x2={cx + 30} y1={92} y2={92} stroke="#3b82f6" />
            <text x={cx} y={142} textAnchor="middle" className="jy-mini">
              {m}
            </text>
          </g>
        );
      })}
      <g className="jy-pop" style={d(1800)}>
        <rect x={290} y={160} width={220} height={40} rx={20} fill="#c2410c" />
        <text x={400} y={186} textAnchor="middle" className="jy-pill">
          July: +2.8 °C by 2050
        </text>
      </g>
      <text x={110} y={262} className="jy-mini muted jy-fade" style={d(2300)}>
        real NASA days, 1995–2014
      </text>
      {days.map((v, i) => (
        <rect key={`a${i}`} x={110 + i * 29} y={380 - v * 2.4} width={22} height={v * 2.4} rx={3} fill="#cbd0d6" className="jy-grow" style={d(2400 + i * 50)} />
      ))}
      {days.map((v, i) => (
        <rect key={`b${i}`} x={110 + i * 29} y={380 - (v + 2.8) * 2.4} width={22} height={(v + 2.8) * 2.4} rx={3} fill="#f2783a" className="jy-fade" style={d(4200 + i * 60)} />
      ))}
      <line x1={100} x2={700} y1={380} y2={380} stroke="#d5d8dd" />
      <text x={700} y={404} textAnchor="end" className="jy-mini jy-fade" style={d(5200)}>
        the same days, in 2050 → run everything again
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------- 9 · to you */
function Scene9() {
  const tabs = ["Overview", "Heat watch", "My trip", "Track lab", "2050"];
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A laptop and a phone show the OutOfSpec app, fed by NASA data and this week's forecast">
      <rect width={800} height={450} fill="#f4f7fb" />
      <g className="jy-pop" style={d(100)}>
        <rect x={110} y={60} width={420} height={270} rx={14} fill="#0c0d0f" />
        <rect x={122} y={72} width={396} height={246} rx={6} fill="#eef1f4" />
        <path d="M80 340 L560 340 L540 356 L100 356 Z" fill="#cbd0d6" />
        <g transform="translate(118 63) scale(0.5)">
          <path d={J_PORTUGAL} fill="#efece4" />
          <path d={J_SPAIN} fill="#fff" />
          {J_ROUTES.map((p, i) => (
            <path key={i} d={p} fill="none" stroke={["#f2783a", "#d63a2f", "#fbb868"][i % 3]} strokeWidth={4} strokeLinecap="round" pathLength={1} className="jy-draw" style={d(600 + i * 60)} />
          ))}
          <circle cx={J_SEVILLE_X} cy={J_SEVILLE_Y} r={9} fill="#d63a2f" className="jy-pulse" />
          <circle cx={J_MADRID_X} cy={J_MADRID_Y} r={9} fill="#d63a2f" className="jy-pulse" style={d(500)} />
        </g>
      </g>
      <g className="jy-pop" style={d(1600)}>
        <rect x={600} y={120} width={130} height={240} rx={20} fill="#0c0d0f" />
        <rect x={609} y={132} width={112} height={216} rx={12} fill="#fff" />
        <text x={620} y={160} className="jy-mini">
          Heat watch
        </text>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={620 + i * 14} y={250 - [20, 30, 46, 60, 38, 26, 18][i]} width={10} height={[20, 30, 46, 60, 38, 26, 18][i]} rx={2} fill={i === 3 ? "#d63a2f" : "#fbb868"} className="jy-grow" style={d(2000 + i * 120)} />
        ))}
        <text x={620} y={280} className="jy-mini muted">
          next 7 days
        </text>
      </g>
      <g className="jy-fade" style={d(2600)}>
        <path d="M640 64 q-6 -26 22 -26 q8 -22 34 -12 q28 -8 30 20 q22 4 14 22 Z" fill="#fff" stroke="#cbd0d6" />
        <text x={662} y={98} className="jy-mini muted">
          forecast
        </text>
        <path d="M680 104 L680 118" stroke="#94a3b8" strokeWidth={3} className="jy-flow" />
      </g>
      {tabs.map((t, i) => (
        <g key={t} className="jy-pop" style={d(3200 + i * 250)}>
          <rect x={110 + i * 118} y={388} width={108} height={34} rx={17} fill={i === 0 ? "#0c0d0f" : "#fff"} stroke="#d5d8dd" />
          <text x={164 + i * 118} y={410} textAnchor="middle" className={i === 0 ? "jy-pill" : "jy-mini"}>
            {t}
          </text>
        </g>
      ))}
    </svg>
  );
}

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9];

export function JourneyPage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0); // restarts the scene when the same step is replayed
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= SCENES.length - 1) setPlaying(false);
      else setStep((s) => s + 1);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, run]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((s) => Math.min(SCENES.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (i: number) => {
    setStep(i);
    setRun((r) => r + 1);
  };
  const Scene = SCENES[step];
  const st = STEPS[step];
  return (
    <div className="wrap jy" style={{ paddingTop: 24 }}>
      <div className="jy-head">
        <h1>How it works</h1>
        <p>From a satellite to your screen, in nine steps.</p>
      </div>
      <div className="jy-grid">
        <div className="jy-stage" aria-live="polite">
          <div key={`${step}-${run}`} className="jy-scene">
            <Scene />
          </div>
          <div className="jy-progress" aria-hidden>
            <i key={`${step}-${run}`} style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: playing ? "running" : "paused" }} />
          </div>
        </div>
        <aside className="jy-side">
          <div className="jy-num">
            {String(step + 1).padStart(2, "0")} <span>/ {String(SCENES.length).padStart(2, "0")}</span>
          </div>
          <h2>{st.t}</h2>
          <p className="jy-d">{st.d}</p>
          <p className="jy-s">{st.s}</p>
          <div className="jy-ctrl">
            <button className="btn ghost" onClick={() => go(Math.max(0, step - 1))} aria-label="Previous step" disabled={step === 0}>
              <ChevronLeft size={18} />
            </button>
            <button
              className="hm-play"
              onClick={() => {
                if (!playing && step === SCENES.length - 1) go(0);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="btn ghost" onClick={() => go(Math.min(SCENES.length - 1, step + 1))} aria-label="Next step" disabled={step === SCENES.length - 1}>
              <ChevronRight size={18} />
            </button>
          </div>
          <ol className="jy-list">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <button aria-current={i === step ? "step" : undefined} className={i < step ? "done" : ""} onClick={() => go(i)}>
                  <span>{String(i + 1).padStart(2, "0")}</span> {s.t}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
