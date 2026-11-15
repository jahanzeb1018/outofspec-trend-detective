import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SpainMap } from "../components/SpainMap";
import { Legend, Loading, Seg } from "../components/ui";
import { valueScale } from "../colors";
import { IND, fmt } from "../config";
import { useJson, useSummary } from "../data/load";
import type { SegmentProps } from "../data/types";
import { CLUE, smart, verdictOf, type VerdictClass } from "../v2/kit";
import { Stamp } from "../v2/ui";

type CellsFC = GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; km: number; place: string }>;
const INDS = ["HOT40", "HOT35", "RAIL_AM", "TXX", "TN20", "HOTSPELL", "FROST", "COLD5", "R20"];
const VCOLOR: Record<VerdictClass, string> = { up: "#ef4b3c", "hint-up": "#f2a33a", none: "#5f6168", "hint-down": "#8bb8ff", down: "#3b82f6", rare: "#2a2b30" };
const VLABEL: Record<VerdictClass, string> = { up: "Rising · confirmed", "hint-up": "Rising · signs", none: "No clear change", "hint-down": "Falling · signs", down: "Falling · confirmed", rare: "Too rare to judge" };

export function MapsPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const ind = INDS.includes(sp.get("ind") ?? "") ? sp.get("ind")! : "HOT40";
  const mode = (["verdict", "now", "fut"].includes(sp.get("mode") ?? "") ? sp.get("mode") : "verdict") as "verdict" | "now" | "fut";
  const set = (k: string, v: string) => setSp((p) => (p.set(k, v), p), { replace: true });
  const { data: summary } = useSummary();
  const { data: cellsFc } = useJson<CellsFC>("cells.geojson");
  const [sel, setSel] = useState<SegmentProps | null>(null);
  const info = useMemo(() => new Map((cellsFc?.features ?? []).map((f) => [f.properties.c, f.properties])), [cellsFc]);
  const meta = IND[ind];
  const scale = useMemo(() => (summary ? valueScale(summary, ind, meta.kind) : null), [summary, ind, meta.kind]);

  const { colors, kmBy } = useMemo(() => {
    const colors: Record<string, string> = {};
    const kmBy: Record<VerdictClass, number> = { up: 0, "hint-up": 0, none: 0, "hint-down": 0, down: 0, rare: 0 };
    if (!summary || !scale) return { colors, kmBy };
    for (const [cid, c] of Object.entries(summary.cells)) {
      const r = c[ind];
      const v = verdictOf(r);
      kmBy[v.cls] += info.get(cid)?.km ?? 0;
      if (mode === "verdict") colors[cid] = VCOLOR[v.cls];
      else {
        const x = mode === "now" ? r?.late : r?.fut?.ssp245?.["2041-2060"]?.[0];
        colors[cid] = scale.color(x ?? null);
      }
    }
    return { colors, kmBy };
  }, [summary, scale, ind, mode, info]);

  if (!summary || !scale) return <div className="wrap page"><Loading what="the maps" /></div>;
  const title = CLUE[ind]?.title ?? meta.label;
  const up = kmBy.up;
  const down = kmBy.down;
  const r = sel ? summary.cells[sel.c]?.[ind] : null;
  const place = sel ? info.get(sel.c)?.place : null;

  return (
    <div className="wrap page">
      <Link to="/" className="backlink">
        <ArrowLeft size={15} /> Back to start
      </Link>
      <div className="eyebrow" style={{ marginTop: 18 }}>Railway maps of Spain · NASA POWER 1981–2025</div>
      <h1 style={{ marginTop: 10, fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", maxWidth: 900 }}>
        {title}:{" "}
        {up > 0 && down > 0 ? (
          <>
            confirmed rise on <span style={{ color: "var(--hot)" }}>{fmt(up, 0)} km</span> of track and fall on <span style={{ color: "var(--cold)" }}>{fmt(down, 0)} km</span>.
          </>
        ) : up > 0 ? (
          <>
            confirmed rise on <span style={{ color: "var(--hot)" }}>{fmt(up, 0)} km</span> of track — and a confirmed fall nowhere.
          </>
        ) : down > 0 ? (
          <>
            confirmed fall on <span style={{ color: "var(--cold)" }}>{fmt(down, 0)} km</span> of track — and a confirmed rise nowhere.
          </>
        ) : (
          <>no confirmed change anywhere on the network.</>
        )}
      </h1>
      <div className="chips" style={{ marginTop: 20 }}>
        {INDS.map((x) => (
          <button key={x} className="chipbtn" aria-pressed={x === ind} onClick={() => (set("ind", x), setSel(null))}>
            {CLUE[x]?.short ?? IND[x].short}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <Seg label="Colour by" value={mode} onChange={(v) => set("mode", v)} options={[{ id: "verdict", label: "Verdict since 1981" }, { id: "now", label: "Today" }, { id: "fut", label: "2041–2060" }]} />
        <Link className="btn small" to="/network">The network in 2050 →</Link>
      </div>
      <div className="mapcard" style={{ marginTop: 14 }}>
        <div className="mapbox" style={{ height: "min(70vh, 680px)" }}>
          <SpainMap segColors={colors} selectedSegment={sel?.id ?? null} selectedCell={sel?.c ?? null} onSegment={setSel} lineWidth={1.2} label={`Map: ${title}`} />
          {sel && r && (
            <div className="float" style={{ left: 12, bottom: 12, width: 320 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b style={{ fontSize: 18 }}>{place} area</b>
                <button className="round" style={{ width: 30, height: 30 }} onClick={() => setSel(null)} aria-label="Close">×</button>
              </div>
              <div className="mono small muted" style={{ marginTop: 2 }}>{sel.n || "railway section"}</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
                {smart(r.early)} → {smart(r.late)}
              </div>
              <div className="small ink2">{CLUE[ind]?.unit ?? meta.unit} · 1981–90 → 2016–25</div>
              <div style={{ marginTop: 10 }}>
                <Stamp v={verdictOf(r)} small />
              </div>
              <button className="btn hot small" style={{ marginTop: 14, width: "100%" }} onClick={() => navigate(`/case/${sel.c}`)}>
                Open the {place} case <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
        {mode === "verdict" ? (
          <div className="legend-row">
            {(["up", "hint-up", "none", "hint-down", "down"] as VerdictClass[]).map((k) => (
              <span key={k}>
                <span className="sw" style={{ background: VCOLOR[k] }} />
                {VLABEL[k]}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ maxWidth: 360, marginTop: 10 }}>
            <Legend scale={scale} title={`${meta.label}${mode === "fut" ? " · 2041–2060, intermediate emissions" : " · 2016–2025"}`} unit={meta.unit} />
          </div>
        )}
      </div>
      <p className="note" style={{ marginTop: 12, maxWidth: 820 }}>
        Tap any section to see its verdict. “Confirmed” = Mann-Kendall (Hamed–Rao) p &lt; 0.05 and still significant after the Benjamini–Hochberg false-discovery correction across all 159 NASA cells; “signs” = significant on its own but not after the correction.
      </p>
    </div>
  );
}
