/** R2a · loads readiness from stored rows and performs the one dated panel step. Pure rules live in panel.ts. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { onboarding, panelInvariantProblems, planPanelStep, quarterOf, readiness, PANEL_RECOMPUTE_TOPICS, type PanelSite, type PanelStepPlan } from "./panel";
type Admin = SupabaseClient<Database>;

/** A capture reads clearly when it carries measured type or colour and no blocked reason. */
export function wellRead(signals: unknown): boolean {
  const s = (signals ?? {}) as Record<string, unknown>;
  if (s["blocked"] || s["blocked_reason"]) return false;
  return !!(s["type"] || s["color"] || s["colors"] || s["palette"]);
}

type SiteRow = PanelSite & { category: string | null; subcategory: string | null };
/** Every library row, paged (PostgREST answers at most 1,000 rows a request). */
export async function loadSites(db: Admin): Promise<SiteRow[]> {
  const out: SiteRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_sites").select("domain,sector,active,onboarding,panel_since,category,subcategory").order("domain").range(from, from + 999);
    if (error) throw new Error("panel_sites_read_failed");
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

export type Waiting = { domain: string; sector: string; missing: string[] };
/** Readiness of every onboarding brand, one brand at a time with bounded, paged reads. */
export async function readinessReport(db: Admin, sites: readonly PanelSite[], now = new Date()): Promise<{ ready: Set<string>; waiting: Waiting[] }> {
  const ready = new Set<string>(), waiting: Waiting[] = [];
  for (const s of sites.filter(onboarding)) {
    const [snaps, gaps] = await Promise.all([
      db.from("library_snapshots").select("source,captured_at,signals").eq("domain", s.domain).eq("page_type", "home").eq("viewport", "desktop").order("captured_at").range(0, 999),
      db.from("library_archive_gaps").select("quarter").eq("domain", s.domain).range(0, 199),
    ]);
    if (snaps.error || gaps.error) throw new Error("panel_readiness_read_failed");
    const rows = (snaps.data ?? []) as { source: string; captured_at: string; signals: unknown }[];
    const live = rows.filter(r => r.source === "live");
    const archiveQuarters = new Set(rows.filter(r => r.source !== "live").map(r => {
      const q = ((r.signals as { archive?: { quarter?: unknown } } | null)?.archive?.quarter);
      return typeof q === "string" ? q : quarterOf(r.captured_at);
    }));
    const r = readiness({ liveHomeCaptures: live.map(x => x.captured_at), archiveQuarters, gapQuarters: new Set((gaps.data ?? []).map(g => g.quarter)), latestWellRead: !!live.at(-1) && wellRead(live.at(-1)!.signals) }, now);
    if (r.ready) ready.add(s.domain); else waiting.push({ domain: s.domain, sector: s.sector, missing: r.missing });
  }
  return { ready, waiting };
}
export async function readyDomains(db: Admin, sites: readonly PanelSite[], now = new Date()): Promise<Set<string>> {
  return (await readinessReport(db, sites, now)).ready;
}

export type DryStep = { dry: true; joining: string[]; by_sector: Record<string, number>; brands_before: number; brands_after: number; not_ready: Waiting[] };
/** The door's panel_step: every ready brand joins at once (one statement), the step is recorded and the full recompute is marked.
 *  { dry: true } answers who would join and who is not ready, and writes nothing. */
export async function runPanelStep(db: Admin, who: string, now = new Date(), opts: { dry?: boolean } = {}): Promise<{ step: PanelStepPlan } | { refused: string } | DryStep> {
  const sites = await loadSites(db);
  const { ready, waiting } = await readinessReport(db, sites, now);
  const plan = planPanelStep(sites, ready, now.toISOString());
  if (opts.dry) {
    const before = sites.filter(s => s.active === true && s.panel_since).length;
    return { dry: true, joining: plan?.domains ?? [], by_sector: plan?.by_sector ?? {}, brands_before: before, brands_after: plan?.brands_after ?? before, not_ready: waiting };
  }
  if (!plan || plan.domains.length < 1) return { refused: "No onboarding brand is ready to join the panel." };
  // One statement: active, not onboarding, dated. library_sites_mark_upd marks their history for recompute (active changed).
  const { error } = await db.from("library_sites").update({ active: true, onboarding: false, panel_since: plan.at }).in("domain", plan.domains).eq("onboarding", true).is("panel_since", null);
  if (error) throw new Error("panel_step_update_failed");
  const { error: e2 } = await db.from("panel_steps").insert({ at: plan.at, brands_before: plan.brands_before, brands_after: plan.brands_after, by_sector: plan.by_sector, who, domains: plan.domains });
  if (e2) throw new Error("panel_step_insert_failed");
  await db.from("work_marks").upsert(PANEL_RECOMPUTE_TOPICS.map(topic => ({ topic, marked_at: plan.at, done_at: null })));
  return { step: plan };
}

export type PanelFacts = { panel: number; onboarding: number; ready: number; unfiled: number; last_step: { at: string; brands_before: number; brands_after: number } | null; invariant: string[] };
export async function panelFacts(db: Admin): Promise<PanelFacts> {
  const { classificationProblem } = await import("./categories");
  const sites = await loadSites(db);
  const [ready, { data: steps }] = await Promise.all([readyDomains(db, sites), db.from("panel_steps").select("at,brands_before,brands_after").order("at", { ascending: false }).limit(1)]);
  const counted = sites.filter(s => s.active === true || s.onboarding === true);
  return {
    panel: sites.filter(s => s.active === true).length, onboarding: sites.filter(onboarding).length, ready: ready.size,
    unfiled: counted.filter(s => classificationProblem(s)).length, last_step: steps?.[0] ?? null, invariant: panelInvariantProblems(sites),
  };
}
