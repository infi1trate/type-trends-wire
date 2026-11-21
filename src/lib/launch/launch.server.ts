// Loads the facts behind /status/launch from what is already stored, with the shared anonymous SELECT-only client,
// and draws two share images in memory to prove the drawer works. Writes nothing. Cached 60 s per runtime.
import { healthFactsResult } from "../health-facts.server";
import { supabaseAnon } from "../mcp/supabase";
import { healthFactsSchema } from "../health";
import { healthPayload } from "../health.server";
import { memo } from "../memo";
import { CONTACT_EMAIL, BRAND_PUBLIC, DATA_STORIES_PUBLIC, LANDING_PUBLIC } from "../site";
import { GATE_ENABLED, OPEN_PATHS } from "../gate";
import { CRAWL_WINDOW_MS, launchChecks, switches, type Check, type Switch } from "./launch";

export type LaunchPayload = { checked_at: string; switches: Switch[]; checks: Check[] };
const cached = memo(60_000, () => build());
export const loadLaunch = (): Promise<LaunchPayload> => cached();

async function drawn(): Promise<{ kind: string; ok: boolean; bytes: number }[]> {
  const { shareImage } = await import("../share/share.server");
  const one = async (kind: "front" | "morning", id: string) => {
    try { const r = await shareImage(kind, id, "png"); const b = r.ok ? (await r.arrayBuffer()).byteLength : 0; return { kind: kind === "front" ? "front page" : "Morning Line", ok: r.ok && b > 1000, bytes: b }; }
    catch { return { kind, ok: false, bytes: 0 }; }
  };
  return Promise.all([one("front", "today"), one("morning", "today")]);
}

async function build(): Promise<LaunchPayload> {
  const db = supabaseAnon(), now = Date.now(), since = new Date(now - CRAWL_WINDOW_MS).toISOString();
  const [hf, lib, crops, phOk, health, images] = await Promise.all([
    healthFactsResult().then(r => (r.error ? null : healthFactsSchema.safeParse(r.data).data ?? null), () => null),
    db.from("library_snapshots").select("received_at").eq("source", "live").order("received_at", { ascending: false, nullsFirst: false }).limit(1).then(r => (r.data ?? [])[0]?.received_at ?? null, () => null),
    db.from("site_crops").select("domain", { count: "exact", head: true }).then(r => (r.error ? null : r.count ?? 0), () => null),
    db.from("ingest_runs").select("started_at").eq("job", "ingest-producthunt").order("started_at", { ascending: false, nullsFirst: false }).limit(1).then(r => (r.data ?? [])[0]?.started_at ?? null, () => null),
    healthPayload().catch(() => null),
    drawn().catch(() => null),
  ]);
  const runs = hf?.crawl_runs ?? [], fin = runs.filter(r => r.finished_at).map(r => r.finished_at as string).sort();
  const ph = hf?.ingest["ingest-producthunt"] ?? {}, fc = health?.jobs.find(j => j.job === "forecast");
  const checks = launchChecks({
    now, crawlAt: fin.at(-1) ?? null, crawlRuns7d: fin.filter(t => t >= since).length, libraryAt: lib, cropsStored: crops,
    productHunt: { lastRunAt: ph.last_run_at ?? phOk, lastOk: ph.last_ok ?? (phOk ? true : null), okAt: ph.last_ok_at ?? phOk },
    contactEmail: CONTACT_EMAIL, forecast: fc ? { lastOkAt: fc.last_ok_at, stale: fc.stale } : { lastOkAt: null, stale: null }, shareImages: images,
  });
  return { checked_at: new Date(now).toISOString(), switches: switches({ gateEnabled: GATE_ENABLED, openPaths: OPEN_PATHS, landing: LANDING_PUBLIC, brand: BRAND_PUBLIC, dataStories: DATA_STORIES_PUBLIC }), checks };
}
