// Actions the assistant may PROPOSE. Nothing is applied until the user confirms.
import type { Preset } from "../model/buckling";

export type Action =
  | { type: "explore"; label: string; ind?: string; view?: "now" | "trend" | "future"; scen?: string; per?: string; seg?: string; cell?: string }
  | { type: "detective"; label: string; lat?: number; lon?: number; place?: string; example?: string; topic?: string; param?: string; ind?: string; season?: string; from?: number; to?: number }
  | { type: "trip"; label: string; route: string; date?: string; thr?: number }
  | { type: "lab"; label: string; seg?: string; preset?: Preset; tn?: number; tnRange?: [number, number]; fp?: number }
  | { type: "network"; label: string; scen?: string; per?: string };

export function actionPath(a: Action): string {
  const q = new URLSearchParams();
  const put = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  };
  switch (a.type) {
    case "explore":
      put("ind", a.ind);
      put("view", a.view);
      put("scen", a.scen);
      put("per", a.per);
      put("seg", a.seg);
      put("cell", a.cell);
      return `/explore?${q}`;
    case "detective":
      if (a.example) put("example", a.example);
      else {
        put("lat", a.lat);
        put("lon", a.lon);
        put("place", a.place);
      }
      put("topic", a.topic);
      put("param", a.param);
      put("ind", a.ind);
      put("season", a.season);
      put("from", a.from);
      put("to", a.to);
      return `/detective?${q}`;
    case "trip":
      put("route", a.route);
      put("date", a.date);
      put("thr", a.thr);
      return `/trip?${q}`;
    case "lab":
      put("seg", a.seg);
      put("preset", a.preset);
      put("tn", a.tn);
      if (a.tnRange) {
        put("tnlo", a.tnRange[0]);
        put("tnhi", a.tnRange[1]);
      }
      put("fp", a.fp);
      return `/lab?${q}`;
    case "network":
      put("scen", a.scen);
      put("per", a.per);
      return `/network?${q}`;
  }
}
