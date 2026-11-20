// Test fixtures for the front page model (imported only by tests and the QUIET screenshot script).
import type { StoryRecord } from "../stories/view";
import type { Signal } from "../signals";
import type { FrontInput } from "./front";

export const NOW = Date.parse("2026-11-16T14:00:00Z");
export const H = 36e5, D = 864e5;
export const iso = (t: number) => new Date(t).toISOString();
export const st = (id: string, o: Partial<StoryRecord & { number: number | null }> = {}): StoryRecord & { number: number | null } => ({
  id, type: "move", status: "published", state: "published", reason: "", score: 60, components: {}, why_ran: "", kicker: "Move", headline: `Headline ${id}`, deck: `Deck ${id}`, facts: [],
  why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: [], evidence: [], source_ids: [], basis: "measured",
  happened_at: iso(NOW - H), created_at: iso(NOW - H), stored: { status: "published", type: "move", kicker: "Move", headline: id, deck: null, why_line: null, facts: [] },
  pinnedUntil: null, correctedAt: null, killReason: null, edits: [], number: null, ...o,
});
export const sig = (key: string, o: Partial<Signal> = {}): Signal => ({ key, name: key, dimension: "LAYOUT", basis: "measured", tier: "headline", stage: "Rising", share: 0.2, momentum: 0.5, direction: "Rising", momentum_index: 50, ...o } as unknown as Signal);
export const input = (o: Partial<FrontInput> = {}): FrontInput => ({
  now: NOW, sector: "all", format: "all", stories: [], signals: [sig("a:one"), sig("b:two", { direction: "Falling", momentum_index: 10 })], lens: null, stages: new Map(),
  moving: { items: [], pair: null, next: { earliest: "2026-11-21", expected: "2026-11-22" } }, freshness: { text: "Wire checked 2 minutes ago", late: false },
  leadEvidence: null, series: {}, chart: { composites: [], headline: [], series: [] },
  editions: { morning: null, digest: null, sectors: null }, archiveMoves: [], patternKeys: new Set(), brandNames: new Map(), ...o,
});
/** A quiet Sunday-night front: nothing in the last day, a few stories earlier in the week, one from the same week a year ago. */
export const quietInput = () => input({
  now: NOW,
  stories: [
    st("ws:media", { type: "white_space", kicker: "White space", sector: "media", score: 76, happened_at: iso(NOW - 2 * D - 3 * H), number: 46, basis: "ai" }),
    st("move:1", { score: 49, happened_at: iso(NOW - 3 * D), number: 41, domains: ["neon.com"] }),
    st("news:1", { type: "news", kicker: "News · Dezeen", sector: null, score: 30, happened_at: iso(NOW - 4 * D), number: 40, basis: null }),
    st("old:2025", { score: 70, happened_at: "2025-11-18T09:00:00Z", number: 3 }),
  ],
  archiveMoves: [{ id: "rb:1", at: "2025-11-19T00:00:00Z", headline: "stripe.com rebranded", line: "New wordmark.", href: "/brands/stripe.com", source: "archive" }],
});
