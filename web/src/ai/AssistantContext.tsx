import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { actionPath, type Action } from "./actions";
import { rulesAsk, describeTrackRules } from "./rules";
import type { AiConfig } from "./claude";
import { cellNumbers } from "./knowledge";
import { IND, fmt, signed } from "../config";
import { Prov } from "../components/ui";
import type { Preset } from "../model/buckling";

// The Anthropic SDK is loaded only when the assistant is used. Requests go to our own /api/claude proxy, which
// holds the key server-side (Vercel function in production, Vite proxy in development).
const si = () => import("./claude");
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const PROXY = ((import.meta.env.VITE_AI_PROXY_URL as string | undefined) || new URL("./api/claude", window.location.href).href).replace(/\/$/, "");

type ExplainTarget = { kind: "cell"; cellId: string; indicator: string; segment?: string } | { kind: "facts"; title: string; facts: Record<string, unknown>; fallback: string };

interface Ctx {
  ask: (q: string) => void;
  explain: (t: ExplainTarget) => void;
  brief: (facts: Record<string, unknown>, fallback: string) => Promise<{ text: string; source: "si" | "rules" }>;
  describeTrack: (text: string) => Promise<{ preset: Preset; tn?: number; tnRange?: [number, number]; why: string[]; source: "si" | "rules" }>;
}
const AssistantCtx = createContext<Ctx | null>(null);
export const useAssistant = () => {
  const c = useContext(AssistantCtx);
  if (!c) throw new Error("AssistantProvider missing");
  return c;
};

export function AssistantProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const cfg: AiConfig = useMemo(() => ({ apiKey: null, proxyUrl: PROXY }), []);
  const down = useRef(false); // after a failure, use rules for the rest of the session
  const [panel, setPanel] = useState<null | { q: string; busy: boolean; status?: string; text?: string; actions?: Action[]; source?: "si" | "rules"; error?: string }>(null);
  const [explainState, setExplainState] = useState<null | { title: string; busy: boolean; text?: string; source?: "si" | "rules" }>(null);

  const ask = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setPanel({ q, busy: true });
      if (!down.current) {
        try {
          const r = await (await si()).siAsk(cfg, q, (s) => setPanel((p) => (p ? { ...p, status: s } : p)));
          const rr = r.actions.length ? null : await rulesAsk(q);
          return setPanel({ q, busy: false, text: r.text || rr?.text, actions: r.actions.length ? r.actions : rr?.actions, source: r.actions.length ? "si" : "rules" });
        } catch (e) {
          down.current = true;
          const rr = await rulesAsk(q);
          return setPanel({ q, busy: false, text: rr.text, actions: rr.actions, source: "rules", error: errText(e) });
        }
      }
      const rr = await rulesAsk(q);
      setPanel({ q, busy: false, text: rr.text, actions: rr.actions, source: "rules" });
    },
    [cfg],
  );

  const explain = useCallback(
    async (t: ExplainTarget) => {
      let title: string;
      let facts: Record<string, unknown>;
      let fallback: string;
      if (t.kind === "cell") {
        const n = await cellNumbers(t.cellId, t.indicator);
        const meta = IND[t.indicator];
        title = `${meta.label}${t.segment ? ` · ${t.segment}` : ""}`;
        facts = { indicator: meta.label, unit: meta.unit, definition: meta.def, railway_context: meta.rail, line: t.segment ?? null, data_source: "NASA POWER (MERRA-2), 1981-2025", ...n };
        fallback = n
          ? `${meta.def} Here it went from ${fmt(n.mean_1981_1990)} (1981–1990) to ${fmt(n.mean_2016_2025)} ${meta.unit} (2016–2025), a trend of ${signed(n.sen_per_decade, 2)} per decade. ${n.significant_after_fdr ? "It stays significant after the false-discovery correction, so chance is a very unlikely explanation." : "It is not significant after the false-discovery correction, so it could still be noise."} ${meta.rail}`
          : meta.def;
      } else {
        title = t.title;
        facts = t.facts;
        fallback = t.fallback;
      }
      setExplainState({ title, busy: true });
      if (!down.current) {
        try {
          const text = await (await si()).siExplain(cfg, facts);
          return setExplainState({ title, busy: false, text, source: "si" });
        } catch {
          down.current = true;
        }
      }
      setExplainState({ title, busy: false, text: fallback, source: "rules" });
    },
    [cfg],
  );

  const brief = useCallback(
    async (facts: Record<string, unknown>, fallback: string) => {
      if (!down.current) {
        try {
          return { text: await (await si()).siBrief(cfg, facts), source: "si" as const };
        } catch {
          down.current = true;
        }
      }
      return { text: fallback, source: "rules" as const };
    },
    [cfg],
  );

  const describeTrack = useCallback(
    async (text: string) => {
      if (!down.current) {
        try {
          const r = await (await si()).siDescribeTrack(cfg, text);
          return { ...r, source: "si" as const };
        } catch {
          down.current = true;
        }
      }
      return { ...describeTrackRules(text), source: "rules" as const };
    },
    [cfg],
  );

  return (
    <AssistantCtx.Provider value={{ ask, explain, brief, describeTrack }}>
      {children}
      {panel && (
        <>
          <div className="scrim" onClick={() => setPanel(null)} role="presentation" />
          <div className="modal" role="dialog" aria-label="Assistant">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow">ASK THE DETECTIVE</div>
                <h3 style={{ marginTop: 4 }}>“{panel.q}”</h3>
              </div>
              <button className="btn ghost" onClick={() => setPanel(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {panel.busy ? (
              <p className="muted" style={{ marginTop: 14 }}>
                Thinking… {panel.status ?? ""}
              </p>
            ) : (
              <>
                <div className="row" style={{ margin: "12px 0" }}>
                  <Prov kind={panel.source === "si" ? "ai" : "rules"} />
                </div>
                {panel.text && <p className="ink2" style={{ marginBottom: 14 }}>{panel.text}</p>}
                <div className="stack">
                  {(panel.actions ?? []).map((a, i) => (
                    <button key={i} className="btn" style={{ justifyContent: "space-between", width: "100%" }} onClick={() => (setPanel(null), navigate(actionPath(a)))}>
                      <span>{a.label}</span>
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 14 }}>
                  The assistant only picks options from a closed catalog of NASA variables, places and routes. Every number on screen is computed by our open pipeline, never by the assistant.
                </p>
              </>
            )}
          </div>
        </>
      )}
      {explainState && (
        <>
          <div className="scrim" onClick={() => setExplainState(null)} role="presentation" />
          <div className="modal" role="dialog" aria-label="Explanation">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3>{explainState.title}</h3>
              <button className="btn ghost" onClick={() => setExplainState(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            {explainState.busy ? (
              <p className="muted" style={{ marginTop: 12 }}>Writing a plain-language explanation…</p>
            ) : (
              <>
                <div className="row" style={{ margin: "12px 0" }}>
                  <Prov kind={explainState.source === "si" ? "ai" : "rules"} />
                </div>
                <p style={{ lineHeight: 1.6 }}>{explainState.text}</p>
              </>
            )}
          </div>
        </>
      )}
    </AssistantCtx.Provider>
  );
}

export function AskBar() {
  const { ask } = useAssistant();
  const [q, setQ] = useState("");
  return (
    <form
      className="ask"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        ask(q);
      }}
    >
      <Sparkles size={15} className="muted" aria-hidden />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask: “Is my train to Seville hot in July?”" aria-label="Ask a question" />
      <button type="submit">Ask</button>
    </form>
  );
}
