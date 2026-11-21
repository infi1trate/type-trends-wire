// W1c · today's quiet-change verdicts under the "follows its homepage" rule and the outlet count. Read-only (anonymous SELECTs, no
// writes, no model calls). Usage: bun scripts/w1c-quiet-report.ts
const { loadInput, BUILD_DAYS } = await import("../src/lib/stories/build.server");
const { allCandidates } = await import("../src/lib/stories/editor");
const input = await loadInput({ days: BUILD_DAYS, allRuns: false, realRunIds: [] });
const r = allCandidates(input);
const own = r.candidates.filter(c => (r.follows ?? []).some(f => c.domains.length === 1 && c.domains[0] === f.domain && (c.type === "move" || c.type === "rebrand")));
console.log(JSON.stringify({
  verdicts: r.quiet, follows: r.follows?.map(f => ({ domain: f.domain, at: f.at, fact: f.fact.text, home: f.home })),
  ownStories: own.map(c => ({ id: c.id, headline: c.headline, facts: c.facts.map(f => f.text) })),
  quietCandidates: r.candidates.filter(c => c.id.startsWith("quiet:")).map(c => ({ id: c.id, headline: c.headline, deck: c.deck })),
  homeLoaded: input.quiet?.home?.length ?? null,
}, null, 1));
process.exit(0);
