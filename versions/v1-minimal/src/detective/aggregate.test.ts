import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { aggregateVariable, SEASONS } from "./aggregate";

const fx = JSON.parse(readFileSync(new URL("../stats/__golden__/detective_fixture.json", import.meta.url), "utf8"));

describe("detective aggregation parity with pipeline/detective.py", () => {
  for (const variable of Object.keys(fx.expected)) {
    it(variable, () => {
      const inds = Object.keys(fx.expected[variable]);
      const got = aggregateVariable(fx.start, fx.data[variable], inds, fx.years);
      for (const ind of inds)
        for (const s of SEASONS) {
          const e = fx.expected[variable][ind][s] as (number | null)[];
          const g = got[ind][s];
          expect(g.length).toBe(e.length);
          g.forEach((v, i) => {
            if (e[i] === null) expect(v).toBeNull();
            else expect(v).toBeCloseTo(e[i] as number, 2);
          });
        }
    });
  }
});
