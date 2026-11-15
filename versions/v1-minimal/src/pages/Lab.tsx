import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { Loading, Prov, Seg, Switch } from "../components/ui";
import { useAssistant } from "../ai/AssistantContext";
import { fmt, signed } from "../config";
import { useCell, useNetwork, useSegments } from "../data/load";
import type { Preset, TnSpec } from "../model/buckling";
import type { McRequest, McResponse } from "../model/mc.worker";
import { useFocus } from "../state/focus";

function band(m: number) {
  if (m < 0) return { t: "No margin", c: "var(--bad)", n: "On the hottest days the track could kink sideways." };
  if (m < 100 / 9) return { t: "Tight", c: "var(--tight)", n: "Close to the limit on the hottest days." };
  if (m < 200 / 9) return { t: "Comfortable", c: "var(--ok)", n: "Holds the heat with room to spare." };
  return { t: "Very comfortable", c: "#146c3a", n: "Plenty of room even on the hottest days." };
}

function Bend({ margin }: { margin: number }) {
  const kink = margin < 0 ? Math.min(24, 8 + -margin * 2.5) : margin < 11 ? 3 : 0;
  const path = (yy: number) => {
    let s = `M10 ${yy}`;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const b = kink * Math.sin((t - 0.5) * Math.PI * 2) * Math.exp(-(((t - 0.5) / 0.16) ** 2));
      s += ` L${(10 + t * 380).toFixed(1)} ${(yy + b).toFixed(1)}`;
    }
    return s;
  };
  const col = margin < 0 ? "#c62828" : "#4a515c";
  return (
    <svg viewBox="0 0 400 70" width="100%" height="70" role="img" aria-label={margin < 0 ? "Track drawn kinked" : "Track drawn straight"}>
      {[30, 80, 130, 180, 230, 280, 330, 380].map((x) => (
        <line key={x} x1={x} y1={14} x2={x} y2={56} stroke="#c3c8cf" strokeWidth={3} />
      ))}
      <path d={path(27)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .5s" }} />
      <path d={path(43)} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" style={{ transition: "all .5s" }} />
    </svg>
  );
}

