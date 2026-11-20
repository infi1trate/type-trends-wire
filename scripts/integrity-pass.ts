// E2e · one-off integrity pass over the stories published in the last 14 days (append-only story_edits; nothing is deleted or restored).
//  - Retires the stories the owner named, with the owner's notes, and every other story built from brand changes whose changes all fail
//    the integrity check (notes in RETIRE, written after a dry run named the failing condition).
//  - Gathered stories (seasonal, against the grain) keep only members whose change passes; with at least three left they get a correction
//    (headline, deck, facts, members) re-made by the engine from the passing members only, and the writer owes them a new version.
// Library-share stories (white space, breakout) and news are not built from brand changes and stay. Idempotent.
// Usage: bun scripts/integrity-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { applyEdits } = await import("../src/lib/stories/edits");
const { dbDeps, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates, SEASONAL_STORY_MIN, AGAINST_MIN } = await import("../src/lib/stories/editor");

const RETIRE: Record<number, string> = {
  38: "Retired: the earlier headline was read from a different element in a single capture",
  33: "Retired: the page has no h1; the two captures read different elements",
  24: "Retired: the first screen rotates; the values alternate between captures",
  28: "Retired: the headline font alternates between captures",
  34: "Retired: the earlier state was seen in only one capture",
  7: "Retired: two before failed; the earlier font and colours were each seen in only one capture",
  12: "Retired: one transition failed; the palette, hero and headline alignment alternate between captures",
  83: "Retired: only two of four brands pass; Bun's and Cloudflare's earlier look was seen in only one capture (two before failed)",
};
const GATHERED = new Set([80, 87]);
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const since = new Date(Date.now() - 14 * 864e5).toISOString();
const st = await db.from("stories").select(cols).gte("created_at", since).order("created_at");
if (st.error) throw st.error;
const ids = st.data!.map(s => s.id);
const [ed, nums, ck] = await Promise.all([db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_numbers").select("story_id,number").in("story_id", ids), db.from("change_checks_latest").select("event_id,verdict")]);
if (ed.error || nums.error || ck.error) throw ed.error ?? nums.error ?? ck.error;
const number = new Map((nums.data ?? []).map(n => [n.story_id as string, n.number as number]));
const pass = new Set((ck.data ?? []).filter(c => c.verdict === "pass").map(c => c.event_id as number));
const eid = (x: string) => { const m = /^(?:event|story:move|story:counter|story:seasonal):(\d+)/.exec(x); return m ? Number(m[1]) : null; };
const raw = await dbDeps(db as never, false).load({ days: 2 * BUILD_DAYS, allRuns: false, realRunIds: [] });
const out: unknown[] = [];
for (const s of st.data!) {
  const n = number.get(s.id), shown = applyEdits(s as never, (ed.data ?? []).filter(e => e.story_id === s.id) as never, Date.now());
  if (n == null || shown.state !== "published") continue;
  if (RETIRE[n]) {
    if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: s.id, action: "kill", payload: { reason: RETIRE[n] }, note: RETIRE[n] } as never); if (error) throw error; }
    out.push({ n, retired: RETIRE[n], was: shown.headline }); continue;
  }
  if (!GATHERED.has(n)) continue;
  // The members whose change passes; the engine re-makes the piece from those changes alone, as of the stored build.
  const keepIds = new Set(shown.source_ids.map(eid).filter((x): x is number => x != null && pass.has(x)));
  const keepDomains = new Set(raw.events.filter(e => keepIds.has(e.id)).map(e => e.domain));
  const events = s.type === "roundup" && s.id.startsWith("seasonal:") ? raw.events.filter(e => keepIds.has(e.id)) : raw.events.filter(e => keepDomains.has(e.domain));
  const all = allCandidates({ ...raw, events, now: s.created_at as string });
  const kind = s.id.split(":")[0]!, c = all.candidates.find(x => x.id === s.id) ?? all.candidates.find(x => x.id.split(":")[0] === kind && x.id.split(":")[1] === s.id.split(":")[1]);
  const min = s.id.startsWith("seasonal:") ? SEASONAL_STORY_MIN : AGAINST_MIN;
  if (!c || c.domains.length < min) {
    const note = `Retired: fewer than ${min} brands pass; the rest were seen once or alternate between captures`;
    if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: s.id, action: "kill", payload: { reason: note }, note } as never); if (error) throw error; }
    out.push({ n, retired: note, was: shown.headline, kept: [...keepDomains] }); continue;
  }
  if (shown.headline === c.headline && [...shown.domains].sort().join() === [...c.domains].sort().join()) continue; // already corrected
  const dropped = shown.domains.filter(d => !c.domains.includes(d));
  const payload = { headline: c.headline, deck: c.deck, facts: c.facts, domains: c.domains, source_ids: c.sourceIds.filter(x => shown.source_ids.includes(x)), evidence: c.evidence };
  const note = `Corrected: kept the ${c.domains.length} brands whose change passes the integrity check; dropped ${dropped.length} seen once or alternating`;
  if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: s.id, action: "correct", payload, note } as never); if (error) throw error; }
  out.push({ n, corrected: payload.headline, deck: payload.deck, kept: c.domains, dropped, added: c.domains.filter(d => !shown.domains.includes(d)), facts: c.facts.map(f => f.text) });
}
console.log(JSON.stringify({ dry, out }, null, 1));
