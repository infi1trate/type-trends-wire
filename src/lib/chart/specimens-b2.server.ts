// B2 · rows for the three proposed forms' specimens on /brand/system (anonymous SELECT-only, stored rows only; nothing is computed
// from raw history): Study No. 2's stored "who went first" figure and today's vanguard list (adoption wake); the stored lead-and-lag
// counts (lead and lag, and the held study "Do the leaders lead?"); the stored structure records of the newest quarter (page anatomy).
import { pagedRows } from "../paged";
import { supabaseAnon } from "../mcp/supabase";
import type { AdoptionFig } from "../data-stories/types";
import type { Section } from "../structure";
import { label } from "../labels";
import { rankLeads, type LeadRank } from "./specimens-b2";
import type { LeadRow } from "@/components/chartkit/leadlag-layout";

export type AnatomyPage = { domain: string; name: string; sector: string | null; category: string | null; sections: Section[] | null };
export type B2Specimens = {
  wake: { fig: AdoptionFig; vanguard: string[]; study: string } | null;
  lead: { signal: string; name: string; rows: LeadRow[] } | null; ranks: LeadRank[]; leadRows: Record<string, LeadRow[]>; vanguardSize: number;
  anatomy: { quarter: string | null; pages: AnatomyPage[] };
};
export async function loadB2Specimens(): Promise<B2Specimens> {
  const db = supabaseAnon();
  const [{ storedStudy }, { loadVanguard }] = await Promise.all([import("../newsroom/graphics.server"), import("../vanguard.server")]);
  const [study, vanguard, ll, sites] = await Promise.all([storedStudy("who-went-big-first").catch(() => ({ error: "x" })), loadVanguard(),
    db.from("library_lead_lag_series").select("signal,quarter,van_n,van_yes,rest_n,rest_yes,vanguard_size").order("signal").order("quarter").limit(5000),
    pagedRows((f, t) => db.from("library_sites").select("domain,name,sector,category,active").order("domain").range(f, t))]);
  if (ll.error) throw ll.error;
  if (sites.error) throw sites.error;
  const fig = "page" in study ? (Object.values(study.page.story.figures).find(f => f.kind === "adoption") as AdoptionFig | undefined) ?? null : null;
  const leadRows: Record<string, LeadRow[]> = {};
  for (const r of ll.data ?? []) (leadRows[r.signal] ??= []).push(r);
  const ranks = rankLeads(leadRows, k => label(k).name), top = ranks.find(r => r.kind === "ahead") ?? ranks[0] ?? null;
  // Page anatomy: the newest quarter's desktop records with a section reading.
  const q = await db.from("library_structure_records").select("quarter").eq("viewport", "desktop").eq("structure_read", true).order("quarter", { ascending: false }).limit(1);
  const quarter = (q.data?.[0]?.quarter as string | undefined) ?? null, recs: { domain: string; sections: Section[] | null }[] = [];
  if (quarter) for (let from = 0; from < 5000; from += 500) {
    const r = await db.from("library_structure_records").select("domain,sections:record->sections").eq("viewport", "desktop").eq("quarter", quarter).eq("structure_read", true).order("domain").range(from, from + 499);
    if (r.error) throw r.error;
    recs.push(...((r.data ?? []) as unknown as typeof recs));
    if ((r.data ?? []).length < 500) break;
  }
  const info = new Map((sites.data ?? []).filter(s => s.active !== false).map(s => [s.domain, s]));
  const pages = recs.flatMap(r => { const s = info.get(r.domain); return s && Array.isArray(r.sections) && r.sections.length ? [{ domain: r.domain, name: s.name ?? r.domain, sector: s.sector ?? null, category: s.category ?? null, sections: r.sections }] : []; });
  return { wake: fig ? { fig, vanguard, study: "who-went-big-first" } : null, lead: top ? { signal: top.signal, name: top.name, rows: leadRows[top.signal]! } : null, ranks, leadRows,
    vanguardSize: ll.data?.[0]?.vanguard_size ?? 0, anatomy: { quarter, pages } };
}