export function LabPage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const { data: segFc } = useSegments();
  const { data: network } = useNetwork();
  const { setFocus, openExpert } = useFocus();
  const assistant = useAssistant();
  let segId = sp.get("seg");
  if ((!segId || segId === "auto") && network) segId = network.top10[0]?.segment_id ?? null;
  const seg = useMemo(() => segFc?.features.find((f) => f.properties.id === segId)?.properties ?? null, [segFc, segId]);
  const preset = (["strong", "average", "weak", "unknown"].includes(sp.get("preset") ?? "") ? sp.get("preset") : seg?.t === "HSL" ? "strong" : "average") as Preset;
  const tnVal = sp.get("tn") !== null ? Number(sp.get("tn")) : null;
  const tn: TnSpec = tnVal !== null && Number.isFinite(tnVal) ? { kind: "value", value: tnVal } : { kind: "fra" };
  const { data: cell } = useCell(seg?.c ?? null);
  const [desc, setDesc] = useState("");
  const [descNote, setDescNote] = useState<{ why: string[]; source: "si" | "rules" } | null>(null);

  useEffect(() => {
    if (seg && cell) setFocus({ cellId: seg.c, segmentId: seg.id, indicator: "RAIL_AM", label: `${cell.place} area` });
  }, [seg, cell, setFocus]);

  const workerRef = useRef<Worker | null>(null);
  const [mc, setMc] = useState<McResponse | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    const w = new Worker(new URL("../model/mc.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<McResponse>) => e.data.id === reqId.current && setMc(e.data);
    workerRef.current = w;
    return () => w.terminate();
  }, []);
  const years = useMemo(() => {
    if (!cell) return null;
    const all = cell.rail.daily_x10.map((y) => y.map((v) => v / 10));
    const at = (y: number) => cell.rail.years.indexOf(y);
    return { ref: all.slice(at(1995), at(2014) + 1), recent: all.slice(at(2006), at(2025) + 1) };
  }, [cell]);
  const deltas = useMemo(() => {
    const out: Record<string, number[]> = {};
    if (cell) for (const [m, s] of Object.entries(cell.rail.deltas_tasmax)) if (s.ssp245?.["2041-2060"]) out[m] = s.ssp245["2041-2060"];
    return out;
  }, [cell]);
  const tnKey = JSON.stringify(tn);
  useEffect(() => {
    if (!years || !workerRef.current) return;
    const id = ++reqId.current;
    const req: McRequest = { id, ref: years.ref, recent: years.recent, deltas, preset, tn, fp: null };
    workerRef.current.postMessage(req);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years, deltas, preset, tnKey]);

  if (!segFc || !network) return <div className="wrap"><Loading what="the lab" /></div>;
  const now = mc?.recent;
  const fut = mc?.future?.med;
  const win = cell?.rail.windows["ssp245|2041-2060"];

  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <div className="eyebrow">TRACK LAB · FRA-BASED BUCKLING MODEL · NASA HEAT</div>
      <h1 style={{ marginTop: 10, fontSize: "clamp(2rem, 4vw, 3.1rem)" }}>Will this track hold?</h1>
      <p className="lead" style={{ marginTop: 10 }}>
        {seg ? (
          <>
            <b>{seg.n || "Unnamed line"}</b> near {cell?.place ?? "…"} · {seg.t === "HSL" ? "high-speed" : "conventional"} line. Pick another section on the map.
          </>
        ) : (
          "Pick a section on the map."
        )}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 24 }}>
        <div className="stack" style={{ flex: "1 1 420px", minWidth: 0, gap: 16 }}>
          <div className="card" data-tour="lab-presets">
            <h3>Your track</h3>
            <div style={{ marginTop: 14 }}>
              <Seg
                label="Track condition"
                value={preset}
                onChange={(v) => set({ preset: v })}
                options={[
                  { id: "strong", label: "Modern" },
                  { id: "average", label: "Typical" },
                  { id: "weak", label: "Just repaired" },
                  { id: "unknown", label: "Not sure" },
                ]}
              />
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              <Switch on={tnVal !== null} onChange={(v) => set({ tn: v ? "25" : null })} label="I know its neutral temperature" />
              {tnVal !== null && <span className="mono">{tnVal} °C</span>}
            </div>
            {tnVal !== null && <input type="range" min={10} max={40} value={tnVal} onChange={(e) => set({ tn: e.target.value })} aria-label="Neutral temperature" />}
            <p className="note" style={{ marginTop: 10 }}>
              “Just repaired” = ballast not yet settled after maintenance, when track is weakest. The neutral temperature is the rail's stress-free temperature; if unknown we use the FRA range (16–38&nbsp;°C).
            </p>
          </div>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Describe it in your words</h3>
              {descNote && <Prov kind={descNote.source === "si" ? "ai" : "rules"} />}
            </div>
            <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. wooden sleepers, tamped in May, neutral temperature around 22 °C" style={{ width: "100%", marginTop: 10 }} />
            <button
              className="btn"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const r = await assistant.describeTrack(desc);
                setDescNote({ why: r.why, source: r.source });
                set({ preset: r.preset, tn: r.tn !== undefined ? String(r.tn) : null });
              }}
            >
              <Sparkles size={14} /> Set the track for me
            </button>
            {descNote && <p className="small ink2" style={{ marginTop: 8 }}>{descNote.why.join(" · ")}</p>}
          </div>
          <div className="mapcard">
            <div className="mapbox" style={{ height: 340 }}>
              <SpainMap selectedSegment={seg?.id ?? null} onSegment={(p) => set({ seg: p.id })} label="Map: click a railway section to test it" />
            </div>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <span className="small muted">Fastest-warming:</span>
              {network.top10.filter((t, i, a) => a.findIndex((x) => x.place === t.place) === i).slice(0, 4).map((t) => (
                <button key={t.segment_id} className="btn" style={{ minHeight: 30, padding: "4px 10px", fontSize: 13 }} onClick={() => set({ seg: t.segment_id })}>
                  {t.place}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ flex: "1.3 1 520px", minWidth: 0, gap: 16 }}>
          {!now ? (
            <div className="card"><Loading what="the simulation" /></div>
          ) : (
            <>
              <div className="grid g2">
                {[
                  { k: "Today (2006–2025)", r: now },
                  { k: "2041–2060 · intermediate emissions", r: fut },
                ].map(({ k, r }) =>
                  r ? (
                    <div key={k} className="card">
                      <div className="small ink2">{k}</div>
                      <div style={{ fontSize: 34, fontWeight: 650, letterSpacing: "-0.03em", color: band(r.bsm_med).c, marginTop: 8 }}>{band(r.bsm_med).t}</div>
                      <div className="row" style={{ gap: 18, marginTop: 10 }}>
                        <div className="metric">
                          <div className="v" style={{ fontSize: 26 }}>{signed(r.bsm_med, 1)} °C</div>
                          <div className="l">margin on the hottest day</div>
                        </div>
                        <div className="metric">
                          <div className="v" style={{ fontSize: 26 }}>{fmt(r.days_mean, r.days_mean < 10 ? 1 : 0)}</div>
                          <div className="l">days a year with no margin</div>
                        </div>
                      </div>
                      <Bend margin={r.bsm_med} />
                      <p className="small ink2">{band(r.bsm_med).n}</p>
                    </div>
                  ) : (
                    <div key={k} className="card muted">Projections not available.</div>
                  ),
                )}
              </div>
              <div className="card" style={{ background: "var(--soft)", borderColor: "transparent" }}>
                <h3>What would keep it safe in 2050?</h3>
                {win?.heat && win.cold ? (
                  <p className="ink2" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    Re-laying the rail about <b>{fmt(win.heat.med, 1)}&nbsp;°C warmer</b> (its “neutral temperature”) would keep today's heat margin.{" "}
                    {win.heat.med <= win.cold.med ? (
                      <>Winters here warm enough to allow it (up to {fmt(win.cold.med, 1)}&nbsp;°C) — a clear, cheap adaptation.</>
                    ) : (
                      <>
                        But winters only allow about <b>{fmt(win.cold.med, 1)}&nbsp;°C</b> before cold-weather rail breaks get worse — a real trade-off for engineers.
                      </>
                    )}
                  </p>
                ) : (
                  <p className="muted">…</p>
                )}
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn" onClick={() => openExpert("model")}>See the model and the numbers</button>
                </div>
              </div>
              <p className="note">
                Model: Kish &amp; Samavedam (2013), US Federal Railroad Administration, with NASA-based rail temperatures (±4 °C) and NASA NEX-GDDP-CMIP6 projections. Results depend on your assumptions and are not an assessment of any real line.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
