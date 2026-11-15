import { fmt, signed } from "../config";

export interface SentenceInput {
  label: string;
  unit: string;
  decimals?: number;
  firstYear: number;
  senPerDecade: number;
  ciLowDec: number;
  ciHighDec: number;
  p: number;
  sigRaw: boolean;
  sigFdr?: boolean | null;
  nTests?: number | null;
  rare?: boolean;
  yearsNeeded?: number | null;
  early?: { label: string; value: number | null } | null;
  late?: { label: string; value: number | null } | null;
}

/** Plain-language summary built only from computed numbers (never hand-written values). */
export function trendSentence(s: SentenceInput): string {
  const d = s.decimals ?? 1;
  if (s.rare) return `${s.label} happen in fewer than half of the years here, so a reliable trend cannot be measured — that itself tells you the event is rare at this place.`;
  const parts: string[] = [];
  const flat = Math.abs(s.senPerDecade) < 10 ** -(d + 1);
  if (flat) parts.push(`${s.label} show no measurable change since ${s.firstYear} (Sen's slope ≈ 0).`);
  else
    parts.push(
      `${s.label} ${s.senPerDecade > 0 ? "rose" : "fell"} by ${signed(s.senPerDecade, d)} ${s.unit} per decade since ${s.firstYear} (95% CI ${signed(s.ciLowDec, d)} to ${signed(s.ciHighDec, d)}).`,
    );
  if (s.early && s.late && s.early.value !== null && s.late.value !== null)
    parts.push(`The average went from ${fmt(s.early.value, d)} in ${s.early.label} to ${fmt(s.late.value, d)} in ${s.late.label}.`);
  if (s.sigFdr && s.nTests) parts.push(`This is very unlikely to be chance — it stays significant even after correcting for testing ${s.nTests} places at once.`);
  else if (s.sigRaw && s.sigFdr === false && s.nTests)
    parts.push(`It passes a single test (p = ${fmt(s.p, 3)}) but not the correction for testing ${s.nTests} places at once, so treat it with caution.`);
  else if (s.sigRaw) parts.push(`It is statistically significant (p = ${fmt(s.p, 3)}).`);
  else {
    parts.push(`It is not statistically significant yet (p = ${fmt(s.p, 2)}).`);
    if (s.yearsNeeded !== null && s.yearsNeeded !== undefined && !flat)
      parts.push(
        s.yearsNeeded > 150
          ? "Even many more decades of data might not reveal it: the change is small compared with the year-to-year noise."
          : `If it continued at this rate, roughly ${Math.max(1, s.yearsNeeded)} more years of data would be needed to detect it (approximate).`,
      );
  }
  return parts.join(" ");
}
