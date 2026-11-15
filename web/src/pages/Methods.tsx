import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { Link } from "react-router-dom";
import { Loading, Term } from "../components/ui";
import { GLOSSARY } from "../content/glossary";
import { fmt, signed } from "../config";
import { useNetwork, useSummary, useValidation } from "../data/load";
import { FRA_POINTS } from "../model/buckling";

function MiniLines({ years, a, b, labels }: { years: number[]; a: number[]; b: number[]; labels: [string, string] }) {
  const W = 420;
  const H = 150;
  const x = scaleLinear().domain([years[0], years[years.length - 1]]).range([30, W - 8]);
  const y = scaleLinear().domain([0, Math.max(...a, ...b, 1)]).nice().range([H - 20, 8]);
  const p = (v: number[]) => line<number>().x((_, i) => x(years[i])).y((d) => y(d))(v) ?? "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${labels[0]} versus ${labels[1]}`}>
      {y.ticks(4).map((t) => (
        <text key={t} x={26} y={y(t) + 4} textAnchor="end">
          {t}
        </text>
      ))}
      {[years[0], years[Math.floor(years.length / 2)], years[years.length - 1]].map((t) => (
        <text key={t} x={x(t)} y={H - 4} textAnchor="middle">
          {t}
        </text>
      ))}
      <path d={p(a)} fill="none" stroke="#475569" strokeWidth={2} />
      <path d={p(b)} fill="none" stroke="#e4512e" strokeWidth={2} />
      <text x={W - 8} y={14} textAnchor="end" style={{ fill: "#475569", fontWeight: 700 }}>
        {labels[0]}
      </text>
      <text x={W - 8} y={28} textAnchor="end" style={{ fill: "#e4512e", fontWeight: 700 }}>
        {labels[1]}
      </text>
    </svg>
  );
}

function Scatter({ pts }: { pts: [number, number][] }) {
  const W = 380;
  const H = 260;
  const all = pts.flat();
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 0.1);
  const x = scaleLinear().domain([lo, hi]).nice().range([40, W - 10]);
  const y = scaleLinear().domain([lo, hi]).nice().range([H - 30, 10]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Observed versus modelled trend per cell">
      <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="var(--border)" strokeDasharray="3 3" />
      {pts.map(([a, b], i) => (
        <circle key={i} cx={x(a)} cy={y(b)} r={3} fill="#e4512e" fillOpacity={0.55} />
      ))}
      {x.ticks(5).map((t) => (
        <text key={t} x={x(t)} y={H - 12} textAnchor="middle">
          {t}
        </text>
      ))}
      {y.ticks(5).map((t) => (
        <text key={t} x={34} y={y(t) + 4} textAnchor="end">
          {t}
        </text>
      ))}
      <text x={W - 10} y={H - 2} textAnchor="end">
        observed (MERRA-2), °C/decade
      </text>
      <text x={44} y={14}>
        models (median), °C/decade
      </text>
    </svg>
  );
}

