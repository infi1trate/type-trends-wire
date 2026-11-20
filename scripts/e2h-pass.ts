// E2h · one-off pass (append-only; nothing deleted or rewritten). Refuses to append twice: each step checks for its own note first.
//  1. Coinbase and Netlify: an automatic "one brand, one story" update (a build on code that dated changes by confirmation) folded the
//     same changes back in with confirmation dates, and its deck replaced the dated correction. Append the dated deck and facts again.
//  2. No. 87: its deck's range came from confirmation dates; re-date it from its members' captures (earliest last-old, latest first-new),
//     and re-date its "Measured:" lines the same way.
//  3. Recount both censuses with the steadier pair (newest capture and the latest capture at least six hours older) over the captures
//     the published counts read (as of the stories' own moment): append a count row and a correction to Nos. 89 and 90.
// Usage: bun scripts/e2h-pass.ts [--dry]
const dry = process.argv.includes("--dry");
const { supabaseAdmin: db } = await import("../src/integrations/supabase/client.server");
const { dbDeps, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates, confirmedInput } = await import("../src/lib/stories/editor");
const { rangeWords, tapeLine, undated, changeFrom, changeAt } = await import("../src/lib/tape");
const { recountRowId } = await import("../src/lib/census");
const { nameText } = await import("../src/lib/brand-names");
const deps = dbDeps(db as never, false);
const out: Record<string, unknown> = {};
const edits = (await db.from("story_edits").select("story_id,note").in("story_id", ["brand:coinbase.com:2026-11-20", "brand:netlify.com:2026-11-20", "against:2026-W47:measured", "census:agents:2026-W47", "census:sale:2026-W47"])).data ?? [];
const done = (id: string, note: string) => edits.some(e => e.story_id === id && e.note === note);
const append = async (story_id: string, payload: Record<string, unknown>, note: string) => {
  if (done(story_id, note)) return "already appended";
  if (dry) return "dry";
  const { error } = await db.from("story_edits").insert({ story_id, action: "correct", payload, note } as never); if (error) throw error; return "appended";
};

const raw = await deps.load({ days: BUILD_DAYS, allRuns: false, realRunIds: [] });
const all = allCandidates(raw), dated = confirmedInput(raw).input.events, byId = new Map(dated.map(e => [e.id, e]));
const existing = await deps.existing(new Date(Date.parse(raw.now) - (BUILD_DAYS + 30) * 864e5).toISOString());

// 1 · Coinbase and Netlify
const NOTE1 = "Corrected: each change is dated by its captures again; an automatic update had folded the same changes back in dated by the day they were confirmed";
out["brands"] = [];
for (const id of ["brand:coinbase.com:2026-11-20", "brand:netlify.com:2026-11-20"]) {
  const shown = existing.find(e => e.id === id), c = all.candidates.find(x => x.id === id);
  if (!shown || shown.state !== "published" || !c) { (out["brands"] as unknown[]).push({ id, skipped: !shown ? "not stored" : !c ? "no candidate" : "not published" }); continue; }
  const payload = { deck: c.deck, facts: c.facts, ...(c.headline !== shown.headline ? { headline: c.headline } : {}) };
  (out["brands"] as unknown[]).push({ id, was: shown.deck, deck: c.deck, headline: payload.headline ?? "(unchanged)", members: c.facts.filter(f => f.kind === "member").map(f => f.text), result: await append(id, payload, NOTE1) });
}

// 2 · No. 87
const AG = "against:2026-W47:measured", ag = existing.find(e => e.id === AG);
if (ag && ag.state === "published") {
  // The stored row keeps every member it ran with; the members now are the narrowed list of its latest correction.
  const narrowedTo = ((await db.from("story_edits").select("payload").eq("story_id", AG).eq("action", "correct").order("id")).data ?? []).map(r => (r.payload as { source_ids?: unknown }).source_ids).filter((x): x is string[] => Array.isArray(x)).at(-1) ?? ag.source_ids;
  const memberEvents = narrowedTo.flatMap(x => { const m = /^story:counter:(\d+):/.exec(x); const e = m ? byId.get(Number(m[1])) : undefined; return e ? [e] : []; });
  const missing = narrowedTo.filter(x => { const m = /^story:counter:(\d+):/.exec(x); return !m || !byId.get(Number(m[1]))?.seen; });
  const from = memberEvents.map(changeFrom).sort()[0]!, to = memberEvents.map(changeAt).sort().at(-1)!;
  const names = (ag.deck ?? "").replace(/, between .*$/, "");
  const deck = `${names}, ${rangeWords(from, to)}.`;
  const facts = (Array.isArray(ag.facts) ? ag.facts : []) as { text: string; href: string | null; kind?: string }[];
  const redated = facts.map(f => {
    if (f.kind !== "source" || !f.text.startsWith("Measured: ")) return f;
    const d = (f.href ?? "").replace(/^\/brands\//, "");
    const e = dated.find(x => x.domain === d && x.seen && undated(nameText(`Measured: ${tapeLine({ ...x, seen: undefined })}`)) === undated(f.text));
    return e ? { ...f, text: nameText(`Measured: ${tapeLine(e)}`) } : f;
  });
  out["no87"] = { was: ag.deck, deck, members: memberEvents.map(e => ({ id: e.id, domain: e.domain, seen: e.seen })), missing, facts: redated.filter(f => f.kind === "source").map(f => f.text),
    result: missing.length ? "skipped: a member has no dated check" : await append(AG, { deck, facts: redated }, "Corrected: the range runs from the last capture of an old value to the first capture of a new one across the members, not from the days the changes were confirmed") };
}

// 3 · census recount, over the captures the published counts read
const T = "2026-11-20T17:09:11.513Z";
const raw2 = await deps.load({ days: BUILD_DAYS, allRuns: false, realRunIds: [], now: Date.parse(T) });
const census = allCandidates({ ...raw2, census: raw2.census ? { ...raw2.census, recount: true } : null }).candidates.filter(c => c.id.startsWith("census:"));
const NOTE3 = "Corrected: recounted with a steadier pair, each brand's newest capture and its latest capture at least six hours older (not its two newest)";
out["census"] = [];
for (const c of census) {
  const shown = existing.find(e => e.id === c.id);
  if (!shown || shown.state !== "published" || !c.census) { (out["census"] as unknown[]).push({ id: c.id, skipped: "not published" }); continue; }
  const was = new Set(shown.domains), now = new Set(c.census.members.map(m => m.domain));
  const row = { ...c.census, story_id: recountRowId(c.id, new Date().toISOString()) };
  let result = "dry";
  if (done(c.id, NOTE3)) result = "already appended";
  else if (!dry) {
    const { error } = await db.from("census_counts").insert(row as never); if (error) throw error;
    result = await append(c.id, { headline: c.headline, deck: c.deck, facts: c.facts, domains: c.domains, evidence: c.evidence }, NOTE3);
  }
  (out["census"] as unknown[]).push({ id: c.id, count: c.census.count, base: c.census.base, headline: c.headline, deck: c.deck, cameIn: [...now].filter(d => !was.has(d)), droppedOut: [...was].filter(d => !now.has(d)),
    lines: c.census.members.map(m => `${m.name}: ${m.line}`), added: c.facts.filter(f => f.kind === "member").map(f => f.text), result });
}
console.log(JSON.stringify({ dry, ...out }, null, 1));
