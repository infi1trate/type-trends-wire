// I3 · I/O for re-read retirements (retire.ts rereadRetire is the rule): reads the shown stories' changes, their marked verdicts and
// brand names, and appends one kill per story left without support (append-only story_edits; a killed story gets no second edit).
import type { ExistingShown } from "./build.server";
import { rereadRetire, storyChangeIds } from "./retire";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
export async function retireRereadStories(admin: Admin, shown: Pick<ExistingShown, "id" | "type" | "state" | "status" | "source_ids" | "facts">[], o: { dry?: boolean } = {}): Promise<{ checked: number; retired: { id: string; note: string }[] }> {
  const live = shown.filter(s => (s.state ?? s.status) === "published");
  const ids = [...new Set(live.flatMap(s => storyChangeIds({ id: s.id, source_ids: s.source_ids ?? [] })))];
  if (!ids.length) return { checked: live.length, retired: [] };
  const { latestChecks } = await import("../integrity.server");
  const checks = await latestChecks(admin as never, ids);
  const doms = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from("library_events").select("id,domain").in("id", ids.slice(i, i + 200));
    if (error) throw new Error("reread_events_failed");
    for (const r of data ?? []) doms.set(r.id, r.domain);
  }
  const { data: sites, error } = await admin.from("library_sites").select("domain,name").in("domain", [...new Set(doms.values())]);
  if (error) throw new Error("reread_sites_failed");
  const names = new Map((sites ?? []).map(s => [s.domain, s.name ?? s.domain]));
  const retired: { id: string; note: string }[] = [];
  for (const s of live) {
    const members = ((Array.isArray(s.facts) ? s.facts : []) as { kind?: string; href?: string }[]).filter(f => f.kind === "member" && f.href?.startsWith("/brands/")).map(f => decodeURIComponent(f.href!.slice(8)));
    const note = rereadRetire({ id: s.id, type: s.type, source_ids: s.source_ids ?? [], members }, { verdict: id => checks.get(id)?.verdict ?? null, domainOf: id => doms.get(id) ?? null, nameOf: d => names.get(d) ?? d });
    if (note) retired.push({ id: s.id, note });
  }
  if (!o.dry && retired.length) {
    const { error: e } = await admin.from("story_edits").insert(retired.map(r => ({ story_id: r.id, action: "kill", payload: { reason: r.note }, note: r.note })) as never);
    if (e) throw new Error("reread_kill_failed");
  }
  return { checked: live.length, retired };
}
