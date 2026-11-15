import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Flame, Snowflake } from "lucide-react";
import { RailScene } from "../components/RailScene";
import { fmt } from "../config";
import { useJson } from "../data/load";
import type { WatchData } from "../model/watch";

/** Track lab: the two formulas behind the app, as an experiment.
 *  Heat: rail = air + 17 °C × sun × wind (rail model v1, pipeline/climate.py), against the FRA buckling limits.
 *  Cold: pull = 18.56 kN per °C below the temperature the rail was laid at (UIC60), against the rail-break reference. */
const SUN = { cloudy: { f: 0.25, label: "Cloudy" }, hazy: { f: 0.6, label: "Hazy" }, full: { f: 1, label: "Full sun" } } as const;
const WIND = { calm: { v: 0.5, label: "Calm" }, breeze: { v: 2.07, label: "Breeze" }, windy: { v: 6, label: "Windy" } } as const;
type Sun = keyof typeof SUN;
type Wind = keyof typeof WIND;
type Track = "repaired" | "standard" | "modern";
type Laid = "std" | "warm";
const h = (v: number) => 5.7 + 3.8 * v;
const TENSION_KN_PER_C = 18.56;
const BREAK_AT = -10;
const WARM_SHIFT = 3;
const LV = [
  { t: "Holds", c: "#1e8e4e", bg: "#e7f4ec" },
  { t: "Tight", c: "#b7791f", bg: "#fdf3dc" },
  { t: "Buckles", c: "#d63a2f", bg: "#fbe4e2" },
  { t: "Buckles badly", c: "#8a1c2b", bg: "#f6dde0" },
];
const LV_COLD = [
  { t: "Fine", c: "#1e8e4e", bg: "#e7f4ec" },
  { t: "Hard frost", c: "#b7791f", bg: "#fdf3dc" },
  { t: "Can snap", c: "#d63a2f", bg: "#fbe4e2" },
  { t: "Likely to snap", c: "#8a1c2b", bg: "#f6dde0" },
];
const sgn = (v: number) => fmt(v, 0).replace("-", "−");
const num = (s: string | null, d: number, lo: number, hi: number) => {
  const n = Number(s);
  return s !== null && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

function Pick<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="lab-pick" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LabPage() {
  const [sp] = useSearchParams();
  const { data: wd } = useJson<WatchData>("watch.json");
  const [mode, setMode] = useState<"heat" | "cold">(sp.get("mode") === "cold" ? "cold" : "heat");
  const [air, setAir] = useState(num(sp.get("air"), 40, 0, 48));
  const [sun, setSun] = useState<Sun>("full");
  const [wind, setWind] = useState<Wind>("breeze");
  const trackParam = sp.get("track") === "typical" ? "standard" : sp.get("track"); // old links used "typical"
  const [track, setTrack] = useState<Track>((["repaired", "standard", "modern"] as Track[]).find((t) => t === trackParam) ?? "repaired");
  const [night, setNight] = useState(num(sp.get("night"), -8, -20, 10));
  const [laid, setLaid] = useState<Laid>("std");

  const tnT = wd?.tn_typical ?? 26.67;
  const limits: Record<Track, number> = { repaired: tnT + (wd?.allow.weak ?? 33.33), standard: tnT + (wd?.allow.average ?? 47.78), modern: tnT + (wd?.allow.strong ?? 55.56) };
  const vRef = wd?.v_ref ?? 2.07;
  const sunF = SUN[sun].f;
  const windF = h(vRef) / h(WIND[wind].v);
  const dt = Math.min(25, Math.max(0, 17 * sunF * windF));
  const rail = air + dt;
  const heatLv = (lim: number) => (rail >= lim + 6 ? 3 : rail >= lim ? 2 : rail >= lim - 6 ? 1 : 0);
  const lim = limits[track];

  const laidAt = tnT + (laid === "warm" ? WARM_SHIFT : 0);
  const breakAt = BREAK_AT + (laid === "warm" ? WARM_SHIFT : 0);
  const pullKn = Math.max(0, TENSION_KN_PER_C * (laidAt - night));
  const tonnes = pullKn / 9.81;
  const coldLv = (b: number) => (night <= b - 5 ? 3 : night <= b ? 2 : night <= -5 ? 1 : 0);

  const lv = mode === "heat" ? LV[heatLv(lim)] : LV_COLD[coldLv(breakAt)];
  const spare = Math.round(lim - rail);

  return (
    <div className="wrap lab" style={{ paddingTop: 32 }}>
      <div className="eyebrow">TRACK LAB</div>
      <h1 style={{ marginTop: 8, fontSize: "clamp(2rem, 4vw, 3rem)" }}>{mode === "heat" ? "Can you buckle the track?" : "Can you snap the rail?"}</h1>
      <p className="lead" style={{ marginTop: 6 }}>
        {mode === "heat" ? "Heat the rail and watch it bend." : "Cool the night and watch the pull."}
      </p>

      <div className="zone-tabs lab-tabs" role="tablist" aria-label="Experiment">
        <button role="tab" aria-selected={mode === "heat"} onClick={() => setMode("heat")} style={mode === "heat" ? { borderColor: "#d63a2f", color: "#d63a2f" } : undefined}>
          <Flame size={15} /> Heat
        </button>
        <button role="tab" aria-selected={mode === "cold"} onClick={() => setMode("cold")} style={mode === "cold" ? { borderColor: "#2563eb", color: "#2563eb" } : undefined}>
          <Snowflake size={15} /> Cold
        </button>
      </div>

      <div className="lab-grid">
        <div className="card lab-ctrl" data-tour="lab-presets">
          {mode === "heat" ? (
            <>
              <label className="lab-slider">
                <span>
                  Air temperature <b>{air} °C</b>
                </span>
                <input type="range" min={0} max={48} value={air} onChange={(e) => setAir(Number(e.target.value))} style={{ accentColor: "#d63a2f" }} />
              </label>
              <div className="lab-row">
                <span>Sun</span>
                <Pick label="Sun" value={sun} onChange={setSun} options={(Object.keys(SUN) as Sun[]).map((k) => ({ id: k, label: SUN[k].label }))} />
              </div>
              <div className="lab-row">
                <span>Wind</span>
                <Pick label="Wind" value={wind} onChange={setWind} options={(Object.keys(WIND) as Wind[]).map((k) => ({ id: k, label: WIND[k].label }))} />
              </div>
              <div className="lab-fx" aria-label="Rail temperature formula">
                <div>
                  <b>{air}°</b>
                  <em>air</em>
                </div>
                <i>+</i>
                <div>
                  <b>{Math.round(dt)}°</b>
                  <em>sun on the steel</em>
                </div>
                <i>=</i>
                <div className="res" style={{ color: LV[heatLv(lim)].c }}>
                  <b>{Math.round(rail)}°</b>
                  <em>rail</em>
                </div>
              </div>
              <p className="tiny muted" style={{ marginTop: -6 }}>
                Sun on the steel = 17 °C × sun ({fmt(sunF, 2)}) × wind ({fmt(windF, 1)}), at most 25 °C. Wind cools the rail.
              </p>
            </>
          ) : (
            <>
              <label className="lab-slider">
                <span>
                  Coldest night <b>{sgn(night)} °C</b>
                </span>
                <input type="range" min={-20} max={10} value={night} onChange={(e) => setNight(Number(e.target.value))} style={{ accentColor: "#2563eb" }} />
              </label>
              <div className="lab-fx" aria-label="Rail pull formula">
                <div>
                  <b>{Math.max(0, Math.round(laidAt - night))}°</b>
                  <em>colder than when laid ({Math.round(laidAt)}°)</em>
                </div>
                <i>×</i>
                <div>
                  <b>18.6</b>
                  <em>kN per °C</em>
                </div>
                <i>=</i>
                <div className="res" style={{ color: LV_COLD[coldLv(breakAt)].c }}>
                  <b>{fmt(tonnes, 0)} t</b>
                  <em>pull on the rail</em>
                </div>
              </div>
              <p className="small ink2" style={{ marginTop: 12 }}>
                Welded rail shrinks in the cold but cannot move, so it pulls. Too much pull and it snaps, usually at a weld.
              </p>
            </>
          )}
        </div>

        <div className="card lab-out">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="small ink2">{mode === "heat" ? `${track === "repaired" ? "Just-repaired" : track === "standard" ? "Standard" : "Modern"} track` : laid === "warm" ? "Rail laid warm" : "Standard rail"}</span>
            <span className="dlevel" style={{ color: lv.c, background: lv.bg }}>
              {lv.t}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>{mode === "heat" ? <RailScene hazard="heat" rail={rail} limit={lim} /> : <RailScene hazard="cold" cold={night} breakAt={breakAt} />}</div>
          <p className="lab-say">
            {mode === "heat"
              ? rail < lim - 0.5
                ? `${Math.max(1, spare)} °C to spare before it buckles.`
                : rail < lim + 0.5
                  ? "Right at its limit: the track can buckle."
                  : `${Math.max(1, -spare)} °C past its limit: the track bends sideways.`
              : night <= breakAt
                ? `Below about ${sgn(breakAt)} °C, the rail can snap.`
                : `${Math.round(night - breakAt)} °C before the rail can snap.`}
          </p>
          <div className="lab-tracks" role="group" aria-label={mode === "heat" ? "Track condition" : "How the rail was laid"}>
            {mode === "heat"
              ? (
                  [
                    ["repaired", "Just repaired"],
                    ["standard", "Standard"],
                    ["modern", "Modern"],
                  ] as [Track, string][]
                ).map(([k, name]) => {
                  const l = LV[heatLv(limits[k])];
                  return (
                    <button key={k} aria-pressed={track === k} onClick={() => setTrack(k)}>
                      <span>
                        {name} <em>holds {Math.round(limits[k])} °C</em>
                      </span>
                      <b style={{ color: l.c }}>{l.t}</b>
                    </button>
                  );
                })
              : (
                  [
                    ["std", "Standard", BREAK_AT],
                    ["warm", "Laid warm for summer", BREAK_AT + WARM_SHIFT],
                  ] as [Laid, string, number][]
                ).map(([k, name, b]) => {
                  const l = LV_COLD[coldLv(b)];
                  return (
                    <button key={k} aria-pressed={laid === k} onClick={() => setLaid(k)}>
                      <span>
                        {name} <em>can snap at about {sgn(b)} °C</em>
                      </span>
                      <b style={{ color: l.c }}>{l.t}</b>
                    </button>
                  );
                })}
          </div>
        </div>
      </div>

      <p className="tiny muted" style={{ marginTop: 16, maxWidth: 900 }}>
        Rail temperature and buckling limits after the US Federal Railroad Administration (Kish, Samavedam &amp; Al-Nazer 2013); pull from steel physics (UIC60 rail). The rest of the app feeds these formulas with NASA data.
      </p>
    </div>
  );
}
