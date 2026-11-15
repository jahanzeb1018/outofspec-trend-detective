import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SpainMap, type Arrow } from "../components/SpainMap";
import { StackedArea } from "../components/charts/StackedArea";
import { AgeMatrix } from "../components/charts/AgeMatrix";
import { Loading, Metric, Seg } from "../components/ui";
import { PERIODS, fmt, signed } from "../config";
import { useJson, useNetwork, useSummary } from "../data/load";
import { useFocus } from "../state/focus";

const SCEN_PLAIN: Record<string, string> = { ssp245: "Intermediate emissions", ssp585: "High emissions" };

export function NetworkPage() {
  const [sp, setSp] = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const scen = sp.get("scen") === "ssp585" ? "ssp585" : "ssp245";
  const per = sp.get("per") === "2081-2100" ? "2081-2100" : "2041-2060";
  const perTxt = per.replace("-", "–");
  const key = `${scen}|${per}`;
  const { data: network } = useNetwork();
  const { data: summary } = useSummary();
  const { openExpert } = useFocus();
  const { data: cells } = useJson<GeoJSON.FeatureCollection<GeoJSON.Polygon, { c: string; lat: number; lon: number; km: number }>>("cells.geojson");
  const center = useMemo(() => new Map((cells?.features ?? []).map((f) => [f.properties.c, [f.properties.lon, f.properties.lat] as [number, number]])), [cells]);
  const kmOf = useMemo(() => new Map((cells?.features ?? []).map((f) => [f.properties.c, f.properties.km])), [cells]);
  const analogs = useMemo(() => network?.analogs[key] ?? [], [network, key]);
  const ranked = useMemo(() => {
    const seen = new Set<string>();
    return [...analogs]
      .filter((a) => a.ok && a.to && a.to !== a.from && a.to_place && a.from_place !== a.to_place)
      .sort((a, b) => (kmOf.get(b.from) ?? 0) - (kmOf.get(a.from) ?? 0))
      .filter((a) => {
        const k = `${a.from_place}>${a.to_place}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }, [analogs, kmOf]);
  const arrows: Arrow[] = useMemo(
    () =>
      ranked
        .slice(0, 14)
        .map((a) => ({ from: center.get(a.from)!, to: center.get(a.to!)!, ok: true }))
        .filter((a) => a.from && a.to),
    [ranked, center],
  );
  const noAnalog = analogs.filter((a) => !a.ok);
  const noAnalogCells = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of noAnalog) out[a.from] = "#8a1c2b";
    return out;
  }, [noAnalog]);

  if (!network || !summary) return <div className="wrap"><Loading what="the 2050 view" /></div>;
  if (!summary.models.length)
    return (
      <div className="wrap" style={{ paddingTop: 36 }}>
        <h1>The network in 2050</h1>
        <p className="warnbox" style={{ marginTop: 16 }}>The NASA NEX-GDDP-CMIP6 projections have not been processed yet. Run the pipeline (see README).</p>
      </div>
    );
  const card = network.future_cards[key];
  const ratio = card.km_hot40_gt10 / Math.max(1, card.km_hot40_gt10_ref);
  const weak = network.nomargin_km.weak;

  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <div className="eyebrow">THE NETWORK IN THE FUTURE · {summary.models.length} NASA NEX-GDDP-CMIP6 CLIMATE MODELS</div>
      <h1 style={{ marginTop: 12, maxWidth: 980 }}>
        By {perTxt}, <span style={{ color: "var(--heat-4)" }}>{fmt(card.km_hot40_gt10, 0)} km</span> of Spanish track will bake through 10+ days a year above 40&nbsp;°C.
      </h1>
      <p className="lead" style={{ marginTop: 14, maxWidth: 820 }}>
        In 1995–2014 it was {fmt(card.km_hot40_gt10_ref, 0)} km — about <b>{fmt(ratio, 0)}× less</b>. The railway is moving into a climate it was not designed for. These are scenarios, not forecasts: the outcome
        depends on emissions.
      </p>

      <div className="row" style={{ marginTop: 22, gap: 12 }}>
        <Seg label="Emissions" value={scen} onChange={(v) => set({ scen: v })} options={summary.scenarios.map((s) => ({ id: s, label: SCEN_PLAIN[s] ?? s }))} />
        <Seg label="Period" value={per} onChange={(v) => set({ per: v })} options={PERIODS.map((p) => ({ id: p, label: p.replace("-", "–") }))} />
        <button className="btn ghost" onClick={() => openExpert("future")}>How we project</button>
      </div>

      <div className="metrics" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 28 }} data-tour="net-cards">
        <Metric value={`×${fmt(ratio, ratio < 10 ? 1 : 0)}`} label="km of track with 10+ days ≥ 40 °C a year" color="var(--heat-4)" />
        <Metric value={`${fmt(weak?.[key], 0)} km`} label={<>would have no buckling margin if freshly repaired on the hottest day (today {fmt(weak?.recent, 0)} km)</>} />
        <Metric value={`${signed(card.frost_change_pct, 0)}%`} label="frost days — good news: fewer cold rail breaks" color="var(--cold)" />
        <Metric value={`+${fmt(card.neutral_shift_median, 1)} °C`} label="how much warmer rail must be laid to keep today's heat margin" />
      </div>

      <section className="section">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div className="eyebrow">CLIMATE TWINS</div>
            <h2 style={{ marginTop: 10 }}>Your line will feel like somewhere else.</h2>
            <p className="ink2" style={{ marginTop: 12, lineHeight: 1.6 }}>
              For each part of the network we find the place on today's railway whose climate is closest to its {perTxt} climate.
            </p>
            <div className="stack" style={{ marginTop: 18, gap: 0 }}>
              {ranked.slice(0, 7).map((a) => (
                <div key={a.from_place + a.to_place} className="row" style={{ justifyContent: "space-between", padding: "11px 0", borderTop: "1px solid var(--line)", flexWrap: "nowrap" }}>
                  <span style={{ fontWeight: 600 }}>{a.from_place}</span>
                  <span className="small muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    feels like <ArrowRight size={14} />
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--heat-4)" }}>{a.to_place} today</span>
                </div>
              ))}
            </div>
            {noAnalog.length > 0 && (
              <div className="card soft" style={{ marginTop: 18 }}>
                <div className="big" style={{ color: "#8a1c2b", fontSize: 40 }}>{noAnalog.length}</div>
                <p className="ink2" style={{ marginTop: 6 }}>
                  of {analogs.length} areas will have <b>a climate no Spanish line experiences today</b> — no twin anywhere on the network (dark red on the map).
                </p>
              </div>
            )}
            <p className="note" style={{ marginTop: 12 }}>Matching on days ≥ 40 °C, hot-day temperature, tropical nights and frost days. Method inspired by Bastin et al. (2019, PLOS ONE).</p>
          </div>
          <div className="mapcard" style={{ flex: "1.4 1 480px", minWidth: 0 }}>
            <div className="mapbox" style={{ height: 520 }}>
              <SpainMap arrows={arrows} cellColors={noAnalogCells} cellOpacity={0.55} dimSegments label="Map with arrows from each area to its present-day climate twin" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">THE SHIFT</div>
        <h2 style={{ marginTop: 10, maxWidth: 820 }}>Track-km by how many days a year top 40&nbsp;°C.</h2>
        <p className="ink2" style={{ marginTop: 10, maxWidth: 760 }}>Observed NASA years on the left; the climate-model median for each future period on the right ({SCEN_PLAIN[scen].toLowerCase()}).</p>
        <div className="card" style={{ marginTop: 18 }}>
          <StackedArea
            classes={network.stacked.classes}
            years={network.stacked.years}
            observed={network.stacked.observed}
            columns={[
              { label: "1995– 2014", values: network.stacked.ref },
              { label: "2041– 2060", values: network.stacked.future[`${scen}|2041-2060`] },
              { label: "2081– 2100", values: network.stacked.future[`${scen}|2081-2100`] },
            ]}
          />
        </div>
      </section>

      <section className="section">
        <div className="grid g2">
          <div className="card">
            <h3>Fastest-warming sections</h3>
            <p className="small ink2" style={{ marginTop: 6 }}>Extra days ≥ 40 °C per decade since 1981, significant after correcting for testing many places at once.</p>
            <table className="data" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Near</th>
                  <th>Line</th>
                  <th>/decade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {network.top10.map((t) => (
                  <tr key={t.segment_id}>
                    <td style={{ fontWeight: 600 }}>{t.place}</td>
                    <td className="small ink2">{t.line}</td>
                    <td className="tabular">{signed(t.sen)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link to={`/lab?seg=${t.segment_id}`}>Test it →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Older lines, hotter places?</h3>
            <p className="small ink2" style={{ marginTop: 6 }}>Each bubble is a high-speed line: when it opened vs. how many ≥ 40 °C days it sees now. Size = km.</p>
            <div style={{ marginTop: 12 }}>
              <AgeMatrix points={network.age} />
            </div>
            <p className="note" style={{ marginTop: 8 }}>Opening year of each line's first section (public sources), not the last renewal date, which is not public.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
