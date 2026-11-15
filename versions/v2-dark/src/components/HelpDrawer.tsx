import { Link } from "react-router-dom";
import { X } from "lucide-react";

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} role="presentation" />
      <aside className="drawer" role="dialog" aria-label="How OutOfSpec works">
        <div className="head row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">How it works</div>
            <h2 style={{ marginTop: 6, fontSize: 26 }}>OutOfSpec</h2>
          </div>
          <button className="round" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="body">
          <p>
            Spain's railway was designed for the climate of the past. OutOfSpec reads 45 years of NASA Earth data along all 13,426 km of track and turns them into answers anyone can check: is it really getting hotter where my train runs,
            could the track buckle, and what will it be like in 2050 — without exaggerating and without hiding the uncertainty.
          </p>
          <h3>Data</h3>
          <ul>
            <li><b>NASA POWER</b> (MERRA-2 reanalysis; CERES/SRB sunshine): daily temperature, sun and wind since 1981 on a 0.5° × 0.625° grid (~55 × 50 km). 159 grid squares touch the railway.</li>
            <li><b>NASA NEX-GDDP-CMIP6</b>: 6 bias-corrected climate models, intermediate (SSP2-4.5) and high (SSP5-8.5) emissions, applied with the delta method.</li>
            <li><b>NOAA GHCN-Daily</b>: weather stations used as independent witnesses.</li>
            <li><b>OpenStreetMap</b>: the railway network, cut into 8 km sections. <b>Open-Meteo</b>: the 7-day forecast for the live heat watch.</li>
          </ul>
          <h3>How a verdict is decided</h3>
          <p>For each measurement we compare 1981–1990 with 2016–2025 and estimate the trend with Sen's slope, which is robust to extreme years.</p>
          <ul>
            <li><b>Confirmed</b>: Mann-Kendall test with the Hamed–Rao correction, p &lt; 0.05, and still significant after the Benjamini–Hochberg false-discovery correction across all 159 squares (q &lt; 0.10).</li>
            <li><b>Signs</b>: p &lt; 0.05 on its own, but not after the correction.</li>
            <li><b>No clear change</b>: everything else. <b>Too rare</b>: it almost never happens there.</li>
          </ul>
          <h3>Will the track hold?</h3>
          <p>
            Rail temperature = air temperature plus up to ~17 °C from the sun, reduced by wind. The buckling safety margin follows the US Federal Railroad Administration model (Kish &amp; Samavedam, 2013) with published track
            strengths: modern, typical and just-repaired track. It is a screening estimate, not an assessment of any real line.
          </p>
          <h3>The live heat watch</h3>
          <p>Each day the 7-day forecast is compared with each square's own 1981–2025 NASA record for that month. A watch needs a physically relevant rail temperature; “unusually warm” alone is shown separately and carries no rail risk.</p>
          <h3>Limits</h3>
          <ul>
            <li>A NASA square describes a ~50 km area, not a single cutting or bridge.</li>
            <li>Track age, neutral temperature and maintenance history are not public; you choose them, and results depend on those choices.</li>
            <li>Projections are scenarios, not forecasts.</li>
          </ul>
          <h3>Use of AI</h3>
          <p>The optional assistant (Anthropic's Claude) only interprets questions and writes plain-language summaries from numbers our pipeline computed. Its output is labelled “SI-assisted”; without it, a rule-based mode is used.</p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link className="btn small" to="/methods" onClick={onClose}>Full methods &amp; validation</Link>
            <Link className="btn small" to="/detective" onClick={onClose}>Any place on Earth</Link>
            <Link className="btn small" to="/manager" onClick={onClose}>Infrastructure managers</Link>
            <a className="btn small" href="https://outofspec-v1.vercel.app" target="_blank" rel="noreferrer">Previous design (v1)</a>
          </div>
          <p className="note" style={{ marginTop: 18 }}>NASA POWER (MERRA-2) · NASA NEX-GDDP-CMIP6 · NOAA · FRA · Open-Meteo · © OpenStreetMap contributors · Natural Earth. Not an official NASA product.</p>
        </div>
      </aside>
    </>
  );
}
