// Rule-based assistant: works with no API key. Same proposals format as the SI assistant.
import type { Action } from "./actions";
import { findRoute, findSpanishCell, norm } from "./knowledge";
import { IND } from "../config";
import type { Preset } from "../model/buckling";

function topicIndicator(t: string): { ind: string; param: string; dInd: string } {
  if (/(frost|helad|cold|frio|freez|hielo|ice )/.test(t)) return { ind: "FROST", param: "T2M_MIN", dInd: "lt:0" };
  if (/(night|noche|tropical)/.test(t)) return { ind: "TN20", param: "T2M_MIN", dInd: "ge:20" };
  if (/(rain|lluv|precip|storm|tormenta|flood|inund)/.test(t)) return { ind: "R20", param: "PRECTOTCORR", dInd: "ge:20" };
  if (/(drought|sequia|dry|seco)/.test(t)) return { ind: "HOT35", param: "PRECTOTCORR", dInd: "drymax" };
  if (/(snow|nieve)/.test(t)) return { ind: "FROST", param: "SNODP", dInd: "gt:1" };
  if (/(wind|viento)/.test(t)) return { ind: "HOT40", param: "WS2M", dInd: "mean" };
  if (/(sun|sol|radiation|radiacion)/.test(t)) return { ind: "RAIL_AM", param: "ALLSKY_SFC_SW_DWN", dInd: "mean" };
  if (/(humid)/.test(t)) return { ind: "TN20", param: "RH2M", dInd: "mean" };
  if (/(rail temp|carril|buckl|pandeo|sun kink)/.test(t)) return { ind: "RAIL_AM", param: "T2M_MAX", dInd: "max" };
  if (/42/.test(t)) return { ind: "HOT42", param: "T2M_MAX", dInd: "ge:35" };
  if (/38/.test(t)) return { ind: "HOT38", param: "T2M_MAX", dInd: "ge:35" };
  if (/35/.test(t)) return { ind: "HOT35", param: "T2M_MAX", dInd: "ge:35" };
  return { ind: "HOT40", param: "T2M_MAX", dInd: "ge:35" };
}

export async function rulesAsk(question: string): Promise<{ text: string; actions: Action[] }> {
  const t = norm(question);
  const topic = topicIndicator(t);
  const view = /(2050|2100|future|futuro|scenario|escenario|will|sera)/.test(t) ? "future" : /(trend|tendencia|change|cambi|increas|aument|rising|sube|hotter|colder|warmer|getting|more |less |fewer|warming|calient|calent|enfri|since|desde)/.test(t) ? "trend" : "now";
  const actions: Action[] = [];
  const route = await findRoute(question);
  if (route && /(trip|viaje|trayecto|route|ruta|train|tren|travel|viajo| to | a )/.test(t)) {
    const dm = t.match(/(\d{1,2})[/ -](\d{1,2})/);
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const es = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    let date: string | undefined;
    const mm = months.findIndex((m, i) => t.includes(m) || t.includes(es[i]));
    const day = t.match(/\b(\d{1,2})\b/);
    if (mm >= 0) date = `${String(mm + 1).padStart(2, "0")}-${String(day ? Math.min(28, Number(day[1])) : 15).padStart(2, "0")}`;
    else if (dm) date = `${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    actions.push({ type: "trip", label: `Show the trip ${route.name}${date ? ` on ${date}` : ""}`, route: route.route_id, date });
  }
  if (/(track|via|carril|buckl|pandeo|neutral|ballast|balasto|aguanta|hold)/.test(t)) {
    actions.push({ type: "lab", label: "Try it in the track lab", seg: undefined, preset: describeTrackRules(question).preset });
  }
  const cell = await findSpanishCell(question);
  if (cell) actions.push({ type: "explore", label: `${IND[topic.ind].label} near ${cell.place} (${view})`, ind: topic.ind, view, cell: cell.cell });
  else if (/(spain|espana|network|red|railway|ferrocarril|trains|trenes)/.test(t)) actions.push({ type: "explore", label: `${IND[topic.ind].label} across Spain's railway (${view})`, ind: topic.ind, view });
  if (/(2050|future|futuro)/.test(t) && /(network|red|railway|ferrocarril|spain|espana)/.test(t)) actions.push({ type: "network", label: "The network in 2041–2060", per: "2041-2060" });
  if (!actions.length) actions.push({ type: "explore", label: `${IND[topic.ind].label} across Spain's railway`, ind: topic.ind, view });
  const text =
    "Rule-based suggestion (no SI key configured): I matched the place names and topic words in your question against the closed catalog of NASA variables, routes and places. " +
    "Choose an option below — nothing changes until you confirm.";
  return { text, actions: actions.slice(0, 4) };
}

export function describeTrackRules(text: string): { preset: Preset; tn?: number; tnRange?: [number, number]; why: string[] } {
  const t = norm(text);
  const why: string[] = [];
  let preset: Preset = "unknown";
  if (/(tamp|batead|bateo|recien|recent work|maintenance|mantenimiento|renew|renovad|poor ballast|missing ballast|falta.*balasto|balasto pobre|weak)/.test(t)) {
    preset = "weak";
    why.push("recent maintenance or poor ballast lowers lateral resistance (FRA) → Weak / recently tamped");
  } else if (/(well maintained|bien mantenid|consolidat|strong|fuerte|high[- ]speed|alta velocidad|concrete|hormigon)/.test(t)) {
    preset = "strong";
    why.push("consolidated ballast / modern high-speed track → Strong");
  } else if (/(wood|madera|conventional|convencional|average|normal|media)/.test(t)) {
    preset = "average";
    why.push("typical conventional track → Average");
  }
  const range = t.match(/(\d{1,2}(?:[.,]\d)?)\s*(?:-|–|to|a|y|and)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:°|º|c|grados|degrees)?/);
  const single = t.match(/(?:neutral|neutra|nt)[^0-9]{0,25}(\d{1,2}(?:[.,]\d)?)/);
  if (single) {
    const v = Number(single[1].replace(",", "."));
    if (v >= 0 && v <= 45) {
      why.push(`neutral temperature ${v} °C taken from your text`);
      return { preset, tn: v, why };
    }
  }
  if (range && /(neutral|neutra)/.test(t)) {
    const a = Number(range[1].replace(",", "."));
    const b = Number(range[2].replace(",", "."));
    if (a < b && b <= 45) {
      why.push(`neutral temperature range ${a}–${b} °C taken from your text`);
      return { preset, tnRange: [a, b], why };
    }
  }
  if (!why.length) why.push("no clear clues — using the full FRA distributions (I don't know)");
  return { preset, why };
}
