// W3d-c Part 2 · the first visit after a deploy that switches a study on: a reader is given the stored copy only (never a fresh build
// inside the reader's time limit); a stored "no such study" from another build is not an answer; until the sweep writes the copy the
// page says it is being prepared; and the sweep rebuilds that copy (and the Studies home) on its first pass.
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: new Map<string, { key: string; body: unknown; computed_at: string }>(), computed: 0, reader: true }));
vi.mock("../site", async orig => ({ ...(await orig<object>()), ICONS_SHOWN: true }));
vi.mock("../reader-context.server", () => ({ readerNow: () => db.reader }));
vi.mock("../build-stamp", () => ({ BUILD: "newbld1" }));
vi.mock("../records/store.server", () => ({
  readRecord: async (k: string) => db.rows.get(k) ?? null,
  readerRecord: async (k: string) => db.rows.get(k) ?? null,
  storedBy: (keyOf: (a: string) => string, compute: (a: string) => Promise<unknown>) => Object.assign(async (a: string) => db.rows.get(keyOf(a))?.body ?? compute(a), { compute, keyOf }),
}));
vi.mock("./data.server", () => ({ dataInput: async () => { db.computed++; throw new Error("a reader must never build a study"); }, capturesFor: async () => new Map(), capturesOf: async () => [] }));

import { loadDataStory, oldMissing } from "./page.server";
import { ICONS_SLUG } from "./registry";
import { copiesOfOldBuild } from "../records/records";
import { refreshRecords, resetStepEstimates, type RefreshDeps } from "../records/refresh.server";

const key = `data-story:${ICONS_SLUG}`, now = () => new Date().toISOString();
const live = { kind: "live", story: { v: 4, number: 8, text: { headline: "No App Store category is mostly one colour" } } };
beforeEach(() => { db.rows.clear(); db.computed = 0; db.reader = true; resetStepEstimates(); });

describe("the study's first visit (reader)", () => {
  it("a stored 'no such study' from the old build answers 'being prepared', never 'No such study', and builds nothing", async () => {
    db.rows.set(key, { key, body: { kind: "missing" }, computed_at: now() }); // written before W3d-c: no build stamp
    expect(await loadDataStory(ICONS_SLUG)).toEqual({ kind: "preparing", number: 8, question: "What colour do app icons sit on?" });
    db.rows.set(key, { key, body: { kind: "missing", build: "e183b22" }, computed_at: now() });
    expect((await loadDataStory(ICONS_SLUG)).kind).toBe("preparing");
    expect(db.computed).toBe(0);
  });
  it("no stored copy at all: 'being prepared', and still nothing built", async () => {
    expect((await loadDataStory(ICONS_SLUG)).kind).toBe("preparing");
    expect(db.computed).toBe(0);
  });
  it("answers the study as soon as the sweep has written it", async () => {
    db.rows.set(key, { key, body: { kind: "missing" }, computed_at: now() });
    expect((await loadDataStory(ICONS_SLUG)).kind).toBe("preparing");
    db.rows.set(key, { key, body: live, computed_at: now() });
    await new Promise(r => setTimeout(r, 0));
    // The test store has no memo; on the live host a "being prepared" answer re-reads the copy every PREPARING_RECHECK_MS (10 s).
    expect(await loadDataStory(ICONS_SLUG)).toEqual(live);
    expect(db.computed).toBe(0);
  });
  it("a 'no such study' written by this build is the answer (a hidden study whose check fails)", async () => {
    db.rows.set(key, { key, body: { kind: "missing", build: "newbld1" }, computed_at: now() });
    expect(await loadDataStory(ICONS_SLUG)).toEqual({ kind: "missing", build: "newbld1" });
    expect(oldMissing({ kind: "missing", build: "newbld1" })).toBe(false);
    expect(oldMissing({ kind: "missing" })).toBe(true);
  });
});

describe("the sweep's first pass after a deploy", () => {
  it("picks the stale 'no such study' copies and the Studies home of another build, and leaves live copies alone", () => {
    expect(copiesOfOldBuild([
      { key: "data-index", k: null, b: null },
      { key: `data-story:${ICONS_SLUG}`, k: "missing", b: null },
      { key: "data-story:colours-the-museum-does-not-hold", k: "missing", b: "newbld1" },
      { key: "data-story:who-went-big-first", k: "live", b: null },
    ], "newbld1")).toEqual(["data-index", `data-story:${ICONS_SLUG}`]);
    expect(copiesOfOldBuild([{ key: "data-index", k: null, b: "newbld1" }], "newbld1")).toEqual([]);
  });
  it("rebuilds an old-build copy first, though it was stored and checked minutes ago", async () => {
    const fresh = new Date(Date.now() - 60_000).toISOString(), calls: string[] = [];
    const shared = ["site-index", "signals", "rebrands", "moving-runs", "quarter-series", "front-tape", "front-cards", "front-leads", "front-first", "library"];
    const deps: Partial<RefreshDeps> = {
      metas: async () => [key, "data-index", "data-story:who-went-big-first", ...shared].map(k => ({ key: k, computed_at: fresh })),
      checks: async () => new Map([[key, fresh]]), signalsChanged: async () => null,
      write: async rows => rows.map(r => r.key), card: async () => ({}), shared: async k => { calls.push(k); return {}; },
      sites: async () => [], similar: async () => [], sector: async () => [],
      pageKeys: async () => ["data-index", key, "data-story:who-went-big-first"],
      page: async k => { calls.push(k); return {}; },
      oldBuild: async () => [key],
    };
    const r = await refreshRecords({ job: "wire", deadline: Date.now() + 5_000, deps });
    expect(calls[0]).toBe(key);
    expect(calls).not.toContain("data-story:who-went-big-first"); // a minute old and not from another build: not due
    expect(r.written).toContain(key);
  });
});
