// SI assistant (Claude via the official SDK). It only selects options from the closed catalog and reads numbers
// computed by the engine through tools; it never produces numbers of its own. Every result is labelled "SI-assisted".
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Action } from "./actions";
import { cellNumbers, cellPlaces } from "./knowledge";
import { IND, MAP_INDICATORS } from "../config";
import { loadJson } from "../data/load";
import type { Route } from "../data/types";

export const MODEL = "claude-opus-5-5";

export interface AiConfig {
  apiKey: string | null;
  proxyUrl: string | null;
}

function client(cfg: AiConfig) {
  if (cfg.proxyUrl) return new Anthropic({ apiKey: "via-proxy", baseURL: cfg.proxyUrl, dangerouslyAllowBrowser: true });
  return new Anthropic({ apiKey: cfg.apiKey ?? "", dangerouslyAllowBrowser: true });
}

const SYSTEM = `You are the guide inside a NASA Space Apps 2026 "Trend Detective" web tool for high-school and college students.
The tool detects climate trends in NASA data (NASA POWER / MERRA-2 since 1981; NASA NEX-GDDP-CMIP6 projections), with Spain's railway network as the flagship case (heat days, frost days, estimated rail temperature, an FRA-based buckling safety margin).
Rules:
- Use the tools. Only propose options that exist in the closed catalog (list_catalog) and places returned by find_place. Call propose_action for each option (at most 3). The user confirms before anything changes.
- Never invent numbers. Quote numbers only if they come from get_numbers, and say they come from the tool's analysis of NASA data.
- No safety claims about real railway lines: the tool measures climate hazard and model margins under user assumptions.
- Reply in the user's language, in at most 3 short sentences, then stop.`;

export async function siAsk(cfg: AiConfig, question: string, onStatus?: (s: string) => void): Promise<{ text: string; actions: Action[] }> {
  const actions: Action[] = [];
  const routes = await loadJson<Route[]>("routes.json");
  const tools = [
    betaZodTool({
      name: "list_catalog",
      description: "List the closed catalog: map indicators for Spain's railway, train routes, track presets.",
      inputSchema: z.object({ kind: z.enum(["map_indicators", "routes", "track_presets"]) }),
      run: async ({ kind }) => {
        onStatus?.(`reading catalog: ${kind}`);
        if (kind === "map_indicators") return JSON.stringify(MAP_INDICATORS.map((k) => ({ id: k, label: IND[k].label, unit: IND[k].unit })));
        if (kind === "routes") return JSON.stringify(routes.map((r) => ({ route_id: r.route_id, name: r.name })));
        return JSON.stringify([
          { id: "strong", note: "consolidated ballast, modern high-speed track" },
          { id: "average", note: "typical track" },
          { id: "weak", note: "recently tamped or poor ballast" },
          { id: "unknown", note: "use FRA distributions" },
        ]);
      },
    }),
    betaZodTool({
      name: "find_place",
      description: "Find a place on Spain's railway by town name (returns cell ids).",
      inputSchema: z.object({ name: z.string() }),
      run: async ({ name }) => {
        onStatus?.(`looking up ${name}`);
        const cps = await cellPlaces();
        const n = name.toLowerCase();
        const spanish = cps.filter((c) => c.place.toLowerCase() === n).sort((a, b) => b.km - a.km).slice(0, 2);
        return JSON.stringify({ spanish_cells: spanish });
      },
    }),
    betaZodTool({
      name: "get_numbers",
      description: "Numbers computed by the engine for one Spanish cell and map indicator (means, Sen trend per decade with CI, p-value, FDR significance, future ensemble).",
      inputSchema: z.object({ cell_id: z.string(), indicator: z.enum(MAP_INDICATORS as [string, ...string[]]) }),
      run: async ({ cell_id, indicator }) => JSON.stringify((await cellNumbers(cell_id, indicator)) ?? { error: "unknown cell or indicator" }),
    }),
    betaZodTool({
      name: "propose_action",
      description: "Propose one option for the user to confirm. target: explore (Spain map), trip (route), lab (track lab), network (2050 view).",
      inputSchema: z.object({
        target: z.enum(["explore", "trip", "lab", "network"]),
        label: z.string().describe("short button text in the user's language"),
        indicator: z.string().optional(),
        view: z.enum(["now", "trend", "future"]).optional(),
        scenario: z.enum(["ssp245", "ssp585"]).optional(),
        period: z.enum(["2041-2060", "2081-2100"]).optional(),
        cell_id: z.string().optional(),
        route_id: z.string().optional(),
        date_mm_dd: z.string().optional(),
        preset: z.enum(["strong", "average", "weak", "unknown"]).optional(),
        neutral_temp_c: z.number().min(0).max(45).optional(),
      }),
      run: async (a) => {
        if (actions.length >= 3) return "limit reached";
        if (a.target === "explore") {
          if (a.indicator && !MAP_INDICATORS.includes(a.indicator)) return "unknown indicator — use list_catalog";
          actions.push({ type: "explore", label: a.label, ind: a.indicator, view: a.view, scen: a.scenario, per: a.period, cell: a.cell_id });
        } else if (a.target === "trip") {
          if (!routes.some((r) => r.route_id === a.route_id)) return "unknown route — use list_catalog";
          actions.push({ type: "trip", label: a.label, route: a.route_id!, date: a.date_mm_dd });
        } else if (a.target === "lab") actions.push({ type: "lab", label: a.label, preset: a.preset, tn: a.neutral_temp_c });
        else actions.push({ type: "network", label: a.label, scen: a.scenario, per: a.period });
        return "proposed";
      },
    }),
  ];
  const runner = client(cfg).beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 4000,
    max_iterations: 8,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools,
    messages: [{ role: "user", content: question }],
  });
  let text = "";
  for await (const message of runner) {
    if (message.stop_reason === "refusal") return { text: "The model declined this request.", actions };
    for (const b of message.content) if (b.type === "text" && b.text.trim()) text = b.text;
  }
  return { text, actions };
}

