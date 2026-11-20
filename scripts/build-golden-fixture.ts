// Freeze the golden set's input (Phase E2a): the live events, snapshot texts (headline, sub-headline, button labels), signals, alerts,
// outside news, headline calls and library sample of 11–20 Nov 2026, as the story engine's BuildInput, into
// src/lib/stories/golden/__fixtures__/golden.json. No secrets and no page text beyond the stored lexicon fields. Re-run only to refresh the fixture.
// Usage: bun scripts/build-golden-fixture.ts
import { writeFileSync } from "node:fs";
const { loadInput } = await import("../src/lib/stories/build.server");
export const GOLDEN_NOW = Date.parse("2026-11-20T13:00:00Z"), GOLDEN_START = "2026-11-11T00:00:00Z";
const days = (GOLDEN_NOW - Date.parse(GOLDEN_START)) / 864e5;
const input = await loadInput({ days, allRuns: false, realRunIds: [], now: GOLDEN_NOW });
const cut = new Date(GOLDEN_NOW).toISOString();
const round = (v: unknown) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v);
const events = input.events.filter(e => e.detected_at <= cut), history = (input.history ?? []).filter(e => e.detected_at <= cut);
const ids = new Set(events.flatMap(e => [e.snapshot_id, e.prev_snapshot_id]).filter((x): x is number => typeof x === "number"));
const fixture = {
  ...input,
  events: events.map(({ summary: _s, ...e }) => e),
  // History only when it reaches further back than the window (the live tape starts on 11 Nov, so today it does not).
  ...(history.length > events.length ? { history: history.map(({ summary: _s, ...e }) => e) } : { history: undefined }),
  rebrands: [],
  runs: input.runs.map(r => ({ ...r, rows: r.rows.map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Array.isArray(v) ? v.map(round) : round(v)]))) })),
  wire: input.wire.map(w => ({ ...w, excerpt: w.excerpt ? w.excerpt.slice(0, 280) : null })),
  texts: Object.fromEntries(Object.entries(input.texts ?? {}).filter(([k]) => ids.has(Number(k)))),
  calls: Object.fromEntries(Object.entries(input.calls ?? {}).filter(([k]) => events.some(e => e.id === Number(k))).map(([k, v]) => [k, { call: v.call, reason: v.reason }])),
};
writeFileSync(new URL("../src/lib/stories/golden/__fixtures__/golden.json", import.meta.url), JSON.stringify(fixture));
console.log(JSON.stringify({ now: fixture.now, events: fixture.events.length, history: fixture.history?.length ?? 0, runs: fixture.runs.map(r => r.id), alerts: fixture.alerts.length, wire: fixture.wire.length, sites: fixture.sites.length, archive: fixture.archive.length, texts: Object.keys(fixture.texts).length, calls: Object.keys(fixture.calls).length }));
