// E2f · one-off pass over the stories published in the last 14 days (append-only story_edits; nothing deleted or restored).
//  - No. 80 (seasonal): members only where a confirmed change carries the sale wording itself; fewer than three → retired.
//  - The carousel flag now applies to the page (older captures inherit it): gathered stories drop brands whose only passing change is a
//    rotation; every other published story built from brand changes is listed when one of its changes is now a rotation.
// Usage: bun scripts/e2f-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { applyEdits } = await import("../src/lib/stories/edits");
const { dbDeps, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates, confirmedInput, AGAINST_MIN, SEASONAL_STORY_MIN } = await import("../src/lib/stories/editor");
const { carouselEventIds, withoutRotation } = await import("../src/lib/carousel");
const { promoWording, seasonalEventIds } = await import("../src/lib/promo");

const SEASONAL_NOTE = "Retired: fewer than three brands have a confirmed switch to sale wording";
const cols = "id,type,status,reason,score,components,why_ran,kicker,headline,deck,facts,why_line,why_model,why_at,sector,signal_keys,domains,evidence,source_ids,basis,happened_at,created_at";
const since = new Date(Date.now() - 14 * 864e5).toISOString();
const st = await db.from("stories").select(cols).gte("created_at", since).order("created_at");
if (st.error) throw st.error;
const ids = st.data!.map(s => s.id);
const [ed, nums] = await Promise.all([db.from("story_edits").select("id,story_id,action,payload,note,at").in("story_id", ids).order("id"), db.from("story_numbers").select("story_id,number").in("story_id", ids)]);
if (ed.error || nums.error) throw ed.error ?? nums.error;
const number = new Map((nums.data ?? []).map(n => [n.story_id as string, n.number as number]));
const raw = await dbDeps(db as never, false).load({ days: 2 * BUILD_DAYS, allRuns: false, realRunIds: [] });
const { input } = confirmedInput(raw);
const byId = new Map(input.events.map(e => [e.id, e]));
const rotating = carouselEventIds(input.events, new Set(input.carousel ?? []));
const seasonal = seasonalEventIds(input.events, new Map(Object.entries(input.texts ?? {}).map(([k, v]) => [Number(k), v])));
const eid = (x: string) => { const m = /^(?:event|story:move|story:counter|story:seasonal):(\d+)/.exec(x); return m ? Number(m[1]) : null; };
const kill = async (id: string, note: string) => { if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: id, action: "kill", payload: { reason: note }, note } as never); if (error) throw error; } };
const out: unknown[] = [];
for (const s of st.data!) {
  const n = number.get(s.id), shown = applyEdits(s as never, (ed.data ?? []).filter(e => e.story_id === s.id) as never, Date.now());
  if (n == null || shown.state !== "published") continue;
  const evIds = [...new Set(shown.source_ids.map(eid).filter((x): x is number => x != null))];
  if (s.id.startsWith("seasonal:")) {
    // A member's confirmed change (not a rotation) carries the promotion in its new headline.
    const members = evIds.map(id => byId.get(id)).filter(e => !!e && seasonal.has(e.id)).map(e => (rotating.has(e!.id) ? withoutRotation(e!) : e)).filter(e => !!e && promoWording(e) !== null);
    const domains = [...new Set(members.map(e => e!.domain))];
    if (domains.length < SEASONAL_STORY_MIN) { await kill(s.id, SEASONAL_NOTE); out.push({ n, retired: SEASONAL_NOTE, was: shown.headline, qualifying: domains }); }
    else out.push({ n, unchanged: shown.headline, qualifying: domains });
    continue;
  }
  if (s.id.startsWith("against:")) {
    const keepIds = new Set(evIds.filter(id => byId.has(id) && !(rotating.has(id) && withoutRotation(byId.get(id)!) === null)));
    const keepDomains = new Set([...keepIds].map(id => byId.get(id)!.domain)), dropped = shown.domains.filter(d => !keepDomains.has(d));
    if (!dropped.length) { out.push({ n, unchanged: shown.headline }); continue; }
    const all = allCandidates({ ...raw, events: raw.events.filter(e => keepDomains.has(e.domain)), now: s.created_at as string });
    const c = all.candidates.find(x => x.id.startsWith("against:"));
    if (!c || c.domains.length < AGAINST_MIN) { const note = "Retired: fewer than three brands remain once carousel rotations are left out"; await kill(s.id, note); out.push({ n, retired: note, dropped }); continue; }
    const payload = { headline: c.headline, deck: c.deck, facts: c.facts, domains: c.domains, source_ids: c.sourceIds.filter(x => shown.source_ids.includes(x)), evidence: c.evidence };
    const note = `Corrected: dropped ${dropped.length === 1 ? "one brand" : `${dropped.length} brands`} whose only passing change is a carousel rotation`;
    if (!dry) { const { error } = await db.from("story_edits").insert({ story_id: s.id, action: "correct", payload, note } as never); if (error) throw error; }
    out.push({ n, corrected: c.headline, deck: c.deck, kept: c.domains, dropped, added: c.domains.filter(d => !shown.domains.includes(d)) });
    continue;
  }
  const touched = evIds.filter(id => rotating.has(id));
  if (touched.length) out.push({ n, touched_by_carousel: touched.map(id => `${id} ${byId.get(id)?.domain} ${byId.get(id)?.type}`), headline: shown.headline });
}
console.log(JSON.stringify({ dry, rotating: rotating.size, out }, null, 1));