/** Explanation for students that may only use the numbers passed in. */
export async function siExplain(cfg: AiConfig, facts: Record<string, unknown>): Promise<string> {
  const res = await client(cfg).beta.messages.create({
    model: MODEL,
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: "Explain a climate-trend result to a high-school student in 4-6 short sentences. Use ONLY the numbers in the JSON; do not add numbers, sources or safety claims. Explain what the trend, the confidence interval and the significance mean in plain words, and one physical reason it could happen.",
    messages: [{ role: "user", content: JSON.stringify(facts) }],
  });
  if (res.stop_reason === "refusal") return "The model declined this request.";
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Plain-language briefing of the computed heat/cold watch (numbers only from the engine). */
export async function siBrief(cfg: AiConfig, facts: Record<string, unknown>): Promise<string> {
  const res = await client(cfg).beta.messages.create({
    model: MODEL,
    max_tokens: 1200,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system:
      "You write a short briefing (3 sentences, max 70 words) for the public about a rail heat/cold WATCH computed by a screening model from NASA climate data and a weather forecast. Use ONLY the numbers and places in the JSON. Say where and when the watch is strongest and what it means in plain words. Keep real watches/warnings (rail near or beyond the limit of recently repaired track, or frost) separate from \"unusually warm/cold for the season\", which carries no rail risk — never present the latter as a danger. Never call a line dangerous or predict incidents; it is a screening estimate. No headings, no bullet points.",
    messages: [{ role: "user", content: JSON.stringify(facts) }],
  });
  if (res.stop_reason === "refusal") return "The model declined this request.";
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export async function siDescribeTrack(cfg: AiConfig, text: string): Promise<{ preset: "strong" | "average" | "weak" | "unknown"; tn?: number; why: string[] }> {
  let out: { preset: "strong" | "average" | "weak" | "unknown"; tn?: number; why: string[] } = { preset: "unknown", why: [] };
  const tool = betaZodTool({
    name: "set_track_params",
    description: "Translate the user's description of a track into model inputs. Only use facts stated by the user.",
    inputSchema: z.object({
      preset: z.enum(["strong", "average", "weak", "unknown"]).describe("strong = consolidated ballast/modern track; weak = recently tamped or poor ballast; unknown if unclear"),
      neutral_temp_c: z.number().min(0).max(45).optional().describe("only if the user states it"),
      reasons: z.array(z.string()).describe("one short reason per choice, in the user's language"),
    }),
    run: async (a) => {
      out = { preset: a.preset, tn: a.neutral_temp_c, why: a.reasons };
      return "ok";
    },
  });
  const runner = client(cfg).beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 2000,
    max_iterations: 3,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: "You map a railway track description to the FRA-based buckling model presets by calling set_track_params once. Then reply with one short sentence.",
    tools: [tool],
    messages: [{ role: "user", content: text }],
  });
  for await (const m of runner) if (m.stop_reason === "refusal") break;
  return out;
}

export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The API key was rejected.";
  if (error instanceof Anthropic.RateLimitError) return "Rate limited — try again in a moment.";
  if (error instanceof Anthropic.APIConnectionError) return "Could not reach the API (network or proxy problem).";
  if (error instanceof Anthropic.APIError) return `API error ${error.status ?? ""}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
