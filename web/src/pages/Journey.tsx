import { createContext, memo, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { RailScene } from "../components/RailScene";
import { LogoMark } from "../components/Logo";
import { APP_NAME } from "../config";
import { J_CELLS, J_MADRID_X, J_MADRID_Y, J_PORTUGAL, J_ROUTES, J_SEVILLE, J_SEVILLE_X, J_SEVILLE_Y, J_SPAIN } from "../content/journeyGeo";

/** "How it works": the journey of the data, from orbit to the screen, as a short animated film in nine scenes.
 *  Each scene is narrated in beats: [time in ms, sentence]. The visuals of the scene appear at those same times, the
 *  sentence shows under the stage, and the scene lasts until the last sentence has had time to be read.
 *  Every number shown is the one the app uses (see README and Methods). */
type Beat = [number, string];
const STEPS: { t: string; d: string; s: string; beats: Beat[] }[] = [
  {
    t: "It starts in orbit, and on the ground",
    d: "Satellites measure sunlight, clouds and the air above Spain every day. Weather stations on the ground add their own readings.",
    s: "NASA satellites (incl. CERES) · weather stations and other observations",
    beats: [
      [0, "Every day, NASA satellites measure sunlight, clouds and air temperature from space."],
      [6500, "Weather stations on the ground record temperature, wind and rain."],
      [12500, "Satellites see everywhere but from afar; stations see one spot. NASA combines both."],
    ],
  },
  {
    t: "NASA joins the dots",
    d: "NASA's weather model blends all those readings into one complete picture of the weather, hour by hour, in squares about 50 km wide. NASA POWER turns it into daily numbers.",
    s: "MERRA-2 (NASA GMAO) · CERES · NASA POWER",
    beats: [
      [0, "All those readings flow into NASA's weather model, MERRA-2."],
      [5000, "It fills the gaps: the whole planet's weather, every hour, in 50 km squares."],
      [11500, "NASA POWER turns each square into one card per day."],
    ],
  },
  {
    t: "We take 159 squares",
    d: "The ones Spain's railway crosses, every day from 1 January 1981 to 11 November 2026.",
    s: "NASA POWER daily data · 16,751 days per square",
    beats: [
      [0, "Spain's railway crosses 159 of these squares. We keep only those."],
      [5000, "For each one, every day since 1 January 1981: 16,751 days."],
      [10500, "That's over 2.6 million daily weather cards."],
    ],
  },
  {
    t: "Every kilometre gets its square",
    d: "13,426 km of railway, cut into 4,831 pieces. Each piece takes the weather of the square it runs through.",
    s: "Railway: © OpenStreetMap contributors",
    beats: [
      [0, "The railway: 13,426 km of track from OpenStreetMap."],
      [5500, "Cut into 4,831 pieces, about 3 km each."],
      [9500, "Colour: days a year at 40 °C in each square today. Grey none, red over 20."],
      [16500, "Each piece takes its square's weather: the track in the Seville square gets Seville's 20+ days."],
    ],
  },
  {
    t: "From air to rail",
    d: "Steel in the sun runs hotter than the air: up to 25 °C more, less when it is windy. Past about 60 °C, freshly repaired track can buckle.",
    s: "Rail model anchored to US FRA field data · Kish et al. 2013",
    beats: [
      [0, "What matters is the rail's temperature, not the air's. Steel in the sun gets hotter."],
      [6800, "Full sun, light breeze: rail = air + 17 °C. On a calm day, up to +25 °C."],
      [14000, "Hot steel expands, but welded rail can't get longer, so it pushes sideways."],
      [19800, "Past about 60 °C, freshly repaired track buckles: a “sun kink”."],
    ],
  },
  {
    t: "Is the change real?",
    d: "For every square we measure the trend and test it, so one hot decade is not mistaken for a real change.",
    s: "Sen's slope · Mann-Kendall (Hamed–Rao) · t-test · false-discovery check",
    beats: [
      [0, "One square, Seville: each bar is a year, counting its days at 40 °C."],
      [5500, "Years jump up and down. The last ten (orange) stand out."],
      [11500, "The red line is the trend: about 4 more days every ten years."],
      [17500, "Luck? A rise this steady happens by chance under 1 in 1,000 times (p = 0.0008)."],
    ],
  },
  {
    t: "Checked against reality",
    d: "NASA's temperatures match 10 weather stations in Spain. And real US track buckles happened mostly on days NASA marks as very hot.",
    s: "NOAA GHCN-Daily · US FRA accident data",
    beats: [
      [0, "Check 1: NASA's temperatures against 10 real weather stations in Spain."],
      [6000, "Grey: station. Blue: NASA. They agree almost perfectly (0.97 out of 1)."],
      [12500, "Check 2: 262 real track buckles in the US. How hot was each day?"],
      [20000, "40% fell on the hottest tenth of summer days. Without heat, it would be 10%."],
    ],
  },
  {
    t: "Then, the future",
    d: "Six NASA climate models say how much warmer each month gets. We add that warming to real NASA days and run everything again.",
    s: "NASA NEX-GDDP-CMIP6 · delta method",
    beats: [
      [0, "For the future: six NASA climate models (NEX-GDDP-CMIP6)."],
      [5500, "They tell us how much warmer each month gets. July: +2.8 °C by 2050."],
      [11000, "We add that warming to real NASA days from 1995–2014."],
      [16500, "Some days now cross 40 °C (here 6 → 8). Rerun everything: that's 2050 and 2090."],
    ],
  },
  {
    t: "To you",
    d: "Month by month since 1981, this week's heat watch, any date of your trip, the track lab and 2050.",
    s: "This week's forecast for the heat watch: Open-Meteo",
    beats: [
      [0, "Everything is computed in advance, so the app opens in seconds."],
      [5000, "The weather forecast (Open-Meteo) feeds the 7-day heat watch."],
      [10500, "Your turn: overview, heat watch, your trip, track lab and 2050."],
    ],
  },
];

/** Playback pace: every time written in this file (beats, delays, counters) is multiplied by it. Lower = faster. */
const PACE = 0.5;
/** Time to read a sentence (ms), used to hold the scene after its last beat. */
const readMs = (text: string) => Math.min(4500, Math.max(2500, text.split(/\s+/).length * 220 + 600));
const DUR = STEPS.map((s) => {
  const [at, text] = s.beats[s.beats.length - 1];
  return at * PACE + readMs(text);
});

/** Scene clock (ms since the scene started); stops while paused, like the CSS animations of the stage. */
const ClockCtx = createContext(0);
const useClock = () => useContext(ClockCtx);
const ease = (k: number) => 1 - (1 - k) ** 3;
function tween(t: number, from: number, to: number, ms: number, delay = 0, linear = false) {
  const k = Math.max(0, Math.min(1, (t - delay) / ms));
  return from + (to - from) * (linear ? k : ease(k));
}
function Count({ to, ms, delay = 0 }: { to: number; ms: number; delay?: number }) {
  const t = useClock();
  return <>{Math.round(tween(t, 0, to, ms * PACE, delay * PACE)).toLocaleString("en-US")}</>;
}

const d = (ms: number): CSSProperties => ({ animationDelay: `${ms * PACE}ms` });
const HEAT = ["#e5e7eb", "#fde7b0", "#fbb868", "#f2783a", "#d63a2f"];
const HEAT_LABEL = ["0", "1–5", "6–10", "11–20", "20+"];
const RailSceneM = memo(RailScene);

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

/** A white label card in a scene: a coloured dot, a bold title and one line of detail. */
function Card({ x, y, w, title, text, dot, delay }: { x: number; y: number; w: number; title: string; text: string; dot: string; delay: number }) {
  return (
    <g className="jy-fade" style={d(delay)}>
      <rect x={x} y={y} width={w} height={56} rx={14} fill="#fff" opacity={0.95} />
      <circle cx={x + 18} cy={y + 19} r={5} fill={dot} />
      <text x={x + 30} y={y + 23} className="jy-mini b">
        {title}
      </text>
      <text x={x + 14} y={y + 45} className="jy-row">
        {text}
      </text>
    </g>
  );
}

/* ---------------------------------------------------------------- 1 · orbit and ground */
function Scene1() {
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A satellite crosses the sky measuring sunlight, clouds and air temperature, while a weather station on the ground records temperature, wind and rain">
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
      <g className="jy-orbit-a" style={{ animationDuration: `${16000 * PACE}ms` }}>
        <polygon points="0,14 -60,190 60,190" fill="url(#j1beam)" className="jy-pulse" />
        <Satellite />
        <rect x={-42} y={-44} width={84} height={22} rx={11} fill="#fff" opacity={0.92} />
        <text x={0} y={-28} textAnchor="middle" className="jy-tag">
          satellite
        </text>
      </g>
      <g className="jy-orbit-b" opacity={0.8} style={{ animationDuration: `${20000 * PACE}ms` }}>
        <Satellite s={0.55} />
      </g>
      <Station x={190} y={318} />
      <g className="jy-fade" style={d(400)}>
        <rect x={136} y={345} width={128} height={22} rx={11} fill="#fff" opacity={0.92} />
        <text x={200} y={361} textAnchor="middle" className="jy-tag">
          weather station
        </text>
      </g>
      <Card x={440} y={350} w={336} dot="#2563eb" title="Satellites · from space" text="sunlight · clouds · air temperature" delay={1500} />
      <Card x={24} y={384} w={330} dot="#f2783a" title="Stations · on the spot" text="temperature · wind · rain" delay={7000} />
      <g className="jy-pop" style={d(12800)}>
        <rect x={280} y={246} width={240} height={36} rx={18} fill="#0c0d0f" />
        <text x={400} y={269} textAnchor="middle" className="jy-pill">
          both go to NASA's model →
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
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Readings from satellites and weather stations flow into a globe that stands for NASA's weather model; one of its squares becomes a card of daily numbers">
      <defs>
        <marker id="j2arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#c2410c" />
        </marker>
      </defs>
      <rect width={800} height={450} fill="#f4f7fb" />
      {[150, 300].map((y, i) => (
        <g key={y} className="jy-fade" style={d(i * 300)}>
          <circle cx={90} cy={y} r={34} fill="#fff" stroke="#d5d8dd" />
          {i === 0 && (
            <g transform={`translate(90 ${y}) scale(0.62)`}>
              <Satellite />
            </g>
          )}
          {i === 1 && <Station x={90} y={y + 22} />}
          <text x={90} y={y + 52} textAnchor="middle" className="jy-mini muted">
            {i === 0 ? "satellites" : "stations"}
          </text>
          <path d={`M126 ${y} C 200 ${y}, 220 225, 280 225`} fill="none" stroke="#93c5fd" strokeWidth={3} className="jy-flow" />
        </g>
      ))}
      <g className="jy-pop" style={d(900)}>
        <circle cx={400} cy={225} r={112} fill="#dbeafe" stroke="#60a5fa" strokeWidth={2} />
        <path d="M330 170 Q360 150 400 160 Q440 168 455 190 Q440 215 410 220 Q385 245 360 236 Q336 220 330 170Z" fill="#c9bfa1" opacity={0.85} />
      </g>
      <text x={400} y={98} textAnchor="middle" className="jy-label jy-fade" style={d(1500)}>
        NASA's weather model (MERRA-2)
      </text>
      {[-60, -20, 20, 60].map((o, i) => (
        <ellipse key={`m${o}`} cx={400} cy={225} rx={Math.abs(o) + 18} ry={112} fill="none" stroke="#3b82f6" strokeWidth={1.2} pathLength={1} className="jy-draw" style={d(5000 + i * 150)} />
      ))}
      {[-70, -35, 0, 35, 70].map((o, i) => (
        <line key={`p${o}`} x1={400 - Math.sqrt(112 ** 2 - o ** 2)} x2={400 + Math.sqrt(112 ** 2 - o ** 2)} y1={225 + o} y2={225 + o} stroke="#3b82f6" strokeWidth={1.2} pathLength={1} className="jy-draw" style={d(5500 + i * 120)} />
      ))}
      <text x={400} y={372} textAnchor="middle" className="jy-mini jy-fade" style={d(6800)}>
        every hour · squares about 50 km wide
      </text>
      <rect x={388} y={196} width={20} height={20} fill="#fde68a" stroke="#c2410c" strokeWidth={2.5} className="jy-pop" style={d(8000)} />
      <text x={398} y={252} textAnchor="middle" className="jy-mini b jy-fade" style={d(8300)}>
        one square
      </text>
      <path d="M410 206 C 480 206, 500 225, 562 225" fill="none" stroke="#c2410c" strokeWidth={2.5} strokeDasharray="5 4" markerEnd="url(#j2arrow)" className="jy-fade" style={d(11500)} />
      <g className="jy-pop" style={d(11800)}>
        <rect x={570} y={110} width={200} height={232} rx={16} fill="#fff" stroke="#e6e8eb" />
        <text x={588} y={140} className="jy-mini b">
          NASA POWER
        </text>
        <text x={588} y={158} className="jy-mini muted">
          one square · one day
        </text>
      </g>
      {rows.map(([k, v], i) => (
        <g key={k} className="jy-fade" style={d(12300 + i * 400)}>
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
  return (
    <div className="jy-layer">
      <Iberia>
        {J_CELLS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill="#fbbf24" fillOpacity={0.55} stroke="#fff" strokeWidth={1} className="jy-pop" style={d(1000 + i * 18)} />
        ))}
        {J_ROUTES.map((p, i) => (
          <path key={i} d={p} fill="none" stroke="#3b4350" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="jy-draw" style={d(i * 40)} />
        ))}
      </Iberia>
      <div className="jy-count">
        <div>
          <b>
            <Count to={159} ms={2900} delay={1000} />
          </b>{" "}
          squares with railway
        </div>
        <div className="jy-fade" style={d(5000)}>
          <b>
            <Count to={16751} ms={2400} delay={5000} />
          </b>{" "}
          days of weather each
        </div>
        <div className="jy-fade" style={d(10500)}>
          <b>
            <Count to={2663409} ms={2200} delay={10500} />
          </b>{" "}
          daily weather cards
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 4 · the railway */
const SEV_CELL = J_CELLS.find(([x, y, w, h]) => J_SEVILLE_X >= x && J_SEVILLE_X <= x + w && J_SEVILLE_Y >= y && J_SEVILLE_Y <= y + h) ?? null;

function Scene4() {
  return (
    <div className="jy-layer">
      <Iberia faint>
        {SEV_CELL && (
          <defs>
            <clipPath id="j4sev">
              <rect x={SEV_CELL[0]} y={SEV_CELL[1]} width={SEV_CELL[2]} height={SEV_CELL[3]} />
            </clipPath>
          </defs>
        )}
        {J_CELLS.map(([x, y, w, h], i) => (
          <rect key={`g${i}`} x={x} y={y} width={w} height={h} fill="#e5e7eb" fillOpacity={0.6} stroke="#fff" />
        ))}
        {J_CELLS.map(([x, y, w, h, l], i) => (
          <rect key={`h${i}`} x={x} y={y} width={w} height={h} fill={HEAT[l]} stroke="#fff" className="jy-fade" style={d(9500 + (i % 40) * 30)} />
        ))}
        {J_ROUTES.map((p, i) => (
          <path key={i} d={p} fill="none" stroke="#0c0d0f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="jy-draw" style={d(i * 100)} />
        ))}
        <g className="jy-fade" style={d(5500)}>
          {J_ROUTES.map((p, i) => (
            <path key={i} d={p} fill="none" stroke="#fff" strokeWidth={3.6} strokeDasharray="1.6 9" />
          ))}
        </g>
        {SEV_CELL && (
          <>
            <g clipPath="url(#j4sev)" className="jy-fade" style={d(16800)}>
              {J_ROUTES.map((p, i) => (
                <path key={i} d={p} fill="none" stroke="#d63a2f" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>
            <rect x={SEV_CELL[0]} y={SEV_CELL[1]} width={SEV_CELL[2]} height={SEV_CELL[3]} fill="none" stroke="#0c0d0f" strokeWidth={3} className="jy-pop" style={d(16500)} />
            <g className="jy-fade" style={d(17200)}>
              <line x1={SEV_CELL[0]} y1={SEV_CELL[1] + SEV_CELL[3]} x2={250} y2={398} stroke="#0c0d0f" strokeWidth={1.5} />
              <rect x={24} y={398} width={300} height={46} rx={12} fill="#fff" stroke="#0c0d0f" strokeWidth={1.5} />
              <text x={38} y={417} className="jy-mini b">
                Seville square: 20+ days at 40 °C
              </text>
              <text x={38} y={435} className="jy-mini muted">
                → the track inside gets the same
              </text>
            </g>
          </>
        )}
      </Iberia>
      <div className="jy-count">
        <div>
          <b>
            <Count to={13426} ms={3000} />
          </b>{" "}
          km of track
        </div>
        <div className="jy-fade" style={d(5500)}>
          <b>4,831</b> pieces, ~3 km each
        </div>
        <div className="jy-legend jy-fade" style={d(9500)}>
          <span>days at 40 °C a year, today</span>
          <span>
            {HEAT.map((c, i) => (
              <span key={c}>
                <i style={{ background: c }} />
                {HEAT_LABEL[i]}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 5 · air to rail */
function Scene5() {
  const t = useClock();
  const air = Math.round(tween(t, 24, 46, 7000 * PACE, 14000 * PACE, true));
  const rail = air + 17;
  const hot = rail >= 60;
  return (
    <div className="jy-layer jy-rail">
      <div className="jy-railscene">
        <RailSceneM hazard="heat" rail={rail} limit={60} />
      </div>
      <div className="jy-fx">
        <div>
          <b>{air}°</b>
          <em>air</em>
        </div>
        <i className="jy-fade" style={d(6800)}>
          +
        </i>
        <div className="jy-fade" style={d(6800)}>
          <b>17°</b>
          <em>
            sun on steel
            <br />
            full sun, light breeze
          </em>
        </div>
        <i className="jy-fade" style={d(7600)}>
          =
        </i>
        <div className="jy-fade" style={{ ...d(7600), color: hot ? "#d63a2f" : undefined }}>
          <b>{rail}°</b>
          <em>rail</em>
        </div>
      </div>
      <div className="jy-limit jy-fade" style={{ ...d(14000), color: hot ? "#d63a2f" : undefined }}>
        {hot ? "Past 60 °C: freshly repaired track bends sideways (sun kink)" : "Freshly repaired track holds up to about 60 °C · standard track about 74 °C"}
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
  const top = 60;
  const bw = (x1 - x0) / n;
  const yv = (v: number) => base - (v / 45) * (base - top);
  const slope = 0.4104;
  const sorted = [...ys].sort((a, b) => a - b);
  const med = (sorted[(n - 1) >> 1] + sorted[n >> 1]) / 2;
  const icpt = med - slope * ((n - 1) / 2);
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="Bars of days at 40 °C in the Seville square, one per year from 1981 to 2025; the last ten years turn orange, a rising trend line is drawn, and a stamp says real trend, p = 0.0008">
      <rect width={800} height={450} fill="#fbfbf8" />
      <text x={x0} y={34} className="jy-label">
        Days at 40 °C each year · Seville square
      </text>
      <g className="jy-fade" style={d(5800)}>
        <rect x={548} y={22} width={12} height={12} rx={2} fill="#cbd0d6" />
        <text x={566} y={33} className="jy-mini muted">
          1981–2015
        </text>
        <rect x={646} y={22} width={12} height={12} rx={2} fill="#f2783a" />
        <text x={664} y={33} className="jy-mini muted">
          last 10 years
        </text>
      </g>
      {[10, 20, 30, 40].map((g) => (
        <g key={g}>
          <line x1={x0} x2={x1} y1={yv(g)} y2={yv(g)} stroke="#eef0f2" />
          <text x={x0 - 8} y={yv(g) + 4} textAnchor="end" className="jy-mini muted">
            {g}
          </text>
        </g>
      ))}
      {ys.map((v, i) => (
        <rect key={i} x={x0 + i * bw + 1} y={yv(v)} width={bw - 2} height={base - yv(v)} rx={2} fill="#cbd0d6" className="jy-grow" style={d(300 + i * 55)} />
      ))}
      {ys.map((v, i) =>
        i >= n - 10 ? <rect key={`o${i}`} x={x0 + i * bw + 1} y={yv(v)} width={bw - 2} height={base - yv(v)} rx={2} fill="#f2783a" className="jy-fade" style={d(5800 + (i - n + 10) * 60)} /> : null,
      )}
      <line x1={x0} x2={x1} y1={base} y2={base} stroke="#d5d8dd" />
      <text x={x0} y={base + 22} className="jy-mini muted">
        1981
      </text>
      <text x={x1} y={base + 22} textAnchor="end" className="jy-mini muted">
        2025
      </text>
      <line x1={x0 + bw / 2} y1={yv(icpt)} x2={x1 - bw / 2} y2={yv(icpt + slope * (n - 1))} stroke="#d63a2f" strokeWidth={4} strokeLinecap="round" pathLength={1} className="jy-draw" style={d(11500)} />
      <g className="jy-pop" style={d(12800)}>
        <rect x={x0} y={48} width={292} height={30} rx={15} fill="#d63a2f" />
        <text x={x0 + 146} y={68} textAnchor="middle" className="jy-pill">
          trend: +4.1 days at 40 °C per decade
        </text>
      </g>
      <g className="jy-stamp" style={d(17500)}>
        <g transform="translate(300 96) rotate(-6)">
          <rect x={0} y={0} width={320} height={74} rx={12} fill="#fff" stroke="#0c0d0f" strokeWidth={3} />
          <text x={160} y={33} textAnchor="middle" className="jy-stamp-t">
            REAL TREND
          </text>
          <text x={160} y={58} textAnchor="middle" className="jy-mini">
            by chance: under 1 in 1,000 · p = 0.0008
          </text>
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- 7 · checked against reality */
function Scene7() {
  const hist = [8, 6, 5, 9, 10, 23, 26, 23, 47, 105];
  const total = hist.reduce((a, b) => a + b, 0);
  const bx = 450;
  const bw = 30;
  const base = 360;
  const k = 2.2;
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A weather station and NASA agree on the daily temperature; a bar chart shows that most real track buckles in the US happened on the hottest days">
      <rect width={800} height={450} fill="#f7f8fa" />
      <text x={60} y={42} className="jy-label jy-fade">
        Check 1 · NASA vs stations
      </text>
      <g className="jy-fade" style={d(300)}>
        <rect x={60} y={58} width={280} height={140} rx={14} fill="#fff" stroke="#e6e8eb" />
        <text x={76} y={80} className="jy-mini muted">
          daily temperature, one year
        </text>
      </g>
      {[0, 1].map((kk) => (
        <polyline
          key={kk}
          points={Array.from({ length: 41 }, (_, i) => {
            const x = 76 + i * 6.2;
            const y = 146 - 34 * Math.sin((i / 40) * Math.PI) - (kk ? 2 : 0) + 4 * Math.sin(i * 1.7 + (kk ? 0.3 : 0));
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ")}
          fill="none"
          stroke={kk ? "#2563eb" : "#4b5563"}
          strokeWidth={2.5}
          strokeLinejoin="round"
          pathLength={1}
          className="jy-draw"
          style={d(6000)}
        />
      ))}
      <g className="jy-fade" style={d(6000)}>
        <line x1={76} x2={96} y1={182} y2={182} stroke="#4b5563" strokeWidth={3} />
        <text x={102} y={186} className="jy-mini">
          station
        </text>
        <line x1={176} x2={196} y1={182} y2={182} stroke="#2563eb" strokeWidth={3} />
        <text x={202} y={186} className="jy-mini">
          NASA
        </text>
      </g>
      <g className="jy-fade" style={d(500)}>
        <Station x={110} y={310} />
        <text x={110} y={334} textAnchor="middle" className="jy-mini">
          NOAA station
        </text>
      </g>
      <g className="jy-fade" style={d(800)}>
        <g transform="translate(290 262) scale(0.8)">
          <Satellite />
        </g>
        <text x={290} y={334} textAnchor="middle" className="jy-mini">
          NASA
        </text>
      </g>
      <g className="jy-pop" style={d(9000)}>
        <rect x={100} y={360} width={200} height={40} rx={20} fill="#0c0d0f" />
        <text x={200} y={386} textAnchor="middle" className="jy-pill">
          they agree: 0.97 out of 1
        </text>
      </g>
      <text x={bx} y={42} className="jy-label jy-fade" style={d(12500)}>
        Check 2 · {total} real track buckles (US)
      </text>
      <text x={bx} y={62} className="jy-mini muted jy-fade" style={d(12500)}>
        how hot each buckle day was, vs. summer there
      </text>
      {hist.map((v, i) => (
        <rect key={i} x={bx + i * bw} y={base - v * k} width={bw - 4} height={v * k} rx={3} fill={i === 9 ? "#d63a2f" : i >= 7 ? "#f2a78a" : "#cbd0d6"} className="jy-grow" style={d(13200 + i * 160)} />
      ))}
      <g className="jy-fade" style={d(13200)}>
        <line x1={bx} x2={bx + 10 * bw} y1={base} y2={base} stroke="#d5d8dd" />
        <text x={bx} y={base + 20} className="jy-mini muted">
          cooler days
        </text>
        <text x={bx + 10 * bw - 4} y={base + 20} textAnchor="end" className="jy-mini muted">
          hottest
        </text>
      </g>
      <g className="jy-fade" style={d(20000)}>
        <line x1={bx - 6} x2={bx + 10 * bw} y1={base - (total / 10) * k} y2={base - (total / 10) * k} stroke="#0c0d0f" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={bx} y={base - (total / 10) * k - 8} className="jy-mini">
          if heat did not matter
        </text>
        <text x={bx + 5 * bw} y={base + 40} textAnchor="middle" className="jy-mini muted">
          each bar: one tenth of the summer days
        </text>
      </g>
      <g className="jy-pop" style={d(20600)}>
        <rect x={bx + 10 * bw - 216} y={84} width={216} height={34} rx={17} fill="#d63a2f" />
        <text x={bx + 10 * bw - 108} y={106} textAnchor="middle" className="jy-pill">
          40% in the hottest tenth
        </text>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- 8 · the future */
const DAYS = Array.from({ length: 20 }, (_, i) => 24 + ((i * 37) % 23)); // illustrative daily maximum temperatures, °C
const WARMING = 2.8;

function Scene8() {
  const models = ["GISS", "ACCESS", "EC-Earth", "MPI", "MRI", "NorESM"];
  const x0 = 130;
  const step = 28;
  const bw = 21;
  const base = 385;
  const top = 230;
  const yv = (v: number) => base - ((v - 20) / 30) * (base - top);
  const before = DAYS.filter((v) => v >= 40).length;
  const after = DAYS.filter((v) => v + WARMING >= 40).length;
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label={`Six climate models give the warming for each month; it is added to real days, and the days at 40 °C go from ${before} to ${after}`}>
      <rect width={800} height={450} fill="#fbf7f1" />
      <text x={400} y={30} textAnchor="middle" className="jy-label jy-fade">
        6 NASA climate models
      </text>
      {models.map((m, i) => {
        const cx = 145 + i * 102;
        return (
          <g key={m} className="jy-pop" style={d(300 + i * 200)}>
            <circle cx={cx} cy={70} r={24} fill="#dbeafe" stroke="#60a5fa" />
            <ellipse cx={cx} cy={70} rx={10} ry={24} fill="none" stroke="#3b82f6" />
            <line x1={cx - 24} x2={cx + 24} y1={70} y2={70} stroke="#3b82f6" />
            <text x={cx} y={112} textAnchor="middle" className="jy-mini">
              {m}
            </text>
          </g>
        );
      })}
      <g className="jy-pop" style={d(5500)}>
        <rect x={290} y={128} width={220} height={36} rx={18} fill="#c2410c" />
        <text x={400} y={151} textAnchor="middle" className="jy-pill">
          July: +{WARMING} °C by 2050
        </text>
      </g>
      <g className="jy-fade" style={d(11000)}>
        <text x={x0} y={206} className="jy-mini muted">
          real NASA days, 1995–2014 · daily high, °C
        </text>
        {[20, 30, 40].map((g) => (
          <text key={g} x={x0 - 10} y={yv(g) + 4} textAnchor="end" className="jy-mini muted">
            {g}°
          </text>
        ))}
      </g>
      {DAYS.map((v, i) => (
        <rect key={`a${i}`} x={x0 + i * step} y={yv(v)} width={bw} height={base - yv(v)} rx={3} fill="#cbd0d6" className="jy-grow" style={d(11000 + i * 50)} />
      ))}
      {DAYS.map((v, i) => (
        <rect key={`b${i}`} x={x0 + i * step} y={yv(v + WARMING)} width={bw} height={yv(v) - yv(v + WARMING)} rx={2} fill="#f2783a" className="jy-fade" style={d(13500 + i * 50)} />
      ))}
      <g className="jy-fade" style={d(13500)}>
        <rect x={560} y={196} width={12} height={12} rx={2} fill="#cbd0d6" />
        <text x={578} y={206} className="jy-mini muted">
          real day
        </text>
        <rect x={650} y={196} width={12} height={12} rx={2} fill="#f2783a" />
        <text x={668} y={206} className="jy-mini muted">
          + warming
        </text>
      </g>
      <line x1={x0 - 6} x2={x0 + 20 * step} y1={base} y2={base} stroke="#d5d8dd" />
      <g className="jy-fade" style={d(16500)}>
        <line x1={x0 - 6} x2={x0 + 20 * step} y1={yv(40)} y2={yv(40)} stroke="#d63a2f" strokeWidth={2} strokeDasharray="6 4" />
        <text x={x0 + 20 * step + 6} y={yv(40) + 4} className="jy-mini b" style={{ fill: "#d63a2f" }}>
          40 °C
        </text>
      </g>
      {DAYS.map((v, i) =>
        v < 40 && v + WARMING >= 40 ? (
          <rect key={`c${i}`} x={x0 + i * step - 3} y={yv(v + WARMING) - 3} width={bw + 6} height={base - yv(v + WARMING) + 3} rx={5} fill="none" stroke="#d63a2f" strokeWidth={2.5} className="jy-pop" style={d(17200)} />
        ) : null,
      )}
      <g className="jy-pop" style={d(17600)}>
        <rect x={560} y={128} width={200} height={36} rx={18} fill="#0c0d0f" />
        <text x={660} y={151} textAnchor="middle" className="jy-pill">
          days at 40 °C: {before} → {after}
        </text>
      </g>
      <text x={x0} y={base + 30} className="jy-mini jy-fade" style={d(19000)}>
        the same days, warmer → run every step again → 2050 and 2090
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------- 9 · to you */
function Scene9() {
  const tabs = ["Overview", "Heat watch", "My trip", "Track lab", "2050"];
  return (
    <svg viewBox="0 0 800 450" className="jy-svg" role="img" aria-label="A laptop and a phone show the Orbitrack app, fed by NASA data and this week's forecast">
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
        <g className="jy-fade" style={d(1200)}>
          <g transform="translate(134 280) scale(0.8)">
            <LogoMark />
          </g>
          <text x={164} y={300} className="jy-label">
            {APP_NAME}
          </text>
        </g>
      </g>
      <g className="jy-pop" style={d(5000)}>
        <rect x={600} y={120} width={130} height={240} rx={20} fill="#0c0d0f" />
        <rect x={609} y={132} width={112} height={216} rx={12} fill="#fff" />
        <text x={620} y={160} className="jy-mini">
          Heat watch
        </text>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={620 + i * 14} y={250 - [20, 30, 46, 60, 38, 26, 18][i]} width={10} height={[20, 30, 46, 60, 38, 26, 18][i]} rx={2} fill={i === 3 ? "#d63a2f" : "#fbb868"} className="jy-grow" style={d(5400 + i * 120)} />
        ))}
        <text x={620} y={280} className="jy-mini muted">
          next 7 days
        </text>
      </g>
      <g className="jy-fade" style={d(5300)}>
        <path d="M640 64 q-6 -26 22 -26 q8 -22 34 -12 q28 -8 30 20 q22 4 14 22 Z" fill="#fff" stroke="#cbd0d6" />
        <text x={662} y={98} className="jy-mini muted">
          forecast
        </text>
        <path d="M680 104 L680 118" stroke="#94a3b8" strokeWidth={3} className="jy-flow" />
      </g>
      {tabs.map((t, i) => (
        <g key={t} className="jy-pop" style={d(10500 + i * 250)}>
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
/** Scenes only re-render when they read the clock (counters), not on every tick of the page. */
const SceneView = memo(function SceneView({ i }: { i: number }) {
  const S = SCENES[i];
  return <S />;
});

export function JourneyPage() {
  const [sp] = useSearchParams(); // ?step=4 opens that chapter
  const [step, setStep] = useState(() => Math.min(SCENES.length, Math.max(1, Number(sp.get("step")) || 1)) - 1);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0); // restarts the scene when the same step is replayed
  const [t, setT] = useState(0);
  const dur = DUR[step];

  // scene clock: a steady tick while playing (setInterval keeps working where animation frames are throttled)
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      setT((x) => x + (now - last));
      last = now;
    }, 40);
    return () => clearInterval(id);
  }, [playing, step, run]);

  // next scene when this one is done; stop after the last
  useEffect(() => {
    if (!playing || t < dur) return;
    if (step >= SCENES.length - 1) setPlaying(false);
    else {
      setStep(step + 1);
      setT(0);
    }
  }, [t, dur, step, playing]);

  const go = (i: number) => {
    setStep(i);
    setT(0);
    setRun((r) => r + 1);
    setPlaying(true);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && step < SCENES.length - 1) go(step + 1);
      if (e.key === "ArrowLeft" && step > 0) go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const st = STEPS[step];
  const beat = st.beats.reduce((cur, [at], i) => (t >= at * PACE ? i : cur), 0);
  return (
    <div className="wrap jy" style={{ paddingTop: 24 }}>
      <div className="jy-head">
        <h1>How it works</h1>
        <p>From a satellite to your screen, in nine steps.</p>
      </div>
      <div className="jy-grid">
        <div style={{ minWidth: 0 }}>
          <div className={`jy-stage${playing ? "" : " paused"}`}>
            <ClockCtx.Provider value={t}>
              <div key={`${step}-${run}`} className="jy-scene">
                <SceneView i={step} />
              </div>
            </ClockCtx.Provider>
            <div className="jy-progress" aria-hidden>
              <i style={{ width: `${Math.min(100, (100 * t) / dur)}%` }} />
              {st.beats.slice(1).map(([at]) => (
                <b key={at} style={{ left: `${(100 * at * PACE) / dur}%` }} />
              ))}
            </div>
          </div>
          <div className="jy-cap" aria-live="polite">
            <ol>
              {st.beats.map(([at, text], i) => (
                <li key={`${step}-${run}-${at}`} className={i < beat ? "past" : i === beat ? "now" : "next"}>
                  {text}
                </li>
              ))}
            </ol>
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
                if (!playing && step === SCENES.length - 1 && t >= dur) go(0);
                else setPlaying((p) => !p);
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
