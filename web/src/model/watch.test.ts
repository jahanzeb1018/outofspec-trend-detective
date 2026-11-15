// Parity: the browser's watch rules must match pipeline/watch.py, which produced replays.json.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pctFromQ, statusFor, type Status, type WatchData } from "./watch";

const data = (f: string) => JSON.parse(readFileSync(new URL(`../../public/data/${f}`, import.meta.url), "utf8"));
const w: WatchData = data("watch.json");
const replays: { replays: { frames: { date: string; cells: Record<string, [number, number, number, Status]> }[] }[] } = data("replays.json");

describe("watch rules", () => {
  const q = w.cells[Object.keys(w.cells)[0]];
  const qx = q.tmax[6];
  const qn = q.tmin[0];
  const railLimit = w.tn_typical + w.allow.weak; // rail temperature where a just-repaired track has no margin
  it("separates real watches from unusual-for-the-season", () => {
    const hot = qx[w.quantiles.indexOf(99)] + 1;
    expect(statusFor(hot, 20, railLimit + 2, qx, qn, w)).toBe("heat-warning");
    expect(statusFor(hot, 20, railLimit - 5, qx, qn, w)).toBe("heat-watch");
    expect(statusFor(hot, 20, railLimit - 15, qx, qn, w)).toBe("unusual-warm");
    expect(statusFor(qx[4], 20, railLimit + 1, qx, qn, w)).toBe("heat-watch");
    expect(statusFor(qx[4], 20, railLimit - 20, qx, qn, w)).toBe("ok");
  });
  it("cold rules", () => {
    expect(statusFor(5, -11, 0, qx, qn, w)).toBe("cold-warning");
    expect(statusFor(5, -6, 0, qx, qn, w)).toBe("cold-watch");
  });
  it("matches the Python statuses and percentiles in replays.json", () => {
    let n = 0;
    let bad = 0;
    let pctErr = 0;
    for (const r of replays.replays)
      for (const f of r.frames) {
        const m = Number(f.date.slice(5, 7)) - 1;
        for (const [cid, [tx, rail, pct, st]] of Object.entries(f.cells)) {
          if (st.includes("cold")) continue; // replays are summer heatwaves; minimum temperature is not stored
          const c = w.cells[cid];
          // values are stored rounded to 0.1: skip cases sitting exactly on a threshold
          const p99 = c.tmax[m][w.quantiles.indexOf(99)];
          if (Math.abs(tx - p99) < 0.06 || Math.abs(rail - railLimit) < 0.06 || Math.abs(rail - (railLimit - 10)) < 0.06) continue;
          n++;
          if (statusFor(tx, 40, rail, c.tmax[m], c.tmin[m], w) !== st) bad++;
          pctErr = Math.max(pctErr, Math.abs(pctFromQ(tx, c.tmax[m], w.quantiles) - pct));
        }
      }
    expect(n).toBeGreaterThan(3000);
    expect(bad / n).toBeLessThan(0.005); // only values rounded across a threshold may differ
    expect(pctErr).toBeLessThan(1.5);
  });
});
