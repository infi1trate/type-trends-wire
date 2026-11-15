// Pure Weekly Brief schema and citation validation.
import { z } from "zod";
import { HYPE_WORDS } from "./forecast-constants";
export const citationSchema = z.object({ kind: z.enum(["forecast", "event", "wire", "spread"]), id: z.string().min(1).max(120) });
export const sectionSchema = z.object({ title: z.string().min(1).max(40), body: z.string().min(1).max(700), citations: z.array(citationSchema).max(12) });
export const watchSchema = z.object({ id: z.string().min(1).max(120), call: z.string().min(1).max(160) });
export const briefSchema = z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/), headline: z.string().min(1).max(90), sections: z.array(sectionSchema).min(4).max(6), caveats: z.string().max(400), watch: watchSchema.optional(),
  // Digest copy (optional; the issue falls back to deterministic text when absent or rejected).
  standfirst: z.string().max(2000).optional(), why_it_matters: z.string().max(2000).optional() });
export type Brief = z.infer<typeof briefSchema>;
export const SECTION_TITLES = ["Rising", "Peaking", "Fading", "Next wave", "Notable redesigns", "Pricing/product"];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export function validateBrief(raw: unknown, allowed: Set<string>): { ok: true; brief: Brief; dropped: string[] } | { ok: false; reason: string } {
  const p = briefSchema.safeParse(raw); if (!p.success) return { ok: false, reason: p.error.issues.map(i => `${i.path.join(".")}: ${i.code}`).join("; ") };
  const dropped: string[] = [];
  const hype = (s: string) => HYPE_WORDS.some(w => s.toLowerCase().includes(w));
  if (hype(p.data.headline)) return { ok: false, reason: "hype_headline" };
  const sections = p.data.sections.filter(s => {
    const bad = words(s.body) > 80 || hype(s.body) || s.citations.some(c => !allowed.has(`${c.kind}:${c.id}`)) || (/\d/.test(s.body) && s.citations.length === 0);
    if (bad) dropped.push(s.title); return !bad;
  });
  if (sections.length < 4) return { ok: false, reason: `too_few_valid_sections:${dropped.join(",")}` };
  // The one call to watch must cite a forecast id from the evidence and stay hype-free; otherwise it is dropped (the card falls back to Next wave).
  const watch = p.data.watch && allowed.has(`forecast:${p.data.watch.id}`) && !hype(p.data.watch.call) ? p.data.watch : undefined;
  if (p.data.watch && !watch) dropped.push("watch");
  // Digest copy must be hype-free and must not state numbers (it carries no citations); otherwise it is dropped and the issue uses data-built text.
  const digestOk = (s: string | undefined, max: number) => !!s?.trim() && s.length <= max && !hype(s) && !/\d/.test(s);
  const standfirst = digestOk(p.data.standfirst, 240) ? p.data.standfirst!.trim() : undefined, why = digestOk(p.data.why_it_matters, 320) ? p.data.why_it_matters!.trim() : undefined;
  if (p.data.standfirst && !standfirst) dropped.push("standfirst");
  if (p.data.why_it_matters && !why) dropped.push("why_it_matters");
  return { ok: true, brief: { week: p.data.week, headline: p.data.headline, caveats: p.data.caveats, sections, ...(watch ? { watch } : {}), ...(standfirst ? { standfirst } : {}), ...(why ? { why_it_matters: why } : {}) }, dropped };
}
export function isoWeekKey(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((+t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7); return `${y}-W${String(w).padStart(2, "0")}`;
}
