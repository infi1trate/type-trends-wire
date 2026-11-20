// E2g · one-off pass (append-only; nothing deleted or rewritten):
//  1. The published Coinbase and Netlify stories get an appended correction to their facts and decks, each change dated by its captures
//     (last capture with the old value, first with the new one), never by the day it was confirmed.
//  2. The first census stories are published with template text (agents, and sale mode when it has eight members), their counts recorded
//     in census_counts first, then numbered and their crops kept, exactly as a build does.
// Usage: bun scripts/e2g-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { dbDeps, BUILD_DAYS, toRow, assignStoryNumbers, NUMBER_LOOKBACK_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates } = await import("../src/lib/stories/editor");
const { planStories } = await import("../src/lib/stories/score");
const { canonical } = await import("../src/lib/labels");
const deps = dbDeps(db as never, false);
const raw = await deps.load({ days: BUILD_DAYS, allRuns: false, realRunIds: [] });
const all = allCandidates(raw), ctx = all.ctx;
const existing = await deps.existing(new Date(Date.parse(raw.now) - (BUILD_DAYS + 30) * 864e5).toISOString());
const out: Record<string, unknown> = { now: raw.now };

// 1 · dated corrections
const TARGETS = ["brand:coinbase.com:2026-11-20", "brand:netlify.com:2026-11-20"];
const corrections = [];
for (const id of TARGETS) {
  const shown = existing.find(e => e.id === id), c = all.candidates.find(x => x.id === id);
  if (!shown || (shown.state ?? shown.status) !== "published" || !c) { corrections.push({ id, skipped: !shown ? "not stored" : !c ? "no candidate" : "not published" }); continue; }
  const payload = { deck: c.deck, facts: c.facts };
  const note = "Corrected: each change is dated by its captures (last capture with the old value, first with the new one), not by the day it was confirmed";
  if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: id, action: "correct", payload, note } as never); if (error) throw error; }
  corrections.push({ id, was: shown.deck, deck: c.deck, members: c.facts.filter(f => f.kind === "member").map(f => f.text) });
}
out["corrections"] = corrections;

// 2 · the first census stories
const census = all.candidates.filter(c => c.id.startsWith("census:"));
const tracked = new Set(raw.sites.map(s => s.domain));
const plan = planStories(census, existing, { tierOf: k => ctx.tiers.get(canonical(k)) ?? null, rankOf: d => ctx.rank.get(d) ?? null, tracked: d => tracked.has(d), covered: ctx.covered, shareOf: k => ctx.row(ctx.cur, canonical(k))?.current_share ?? null });
out["census"] = plan.map(p => ({ id: p.id, status: p.status, reason: p.reason, score: p.score, headline: p.headline, deck: p.deck, count: p.census?.count, base: p.census?.base, members: p.census?.members.map(m => `${m.name}: ${m.line}`), added: p.facts.filter(f => f.kind === "member").map(f => f.text) }));
if (!dry) {
  const pub = plan.filter(p => p.status === "published");
  if (pub.length) {
    await deps.recordCensus!(pub.map(p => ({ ...p.census!, story_id: p.id })));
    out["inserted"] = await deps.insert(pub.map(p => toRow(p, null)));
    out["numbered"] = await assignStoryNumbers(db as never, { sinceDays: NUMBER_LOOKBACK_DAYS });
    out["kept_crops"] = await deps.keepCrops!();
  }
}
console.log(JSON.stringify({ dry, ...out }, null, 1));
