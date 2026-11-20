// E3 · one-off pass (append-only; nothing deleted or rewritten). Refuses to append twice: it checks for its own note first.
// Recount the sale-mode census (No. 90) with the sale-wording rule (a discount, sale, deal(s), % off, an amount off, Black Friday,
// Cyber Monday, save; seasonal words alone do not count) over the same captures the published count read, and append a count row
// and a correction. The correction's member lines quote the captured text unchanged (a quoted "$1,300" stays "$1,300").
// Usage: bun scripts/e3-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { dbDeps, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates } = await import("../src/lib/stories/editor");
const { recountRowId } = await import("../src/lib/census");
const deps = dbDeps(db as never, false);
const ID = "census:sale:2026-W47";
const NOTE = "Corrected: sale mode counts only lines with sale wording (a discount, sale, deals, % off, an amount off, Black Friday, Cyber Monday, save); seasonal words alone do not count. Quotations now show the captured text unchanged";
const edits = (await db.from("story_edits").select("id,note,payload").eq("story_id", ID).order("id")).data ?? [];
if (edits.some(e => e.note === NOTE)) { console.log(JSON.stringify({ id: ID, result: "already appended" })); process.exit(0); }
const T = "2026-11-20T17:09:11.513Z"; // the captures Nos. 89 and 90 read (E2h)
const raw = await deps.load({ days: BUILD_DAYS, allRuns: false, realRunIds: [], now: Date.parse(T) });
const c = allCandidates({ ...raw, census: raw.census ? { ...raw.census, recount: true } : null }).candidates.find(x => x.id === ID);
const existing = await deps.existing(new Date(Date.parse(T) - (BUILD_DAYS + 30) * 864e5).toISOString());
const shown = existing.find(e => e.id === ID);
if (!c?.census || !shown || shown.state !== "published") { console.log(JSON.stringify({ id: ID, skipped: !c ? "no candidate" : "not published" })); process.exit(0); }
const lastDomains = edits.map(e => (e.payload as { domains?: unknown }).domains).filter((x): x is string[] => Array.isArray(x)).at(-1) ?? shown.domains;
const was = new Set(lastDomains), now = new Set(c.census.members.map(m => m.domain));
let result = "dry";
if (!dry) {
  const { error } = await db.from("census_counts").insert({ ...c.census, story_id: recountRowId(ID, new Date().toISOString()) } as never); if (error) throw error;
  const r = await db.from("story_edits").insert({ story_id: ID, action: "correct", payload: { headline: c.headline, deck: c.deck, facts: c.facts, domains: c.domains, evidence: c.evidence }, note: NOTE } as never);
  if (r.error) throw r.error; result = "appended";
}
console.log(JSON.stringify({ dry, id: ID, count: c.census.count, base: c.census.base, headline: c.headline, deck: c.deck, droppedOut: [...was].filter(d => !now.has(d)), cameIn: [...now].filter(d => !was.has(d)),
  lines: c.census.members.map(m => `${m.name}: ${m.line}`), quoted: c.facts.filter(f => f.text.includes("$")).map(f => f.text), result }, null, 1));
