// The audit as a report, pure: the one figure on the cover and the findings Ledger, each finding with its basis mark and receipt.
// Sentences are templates filled from the audit model's numbers; nothing is written by AI.
import type { Audit } from "./audit";
import type { Basis } from "../labels";
import { scopeText } from "../labels";

export type Finding = { key: string; text: string; basis: Basis; href: string; kind: "ahead" | "behind" | "open" | "shared" };
export const FINDINGS_PER_SITE = 3, OPEN_MAX = 5;
const pc = (x: number | null) => (x == null ? "" : ` (${Math.round(x * 100)}% of sites)`);

/** The cover figure: how many rising or emerging signals none of the audited sites use yet. */
export function reportFigure(a: Audit): { value: string; unit: string; caption: string } {
  const n = a.whitespace?.traits.length ?? 0;
  return { value: String(n), unit: n === 1 ? "open signal" : "open signals", caption: `Rising or emerging in ${scopeText(a.whitespace?.scope ?? a.sector)} and used by none of these ${a.domains.length} sites yet.` };
}
export function auditFindings(a: Audit): Finding[] {
  const out: Finding[] = [];
  for (const s of a.market?.sites ?? []) {
    for (const t of s.ahead.slice(0, FINDINGS_PER_SITE)) out.push({ key: `a:${s.domain}:${t.trait}`, kind: "ahead", basis: t.basis, href: t.explainer, text: `${s.domain} is ahead on ${t.name}: ${t.stage?.toLowerCase() ?? "moving"} in ${scopeText(s.scope)}${pc(t.share)}.` });
    for (const t of s.behind.slice(0, FINDINGS_PER_SITE)) out.push({ key: `b:${s.domain}:${t.trait}`, kind: "behind", basis: t.basis, href: t.explainer, text: `${s.domain} still uses ${t.name}, which is fading in ${scopeText(s.scope)}${pc(t.share)}.` });
  }
  for (const t of (a.whitespace?.traits ?? []).slice(0, OPEN_MAX)) out.push({ key: `o:${t.trait}`, kind: "open", basis: t.basis, href: t.explainer, text: `Open territory: ${t.name} is ${t.stage?.toLowerCase() ?? "moving"} and none of these sites use it${pc(t.share)}.` });
  for (const f of a.type?.shared ?? []) out.push({ key: `s:${f.family}`, kind: "shared", basis: "measured", href: "#a-type", text: `${f.domains.join(" and ")} share the face ${f.family}.` });
  return out;
}
