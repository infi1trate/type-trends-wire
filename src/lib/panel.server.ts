/** R2a · loads readiness from stored rows and performs the one dated panel step. Pure rules live in panel.ts. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { archiveComplete, isReady, onboarding, planPanelStep, quarterOf, PANEL_RECOMPUTE_TOPICS, type PanelSite, type PanelStepPlan } from "./panel";
type Admin = SupabaseClient<Database>;

type Snap = { domain: string; source: string; captured_at: string; signals: unknown };
/** A capture reads clearly when it carries measured type or colour and no blocked reason. */
export function wellRead(signals: unknown): boolean {
  const s = (signals ?? {}) as Record<string, unknown>;
  if (s["blocked"] || s["blocked_reason"]) return false;
  return !!(s["type"] || s["colors"] || s["palette"]);
}

export async function loadSites(db: Admin): Promise<(PanelSite & { category: string | null; subcategory: string | null })[]> {
  const { data, error } = await db.from("library_sites").select("domain,sector,active,panel_since,category,subcategory").limit(5000);
  if (error) throw new Error("panel_sites_read_failed");
  return data ?? [];
}

/** Readiness for onboarding brands only (a handful at a time), so the read stays small at 1,000 brands. */
export async function readyDomains(db: Admin, sites: readonly PanelSite[], now = new Date()): Promise<Set<string>> {
  const waiting = sites.filter(onboarding).map(s => s.domain), ready = new Set<string>();
  for (let i = 0; i < waiting.length; i += 50) {
    const chunk = waiting.slice(i, i + 50);
    const { data, error } = await db.from("library_snapshots").select("domain,source,captured_at,signals").in("domain", chunk).eq("page_type", "home").eq("viewport", "desktop").order("captured_at").limit(5000);
    if (error) throw new Error("panel_snapshots_read_failed");
    const by = new Map<string, Snap[]>();
    for (const r of (data ?? []) as Snap[]) (by.get(r.domain) ?? by.set(r.domain, []).get(r.domain)!).push(r);
    for (const d of chunk) {
      const rows = by.get(d) ?? [], live = rows.filter(r => r.source === "live");
      // Archive quarters: read from an archived copy, or recorded by the crawler as not available (signals.not_available).
      const settled = new Set(rows.filter(r => r.source !== "live").map(r => quarterOf(r.captured_at)));
      const latest = live.at(-1);
      if (isReady({ domain: d, liveHomeCaptures: live.map(r => r.captured_at), archiveComplete: archiveComplete(settled, quarterOf(now.toISOString())), latestWellRead: !!latest && wellRead(latest.signals) })) ready.add(d);
    }
  }
  return ready;
}

/** The door's panel_step: every ready brand joins at once, the step is recorded and the full recompute is marked. */
export async function runPanelStep(db: Admin, who: string, now = new Date()): Promise<{ step: PanelStepPlan } | { refused: string }> {
  const sites = await loadSites(db);
  const plan = planPanelStep(sites, await readyDomains(db, sites, now), now.toISOString());
  if (!plan) return { refused: "No onboarding brand is ready to join the panel." };
  const { error } = await db.from("library_sites").update({ panel_since: plan.at }).in("domain", plan.domains).is("panel_since", null);
  if (error) throw new Error("panel_step_update_failed");
  const { error: e2 } = await db.from("panel_steps").insert({ at: plan.at, brands_before: plan.brands_before, brands_after: plan.brands_after, by_sector: plan.by_sector, who, domains: plan.domains });
  if (e2) throw new Error("panel_step_insert_failed");
  await db.from("work_marks").upsert(PANEL_RECOMPUTE_TOPICS.map(topic => ({ topic, marked_at: plan.at, done_at: null })));
  return { step: plan };
}

export type PanelFacts = { panel: number; onboarding: number; ready: number; unfiled: number; last_step: { at: string; brands_before: number; brands_after: number } | null };
export async function panelFacts(db: Admin): Promise<PanelFacts> {
  const { classificationProblem } = await import("./categories");
  const sites = await loadSites(db);
  const [ready, { data: steps }] = await Promise.all([readyDomains(db, sites), db.from("panel_steps").select("at,brands_before,brands_after").order("at", { ascending: false }).limit(1)]);
  const active = sites.filter(s => s.active !== false);
  return {
    panel: active.filter(s => s.panel_since).length, onboarding: active.filter(s => !s.panel_since).length, ready: ready.size,
    unfiled: active.filter(s => classificationProblem(s)).length, last_step: steps?.[0] ?? null,
  };
}
