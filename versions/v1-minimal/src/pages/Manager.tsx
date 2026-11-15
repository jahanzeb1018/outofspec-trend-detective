import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Loading, Prov } from "../components/ui";
import { fmt, signed } from "../config";
import { loadCell, useSegments, useSummary } from "../data/load";
import type { CellDetail } from "../data/types";
import { bsmBand, shiftYears, simulate, type Preset, type TnSpec } from "../model/buckling";

interface Row {
  name: string;
  segment_id?: string;
  lat?: number;
  lon?: number;
  neutral_temp_c?: number;
  preset?: Preset;
  lateral_resistance_kn_m?: number;
}
interface Out extends Row {
  cell?: string;
  error?: string;
  bsm_recent?: number;
  bsm_future?: number;
  days_recent?: number;
  days_future?: number;
  heat_shift?: number;
  cold_shift?: number;
}

const TEMPLATE = "name,segment_id,lat,lon,neutral_temp_c,preset,lateral_resistance_kn_m\nSection A,,37.88,-4.79,25,average,\nSection B,,40.42,-3.70,,weak,\nSection C,,41.65,-0.88,27,,24\n";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (field += '"', i++);
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";") (cur.push(field), (field = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else field += c;
  }
  if (field || cur.length) (cur.push(field), rows.push(cur));
  const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const num = (s: string | undefined) => (s && s.trim() !== "" && Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : undefined);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ManagerPage() {
  const { data: summary } = useSummary();
  const { data: segFc } = useSegments();
  const [rows, setRows] = useState<Out[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [scen, setScen] = useState("ssp245");
  const [per, setPer] = useState("2041-2060");

  async function run(text: string) {
    if (!summary || !segFc) return;
    setBusy(true);
    const ids = Object.keys(summary.cells);
    // Load every cell file regardless of the uploaded content, so requests reveal nothing about your data.
    const cells = new Map<string, CellDetail>((await Promise.all(ids.map((c) => loadCell(c)))).map((c) => [c.cell_id, c]));
    const segCell = new Map(segFc.features.map((f) => [f.properties.id, f.properties.c]));
    const out: Out[] = parseCsv(text).map((r, i) => {
      const row: Out = {
        name: r.name || `row ${i + 1}`, segment_id: r.segment_id || undefined, lat: num(r.lat), lon: num(r.lon), neutral_temp_c: num(r.neutral_temp_c),
        preset: (["strong", "average", "weak", "unknown"].includes(r.preset) ? r.preset : undefined) as Preset | undefined, lateral_resistance_kn_m: num(r.lateral_resistance_kn_m),
      };
      let cid: string | undefined;
      if (row.segment_id) cid = segCell.get(row.segment_id);
      else if (row.lat !== undefined && row.lon !== undefined) {
        const la = Math.round(row.lat / 0.5) * 0.5;
        const lo = Math.round(row.lon / 0.625) * 0.625;
        cid = `${la.toFixed(2)}_${lo.toFixed(3)}`;
      }
      const cell = cid ? cells.get(cid) : undefined;
      if (!cell) return { ...row, error: "outside the analysed network cells (or unknown segment id)" };
      const all = cell.rail.daily_x10.map((y) => y.map((v) => v / 10));
      const at = (y: number) => cell.rail.years.indexOf(y);
      const ref = all.slice(at(1995), at(2014) + 1);
      const recent = all.slice(at(2006), at(2025) + 1);
      const tn: TnSpec = row.neutral_temp_c !== undefined ? { kind: "value", value: row.neutral_temp_c } : { kind: "fra" };
      const preset: Preset = row.preset ?? "unknown";
      const fp = row.lateral_resistance_kn_m ?? null;
      const rec = simulate(recent, preset, { tn, fp, n: 800, seed: 7 });
      const fut = Object.entries(cell.rail.deltas_tasmax)
        .map(([, s], k) => (s[scen]?.[per] ? simulate(shiftYears(ref, s[scen][per]), preset, { tn, fp, n: 300, seed: 50 + k }) : null))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      const w = cell.rail.windows[`${scen}|${per}`];
      return {
        ...row, cell: cid, bsm_recent: rec.bsm_med, days_recent: rec.days_mean,
        bsm_future: fut.length ? med(fut.map((f) => f.bsm_med)) : undefined, days_future: fut.length ? med(fut.map((f) => f.days_mean)) : undefined,
        heat_shift: w?.heat?.med, cold_shift: w?.cold?.med,
      };
    });
    setRows(out);
    setBusy(false);
  }

  if (!summary || !segFc) return <Loading what="manager mode" />;
  const csvOut = rows
    ? ["name,cell,bsm_2006_2025_C,band_2006_2025,days_without_margin_2006_2025,bsm_future_C,band_future,days_without_margin_future,neutral_shift_heat_C,neutral_shift_cold_C,error"]
        .concat(
          rows.map((r) =>
            [r.name, r.cell ?? "", fmt(r.bsm_recent, 2), r.bsm_recent !== undefined ? bsmBand(r.bsm_recent) : "", fmt(r.days_recent, 3), fmt(r.bsm_future, 2), r.bsm_future !== undefined ? bsmBand(r.bsm_future) : "", fmt(r.days_future, 3), fmt(r.heat_shift, 2), fmt(r.cold_shift, 2), r.error ?? ""]
              .map((x) => `"${String(x).replace(/"/g, '""')}"`)
              .join(","),
          ),
        )
        .join("\n")
    : "";
  return (
    <div className="container">
      <div className="eyebrow">Manager mode · your data stays on your device</div>
      <h1>Bring your own track data</h1>
      <p className="secondary" style={{ maxWidth: 820 }}>
        Infrastructure managers know what we cannot: neutral temperatures, ballast state, maintenance. Upload a CSV and every section is evaluated <b>in your browser</b> against NASA heat today and in the future.
        Nothing you upload is sent anywhere.
      </p>
      <div className="card row" style={{ gap: 12 }}>
        <label className="btn primary">
          <Upload size={16} /> Upload CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => e.target.files?.[0] && run(await e.target.files[0].text())} />
        </label>
        <button className="btn" onClick={() => run(TEMPLATE)}>
          Try the example
        </button>
        <button className="btn" onClick={() => download("track-template.csv", TEMPLATE)}>
          <Download size={16} /> Template
        </button>
        <label className="field">
          Scenario
          <select value={scen} onChange={(e) => setScen(e.target.value)}>
            <option value="ssp245">SSP2-4.5</option>
            <option value="ssp585">SSP5-8.5</option>
          </select>
        </label>
        <label className="field">
          Period
          <select value={per} onChange={(e) => setPer(e.target.value)}>
            <option>2041-2060</option>
            <option>2081-2100</option>
          </select>
        </label>
      </div>
      <p className="tiny muted">
        Columns: name, segment_id (from the explorer) or lat/lon, neutral_temp_c, preset (strong | average | weak | unknown) and/or lateral_resistance_kn_m. Empty values use the FRA distributions. <Prov kind="user" /> your data ·{" "}
        <Prov kind="nasa" /> climate.
      </p>
      {busy && <Loading what="all cells and running the model" />}
      {rows && (
        <section className="section card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Results</h2>
            <button className="btn small" onClick={() => download("track-results.csv", csvOut)}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Cell</th>
                  <th>Margin 2006–25</th>
                  <th>Margin {per}</th>
                  <th>Days w/o margin (now → future)</th>
                  <th>Neutral-T window</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.cell ?? "–"}</td>
                    {r.error ? (
                      <td colSpan={4} className="err">
                        {r.error}
                      </td>
                    ) : (
                      <>
                        <td className={`band-${bsmBand(r.bsm_recent!)}`}>{signed(r.bsm_recent)} °C</td>
                        <td className={r.bsm_future !== undefined ? `band-${bsmBand(r.bsm_future)}` : ""}>{signed(r.bsm_future)} °C</td>
                        <td className="tabular">
                          {fmt(r.days_recent, 2)} → {fmt(r.days_future, 2)}
                        </td>
                        <td className="tabular">
                          {signed(r.heat_shift)} … {signed(r.cold_shift)} °C
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted">Model and assumptions as in the lab (FRA-based, US parameters). Conditional on your inputs; not a prediction of incidents.</p>
        </section>
      )}
    </div>
  );
}
