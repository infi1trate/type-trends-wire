/** R2a-2 · onboarding rows for the crawler's state answers. Reads are limited to the onboarding domains, paged, six at a time. */
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { archiveEntry, liveEntry, type ArchiveSnap, type LiveSnap, type OnboardingSite } from "./onboarding-state";

export async function onboardingSites(): Promise<OnboardingSite[]> {
  const out: OnboardingSite[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("library_sites").select("domain,sector,pages").eq("onboarding", true).order("domain").range(from, from + 999);
    if (error) throw new Error("Onboarding read failed");
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}
async function pool<T, R>(items: readonly T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await f(items[k]!); } }));
  return out;
}
async function wayback(domain: string): Promise<ArchiveSnap[]> {
  const { data, error } = await db.from("library_snapshots").select("captured_at,quarter:signals->archive->>quarter").eq("domain", domain).eq("source", "wayback").eq("page_type", "home").eq("viewport", "desktop").order("captured_at").range(0, 399);
  if (error) throw new Error("Onboarding archive read failed");
  return (data ?? []) as unknown as ArchiveSnap[];
}
export async function onboardingLiveEntries() {
  const sites = await onboardingSites();
  return pool(sites, 6, async s => {
    const [{ data, error }, w] = await Promise.all([
      db.from("library_snapshots").select("page_type,viewport,html_hash,content_hash,signals_hash,captured_at").eq("domain", s.domain).eq("source", "live").order("captured_at", { ascending: false }).range(0, 99),
      wayback(s.domain),
    ]);
    if (error) throw new Error("Onboarding live read failed");
    return liveEntry(s, (data ?? []) as LiveSnap[], w);
  });
}
export async function onboardingArchiveEntries() {
  return pool(await onboardingSites(), 6, async s => archiveEntry(s, await wayback(s.domain)));
}
