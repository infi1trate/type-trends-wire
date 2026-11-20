// E2e · freeze the measurement-integrity verdicts for the golden fixtures, and the real capture sequences the rule tests read.
// Verdicts are judged against every stored live capture at the time this runs (a change is confirmed by later captures too).
// Usage: bun scripts/build-integrity-fixture.ts
import { writeFileSync } from "node:fs";
import golden from "../src/lib/stories/golden/__fixtures__/golden.json";
import day20 from "../src/lib/stories/golden/__fixtures__/day-2026-11-20.json";
const { supabaseAnon } = await import("../src/lib/mcp/supabase");
const { computeChecks, liveCaptures } = await import("../src/lib/integrity.server");
const db = supabaseAnon();
type E = { id: number; domain: string; type: string; before: unknown; after: unknown; detected_at: string; page_type?: string | null; viewport?: string | null; source?: string | null; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const events = [...new Map([...(golden as { events: E[] }).events, ...(day20 as { events: E[] }).events].map(e => [e.id, e])).values()];
const checks = await computeChecks(db, events);
writeFileSync("src/lib/stories/golden/__fixtures__/checks.json", JSON.stringify(Object.fromEntries([...checks].sort((a, b) => a[0] - b[0]))));
// The rule tests' sequences: desktop home captures, only the fields the tests read.
const DOMAINS = ["docusign.com", "miro.com", "vuoriclothing.com", "netlify.com", "on.com", "thelightphone.com", "dropbox.com"], FIELDS = ["h1", "body", "accent", "hero_media", "h1_align", "headline"];
const { data: sites } = await db.from("library_sites").select("domain,sector").in("domain", DOMAINS);
const caps = await liveCaptures(db, DOMAINS, new Set(), new Map((sites ?? []).map(s => [s.domain, s.sector])));
const out: Record<string, { captures: unknown[]; events: E[] }> = {};
for (const d of DOMAINS) {
  const c = (caps.get(`${d}|home|desktop`) ?? []).sort((a, b) => a.at.localeCompare(b.at)).map(x => ({ ...x, fields: Object.fromEntries(Object.entries(x.fields).filter(([k]) => FIELDS.includes(k))) }));
  out[d] = { captures: c, events: events.filter(e => e.domain === d) };
}
writeFileSync("src/lib/__fixtures__/integrity-captures.json", JSON.stringify(out, null, 0));
console.log({ checks: checks.size, verdicts: [...checks.values()].reduce<Record<string, number>>((m, c) => ((m[c.verdict] = (m[c.verdict] ?? 0) + 1), m), {}) });
