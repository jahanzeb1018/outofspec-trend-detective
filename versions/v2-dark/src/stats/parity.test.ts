import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bhFdr, trend, yearsNeeded } from "./trend";
import { dtAllow, simulate } from "../model/buckling";

const gold = JSON.parse(readFileSync(new URL("./__golden__/trend_golden.json", import.meta.url), "utf8"));

describe("trend statistics: parity with pipeline/stats.py", () => {
  for (const s of gold.series) {
    it(s.name, () => {
      const t = trend(s.y);
      const e = s.expected;
      expect(t.n).toBe(e.n);
      expect(t.sen_slope).toBeCloseTo(e.sen_slope, 6);
      expect(t.sen_intercept).toBeCloseTo(e.sen_intercept, 6);
      expect(t.ci_low).toBeCloseTo(e.ci_low, 5);
      expect(t.ci_high).toBeCloseTo(e.ci_high, 5);
      expect(t.mk_s).toBe(e.mk_s);
      expect(Math.abs(t.p_mk_hr - e.p_mk_hr)).toBeLessThan(1e-3);
      expect(t.ols_slope).toBeCloseTo(e.ols_slope, 6);
      expect(Math.abs(t.p_ols - e.p_ols)).toBeLessThan(1e-3);
      expect(yearsNeeded(s.y, t.sen_slope, t.sen_intercept)).toBe(e.years_needed);
    });
  }
  it("Benjamini-Hochberg", () => {
    const r = bhFdr(gold.bh.p, gold.bh.alpha);
    expect(r.rejected).toEqual(gold.bh.rej);
    r.q.forEach((q, i) => expect(q).toBeCloseTo(gold.bh.q[i], 9));
  });
});

describe("buckling model: parity with pipeline/buckling.py", () => {
  it("allowable temperature increase", () => {
    for (const c of gold.buckling.cases) expect(dtAllow(c.fp)).toBeCloseTo(c.dt_allow, 6);
  });
  it("deterministic simulation", () => {
    const d = gold.buckling.deterministic;
    const r = simulate(d.years, d.preset, { n: 10, tn: { kind: "value", value: d.tn }, sigma: 0 });
    for (const k of ["days_mean", "days_p10", "days_p90", "p_any", "bsm_med", "bsm_p10", "bsm_p90", "rail_am_med"] as const) expect(r[k]).toBeCloseTo(d.result[k], 9);
  });
  it("FRA bands and margins", () => {
    expect(dtAllow(31.52)).toBeCloseTo(55.56, 1);
    expect(dtAllow(21.02)).toBeCloseTo(47.78, 1);
    expect(dtAllow(12.26)).toBeCloseTo(33.33, 1);
  });
});