const corr = (p: [number, number][]) => {
  const n = p.length;
  const ma = p.reduce((s, q) => s + q[0], 0) / n;
  const mb = p.reduce((s, q) => s + q[1], 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (const [a, b] of p) {
    sab += (a - ma) * (b - mb);
    saa += (a - ma) ** 2;
    sbb += (b - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};

export function MethodsPage() {
  const { data: summary } = useSummary();
  const { data: val } = useValidation();
  const { data: network } = useNetwork();
  if (!summary || !val) return <Loading what="methods" />;
  const st = val.stations.filter((s) => s.years >= 20);
  const hc = val.hist_check.filter((h) => h.TXP95.model_med !== null).map((h) => [h.TXP95.obs, h.TXP95.model_med!] as [number, number]);
  const meanObs = hc.length ? hc.reduce((s, p) => s + p[0], 0) / hc.length : null;
  const meanMod = hc.length ? hc.reduce((s, p) => s + p[1], 0) / hc.length : null;
  const signAgree = hc.length ? (100 * hc.filter(([a, b]) => Math.sign(a) === Math.sign(b)).length) / hc.length : null;
  return (
    <div className="container">
      <div className="eyebrow">Methods & data</div>
      <h1>How every number is made</h1>
      <p className="secondary">
        Everything in this app is computed by an open pipeline (Python, in <code>/pipeline</code>) or by the same algorithms in your browser. Pipeline version {summary.meta.pipeline_version}, data generated{" "}
        {summary.meta.generated}.
      </p>

      <section className="section card">
        <h2>Data</h2>
        <div className="table-wrap" style={{ maxHeight: "none" }}>
          <table className="data">
            <thead>
              <tr>
                <th>What</th>
                <th>Product</th>
                <th>Agency</th>
                <th>Resolution · period</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Daily max/min/mean air temperature, wind, precipitation, humidity</td><td>NASA POWER ← MERRA-2 reanalysis (GMAO)</td><td>NASA</td><td>0.5° × 0.625° · daily 1981–2025</td><td><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">POWER daily API</a></td></tr>
              <tr><td>Surface solar radiation, cloud amount</td><td>NASA POWER ← GEWEX SRB / CERES</td><td>NASA</td><td>~1° · daily 1984–2025</td><td>POWER API</td></tr>
              <tr><td>Future daily tasmax / tasmin</td><td>NEX-GDDP-CMIP6 ({summary.models.join(", ") || "pending"})</td><td>NASA (NEX, Ames)</td><td>0.25° · 1981–2014 historical; 2041–2060 and 2081–2100 (SSP2-4.5, SSP5-8.5)</td><td><a href="https://ds.nccs.nasa.gov/thredds/catalog/AMES/NEX/GDDP-CMIP6/catalog.html" target="_blank" rel="noreferrer">NCCS THREDDS (subset service)</a></td></tr>
              <tr><td>Weather-station validation</td><td>GHCN-Daily (behind NOAA Climate Data Online)</td><td>NOAA</td><td>stations · daily</td><td><a href="https://www.ncei.noaa.gov/cdo-web/" target="_blank" rel="noreferrer">NOAA CDO</a></td></tr>
              <tr><td>Railway network (lines, gauge, electrification, speed)</td><td>OpenStreetMap, via Overpass</td><td>community</td><td>vector · 2026</td><td>© OpenStreetMap contributors, ODbL</td></tr>
              <tr><td>Base maps, place search</td><td>Natural Earth</td><td>public domain</td><td>1:50m / 1:110m</td><td><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">naturalearthdata.com</a></td></tr>
            </tbody>
          </table>
        </div>
        <p className="small">
          The network is split into {fmt(network?.headline.total_km, 0)} km of ~8 km sections (parallel tracks merged). Each section takes the climate of the NASA MERRA-2 cell under its midpoint ({Object.keys(summary.cells).length} cells, ~50
          km) — the same scale as the climate zones Adif uses for neutral temperatures (some only ~50 km long, Público 2022).
        </p>
      </section>

      <section className="section grid grid-2">
        <div className="card">
          <h2>Trend statistics — in plain words</h2>
          <ul className="small">
            <li>We count, every year, how many days pass a threshold (e.g. 40 °C) — this removes the seasonal cycle.</li>
            <li><Term k="sen">Sen's slope</Term> gives the rate of change per decade and its 95% confidence interval.</li>
            <li>The <Term k="mk">Mann-Kendall test</Term> asks whether the series goes up or down more consistently than chance.</li>
            <li>When we colour a map we test {Object.keys(summary.cells).length} places at once, so we apply the <Term k="fdr">false-discovery correction</Term>.</li>
            <li>A non-significant trend is still shown, with an estimate of how many more years would be needed to detect it.</li>
          </ul>
        </div>
        <div className="card">
          <h2>…and technically</h2>
          <ul className="small">
            <li>Sen (1968) slope, Gilbert (1987) CI from the Mann-Kendall variance with ties.</li>
            <li>Mann-Kendall with the Hamed & Rao (1998) correction for autocorrelation (significant rank-autocorrelation lags of the Sen-detrended series). Conservative variant: the correction never shrinks the variance below the independent case (the unrestricted version gave ~10% false positives on white noise with n = 45 in our tests; this one gives 5%).</li>
            <li>OLS slope with a two-sided t-test for reference.</li>
            <li>Benjamini & Hochberg (1995) FDR across cells, α<sub>FDR</sub> = {summary.meta.alpha_fdr} (Wilks 2016). Single tests use α = {summary.meta.alpha}.</li>
            <li>Years needed: σ<sub>eff</sub> = sd·√((1+φ)/(1−φ)); n<sub>req</sub> = ∛(12·(1.96·σ<sub>eff</sub>/|b|)²) — 50% power of the trend test; approximate.</li>
            <li>Series with &gt; 50% zero years are flagged “too rare”. Non-linear analysis is out of scope (the challenge suggests linear trends); a 10-year moving average guides the eye.</li>
            <li>Browser and pipeline use identical algorithms; parity is tested against golden files (Vitest vs pytest/pymannkendall).</li>
          </ul>
        </div>
      </section>

      <section className="section card">
        <h2>Models</h2>
        <h3><Term k="railtemp">Rail temperature</Term> (NASA air + sun − wind)</h3>
        <p className="small">
          T<sub>rail,max</sub> = T<sub>air,max</sub> + ΔT<sub>ref</sub> · (G<sub>peak</sub>/G<sub>ref</sub>) · (h(v<sub>ref</sub>)/h(v)), capped to 0–25 °C, with ΔT<sub>ref</sub> = 17 °C (FRA field data: rail 25–35 °F above
          air), h(v) = 5.7 + 3.8·v W/m²K (McAdams forced convection), G<sub>peak</sub> = π·H/(2·N) from NASA daily irradiance H and day length N. Anchor: medians on days ≥ 35 °C over the network, G<sub>ref</sub> ={" "}
          {fmt(summary.meta.g_ref, 0)} W/m², v<sub>ref</sub> = {fmt(summary.meta.v_ref, 2)} m/s. Uncertainty ±4 °C (thermodynamic models RMSE ≈ 3.8 °C, Sensors 2021).
        </p>
        <h3>Buckling safety margin (FRA)</h3>
        <p className="small">
          BSM = ΔT<sub>all</sub> − (T<sub>rail</sub> − T<sub>neutral</sub>) (Kish & Samavedam 2013, DOT/FRA/ORD-13/16). ΔT<sub>all</sub> follows the FRA rule (ΔT<sub>Bmin</sub> if ΔT<sub>Bmax</sub> − ΔT<sub>Bmin</sub> &gt; 10 °F,
          else ΔT<sub>Bmax</sub> − 10 °F) applied to their parametric results: {FRA_POINTS.map(([f, t]) => `${fmt(f)} kN/m → ${fmt(t)} °C`).join("; ")}, interpolated linearly. Bands: &lt; 0 none, 0–11 minimum, 11–22
          adequate, &gt; 22 °C desired. Monte Carlo (seeded, Web Worker) over neutral temperature and lateral resistance (CWR-RISK “Case A” distributions) and rail-model error. Curvature is shown as a qualitative flag.
        </p>
        <h3>Future: delta method</h3>
        <p className="small">
          For each cell, model, scenario and period, monthly ΔT = model mean (period) − model mean (1995–2014); future days = observed 1995–2014 days + ΔT (max and min separately). Indicators are recomputed and
          summarised as the model median and range. Only temperatures change (sun and wind kept). Climate twins: nearest present-day cell in standardised [HOT40, TXP95, TN20, FROST] space (Bastin et al. 2019).
        </p>
      </section>

      <section className="section card">
        <h2>Validation</h2>
        <h3>1 · NASA POWER vs weather stations (NOAA GHCN-Daily)</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Station</th>
                <th>Years</th>
                <th>Daily Tmax r</th>
                <th>Bias (POWER − station)</th>
                <th>Days ≥35 °C/yr station vs POWER</th>
                <th>Trend /decade station vs POWER</th>
              </tr>
            </thead>
            <tbody>
              {val.stations.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name} <span className="muted">({s.city}, {fmt(s.dist_km, 0)} km)</span>
                  </td>
                  <td>{s.years}</td>
                  <td>{fmt(s.daily_r, 3)}</td>
                  <td>{signed(s.daily_bias, 2)} °C</td>
                  <td>
                    {fmt(s.hot35_obs_mean)} vs {fmt(s.hot35_power_mean)}
                  </td>
                  <td>
                    {signed(s.hot35_sen_obs, 2)} vs {signed(s.hot35_sen_power, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-2" style={{ marginTop: 10 }}>
          {st.slice(0, 2).map((s) => (
            <div key={s.id}>
              <b className="small">
                {s.city}: days ≥ 35 °C per year
              </b>
              <MiniLines years={s.series.years} a={s.series.hot35_obs} b={s.series.hot35_power} labels={["station", "NASA POWER"]} />
            </div>
          ))}
        </div>
        <p className="small">
          MERRA-2 cells (~50 km) smooth local extremes: absolute counts can differ from a single station, but the year-to-year variations and the trends agree well. That is why we focus on trends and offer
          relative thresholds (TXP95).
        </p>
        <h3>2 · Climate models vs observations, 1981–2014</h3>
        {hc.length ? (
          <div className="grid grid-2">
            <Scatter pts={hc} />
            <p className="small">
              Trend of the hot-day temperature (TXP95) per cell: observed MERRA-2 {signed(meanObs, 2)} °C/decade on average vs {signed(meanMod, 2)} °C/decade for the model median (NEX-GDDP-CMIP6 historical
              runs). Same sign in {fmt(signAgree, 0)}% of cells; correlation across cells r = {fmt(corr(hc), 2)}. The models are bias-corrected but not tuned to these trends, so this is an independent check.
              {meanObs !== null && meanMod !== null && meanMod > 1.5 * meanObs && (
                <>
                  {" "}
                  Here the models warm faster than MERRA-2 over 1981–2014. Part of the gap is natural variability over a 34-year window, and the station comparison above suggests MERRA-2 may
                  understate local warming of the hottest days. This is one reason we apply model <i>changes</i> to observed days (delta method) instead of using raw model values — and why our
                  future numbers should be read as scenarios with a range.
                </>
              )}
            </p>
          </div>
        ) : (
          <p className="muted small">Pending: run the projection steps of the pipeline.</p>
        )}
        <h3>3 · NASA Giovanni cross-check</h3>
        {val.giovanni && val.giovanni.length > 0 && (
          <p className="small">
            {val.giovanni.map((g) => `cell ${g.cell_id}: r = ${fmt(g.r, 3)}, bias ${signed(g.bias, 2)} °C over ${g.days} days`).join(" · ")}
          </p>
        )}
        <p className="small">
          Pending — Giovanni needs a free NASA Earthdata login. Steps: Giovanni → “Time Series, Area-Averaged” → MERRA-2 daily T2M max (M2SDNXSLV) → box around a cell → download CSV → put it in{" "}
          <code>pipeline/validate/giovanni/</code> and run <code>giovanni_check.py</code>; the chart and the correlation are added here automatically.
        </p>
        {val.fra_t109 && (
          <>
            <h3>4 · Real buckled-track derailments (US, FRA cause code T109)</h3>
            <p className="small">
              {val.fra_t109.with_coords} T109 derailments with coordinates ({val.fra_t109.years[0]}–{val.fra_t109.years[1]}). On the derailment day, NASA POWER maximum temperature sat at the{" "}
              {fmt(val.fra_t109.median_percentile, 0)}th percentile of local May–September days (median); {fmt(100 * val.fra_t109.share_above_p90, 0)}% were above the 90th percentile and{" "}
              {fmt(100 * val.fra_t109.share_above_p75, 0)}% above the 75th (by chance: 10% and 25%). A consistency check of the heat component, not a calibration. Source: {val.fra_t109.source}.
            </p>
            <svg viewBox="0 0 420 150" className="chart" style={{ maxWidth: 520 }} role="img" aria-label="Histogram of the temperature percentile on derailment days">
              {val.fra_t109.histogram.map((c, i) => {
                const m = Math.max(...val.fra_t109!.histogram);
                const h = (110 * c) / m;
                return (
                  <g key={i}>
                    <rect x={30 + i * 38} y={120 - h} width={32} height={h} fill={i >= 9 ? "#d32f2f" : "#94a3b8"} />
                    <text x={46 + i * 38} y={116 - h} textAnchor="middle">
                      {c}
                    </text>
                    <text x={46 + i * 38} y={134} textAnchor="middle">
                      {i * 10}–{i * 10 + 10}
                    </text>
                  </g>
                );
              })}
              <text x={30} y={148}>
                percentile of the day's maximum temperature in the local May–September climate
              </text>
            </svg>
          </>
        )}
      </section>

      <section className="section grid grid-2">
        <div className="card">
          <h2>Limitations</h2>
          <ul className="small">
            <li>~50 km cells: microclimates, cuttings, shade and orientation are not resolved.</li>
            <li>Rail temperature is estimated (±4 °C), not measured.</li>
            <li>The buckling model uses US (FRA) parameters and tangent track; neutral temperatures, ballast state and maintenance are Adif's internal data, so results depend on the user's assumptions.</li>
            <li>Opening year ≠ last renewal; renewal dates are not public.</li>
            <li>Futures are scenarios (6 models, delta method on temperature only), not forecasts.</li>
            <li>OSM metric-gauge networks tagged as narrow gauge are not included.</li>
            <li>Nothing here is a safety assessment of any real line.</li>
          </ul>
        </div>
        <div className="card">
          <h2>Challenge resources used</h2>
          <ul className="small">
            <li>MERRA-2 (named in the challenge) through NASA POWER; GPM/MODIS/GLDAS are listed for future work (they need an Earthdata login).</li>
            <li>NOAA Climate Data Online (GHCN-Daily) for station validation.</li>
            <li>Giovanni: cross-check workflow prepared (needs Earthdata login).</li>
            <li>Methodological reading: NTRS “Time-Series Analysis of Remotely-Sensed SeaWiFS Chlorophyll…”, trend-test and significance guides listed in the challenge.</li>
          </ul>
          <h2>Use of SI (super intelligence)</h2>
          <p className="small">
            SI tools (Anthropic's Claude) were used to accelerate coding, documentation and literature search. The optional in-app assistant (“Ask”, “Explain it”) only selects
            options from a closed catalog and explains numbers computed by the pipeline; its outputs are labelled “SI-assisted”, and a rule-based mode works without it. No SI-generated images are used.
          </p>
        </div>
      </section>

      <section className="section card">
        <h2>References</h2>
        <ul className="small">
          <li>Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. JASA 63, 1379–1389.</li>
          <li>Hamed, K. H. & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. J. Hydrology 204, 182–196.</li>
          <li>Benjamini, Y. & Hochberg, Y. (1995). Controlling the false discovery rate. JRSS B 57, 289–300.</li>
          <li>Wilks, D. S. (2016). “The stippling shows statistically significant grid points”. BAMS 97, 2263–2273.</li>
          <li>Hirsch, R. M., Slack, J. R. & Smith, R. A. (1982). Techniques of trend analysis for monthly water quality data. WRR 18, 107–121.</li>
          <li>Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). J. Climate 30, 5419–5454.</li>
          <li>Thrasher, B. et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. Scientific Data 9, 262.</li>
          <li>Kish, A. & Samavedam, G. (2013). Track Buckling Prevention: Theory, Safety Concepts, and Applications. FRA, DOT/FRA/ORD-13/16.</li>
          <li>A Rail-Temperature-Prediction Model Based on Machine Learning (2021). Sensors 21(13), 4606.</li>
          <li>Bastin, J.-F. et al. (2019). Understanding climate change from a global analysis of city analogues. PLOS ONE 14(7): e0217592.</li>
          <li>Identification of factors contributing to broken and buckled rails (2025). European Transport Research Review, doi 10.1186/s12544-025-00725-w.</li>
          <li>Buckled-track derailments: long-term trends and implications for rail neutral temperature management (2026). Accident Analysis & Prevention.</li>
          <li>Público (22/07/2022), interview with Adif on neutral-temperature zones; Cátedra Adif-UPM seminar (24/01/2024, SNCF Réseau data).</li>
        </ul>
        <p className="tiny muted">
          These data were obtained from the NASA Langley Research Center POWER Project and from the NASA Earth Exchange (NEX-GDDP-CMIP6). Not an official NASA product; no NASA endorsement implied.
        </p>
      </section>

      <section className="section grid grid-2">
        <div className="card">
          <h2>Download & reproduce</h2>
          <ul className="small">
            <li>
              <a href="./data/summary.json">summary.json</a> · <a href="./data/network.json">network.json</a> · <a href="./data/validation.json">validation.json</a> · <a href="./data/routes.json">routes.json</a> ·{" "}
              <a href="./data/segments.geojson">segments.geojson</a> · per-cell files in <code>data/cells/</code>
            </li>
            <li>
              <code>python -m venv .venv && pip install -r pipeline/requirements.txt</code>, then <code>python pipeline/run_all.py</code> and <code>cd web && npm ci && npm run build</code>.
            </li>
            <li>
              Bring your own track data: <Link to="/manager">manager mode</Link> computes everything locally in your browser.
            </li>
          </ul>
        </div>
        <div className="card">
          <h2>Glossary</h2>
          <dl className="small">
            {Object.values(GLOSSARY).map((g) => (
              <div key={g.term} style={{ marginBottom: 6 }}>
                <dt style={{ fontWeight: 700 }}>{g.term}</dt>
                <dd style={{ margin: 0 }}>{g.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
