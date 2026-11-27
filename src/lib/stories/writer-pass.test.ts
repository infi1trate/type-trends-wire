import { describe, expect, it, beforeEach } from "vitest";
import * as wp from "./writer-pass";
import { requestStanding } from "./rewrite";
import { factDates, namesBrand, rewriteFactFailures } from "./voice-guide";
import { resetWriterPassCache, runWriterPassWith, type WriterPassDeps } from "./writer-pass.server";

const T0 = Date.parse("2026-11-27T02:03:00Z");
const print = { edits: 1, asks: 4, texts: 9, stories: "x", day: "2026-11-27" };
function fake(o: { queue?: { id: string }[]; loadMs?: number; left?: number; guards?: Partial<Awaited<ReturnType<WriterPassDeps["guards"]>>> } = {}) {
  let clock = T0 + 500;
  const seen = { queue: 0, jobs: 0, write: 0, start: 0, notes: [] as string[], perBuild: [] as number[], minCall: [] as number[] };
  const deps: WriterPassDeps = {
    print: async () => print,
    left: async () => o.left ?? 9,
    queue: async () => { seen.queue++; return (o.queue ?? []) as never; },
    guards: async () => ({ held: false, safeMode: false, buildRunning: false, passRunning: false, lastNoRoomAgoMs: null, ...o.guards }),
    jobs: async s => { seen.jobs++; clock += o.loadMs ?? 5000; return { jobs: s.map(story => ({ story, facts: {} as never, template: {} as never })), known: { names: [] } }; },
    write: async (_j, _k, x) => { seen.write++; seen.perBuild.push(x.perBuild); seen.minCall.push(x.minCallMs); return { written: 1, checked: 1, calls: 1, skipped: 0, rows: [] }; },
    start: async () => { seen.start++; return { finish: async (_ok, note) => { seen.notes.push(note); } }; },
  };
  return { deps, seen, now: () => clock };
}
beforeEach(() => resetWriterPassCache());

describe("writer pass · timing", () => {
  it("calls stop 4 s before the host's 30 s, and one call needs 8 s", () => {
    expect(wp.writeEnd(T0) - T0).toBe(26_000);
    expect(wp.CALL_MS).toBe(8_000);
    expect(wp.passCalls(7_999)).toBe(0);
    expect(wp.passCalls(8_000)).toBe(1);
    expect(wp.passCalls(26_000 - 500 - 12_000)).toBe(1);   // a 12 s load still leaves a call
    expect(wp.passCalls(16_000)).toBe(2);
    expect(wp.passCalls(200_000)).toBe(3);
  });
});
describe("writer pass · stand-down", () => {
  const ok = { held: false, safeMode: false, buildRunning: false, passRunning: false };
  it("each condition stands it down", () => {
    expect(wp.passStandDown(ok)).toBeNull();
    expect(wp.passStandDown({ ...ok, held: true })).toMatch(/held/);
    expect(wp.passStandDown({ ...ok, safeMode: true })).toBe("safe mode");
    expect(wp.passStandDown({ ...ok, buildRunning: true })).toMatch(/story build/);
    expect(wp.passStandDown({ ...ok, passRunning: true })).toMatch(/another writer pass/);
    expect(wp.passStandDown({ ...ok, lastNoRoomAgoMs: 10 * 60_000 })).toBe(wp.BACKING_OFF);
    expect(wp.passStandDown({ ...ok, lastNoRoomAgoMs: 31 * 60_000 })).toBeNull();
  });
  it("takes the first story of the queue only", () => { expect(wp.firstOfQueue(["a", "b"])).toBe("a"); expect(wp.firstOfQueue([])).toBeNull(); });
});
describe("writer pass · run", () => {
  it("empty queue: no model call, no heavy load, no run row; the second pass does not even read the queue", async () => {
    const f = fake();
    expect((await runWriterPassWith(f.deps, T0, f.now)).ran).toBe(false);
    await runWriterPassWith(f.deps, T0, f.now);
    expect(f.seen).toMatchObject({ queue: 1, jobs: 0, write: 0, start: 0 });
  });
  it("one story; a 12 s load leaves room for one call, and the writer is told the pass's own call room", async () => {
    const f = fake({ queue: [{ id: "a" }, { id: "b" }], loadMs: 12_000 });
    const r = await runWriterPassWith(f.deps, T0, f.now);
    expect(r.story).toBe("a"); expect(f.seen.perBuild).toEqual([1]); expect(f.seen.minCall).toEqual([wp.CALL_MS]);
    expect(f.seen.notes).toEqual(["writer pass · 1 written (checked), 1 call"]);
  });
  it("a slow load leaves no room: no call, noted as no time", async () => {
    const f = fake({ queue: [{ id: "a" }], loadMs: 18_000 });
    await runWriterPassWith(f.deps, T0, f.now);
    expect(f.seen.write).toBe(0); expect(f.seen.notes[0]).toContain(wp.NO_ROOM); expect(wp.backsOff(f.seen.notes[0])).toBe(true);
  });
  it("held: a skipped row, no load", async () => {
    const f = fake({ queue: [{ id: "a" }], guards: { held: true } });
    await runWriterPassWith(f.deps, T0, f.now);
    expect(f.seen.jobs).toBe(0); expect(f.seen.notes[0]).toBe("writer pass · skipped: held: job_hold on stories");
  });
});
describe("rewrite check · dates on the fact sheet", () => {
  const prev = { headline: "Entry animations gain", deck: "5 of 30 fintech homepages.", body: [], how_we_know: "Measured." };
  const next = { headline: "Entry animations gain", deck: "5 of 30 fintech homepages.", body: [], how_we_know: "Measured from captures on 22 Nov." };
  it("a date on the facts is allowed; one that is not is refused", () => {
    expect(rewriteFactFailures(prev, next, [])).toContain("rewrite changes a date: 22 Nov");
    expect(rewriteFactFailures(prev, next, [], { changes: [{ at: "2026-11-22" }] })).toEqual([]);
    expect(rewriteFactFailures(prev, next, [], { how: "captures on 22 November" })).toEqual([]);
    expect(rewriteFactFailures(prev, next, [], { changes: [{ at: "2026-11-21" }] })).toContain("rewrite changes a date: 22 Nov");
  });
  it("numbers and brands stay strict even when on the facts", () => {
    const n = { ...next, how_we_know: "Measured.", deck: "6 of 30 fintech homepages, Adyen among them." };
    expect(rewriteFactFailures(prev, n, ["Adyen"], { numbers: ["6 of 30"], brands: ["Adyen"] })).toEqual(["rewrite changes a number: 6", "rewrite adds a brand: Adyen"]);
  });
  it("factDates reads both forms", () => expect([...factDates("2026-11-22 and 3 Dec")].sort()).toEqual(["22 Nov", "3 Dec"]));
});
describe("rewrite requests · two failures", () => {
  const at = "2026-11-25T01:15:00Z", now = Date.parse("2026-11-27T02:00:00Z");
  it("first until two tries since the request failed their check", () => {
    expect(requestStanding(at, [], now)).toEqual({ first: true, today: true });
    expect(requestStanding(at, [{ created_at: "2026-11-27T01:50:00Z", checked: false }], now).first).toBe(true);
    expect(requestStanding(at, [{ created_at: "2026-11-22T01:50:00Z", checked: false }, { created_at: "2026-11-22T02:50:00Z", checked: false }], now).first).toBe(true);
  });
  it("after two failures it waits behind the queue, tried at most once a UTC day", () => {
    const two = [{ created_at: "2026-11-26T01:50:00Z", checked: false }, { created_at: "2026-11-26T09:00:00Z", checked: false }];
    expect(requestStanding(at, two, now)).toEqual({ first: false, today: true });
    expect(requestStanding(at, [...two, { created_at: "2026-11-27T00:30:00Z", checked: false }], now)).toEqual({ first: false, today: false });
  });
});

describe("writer pass · it never repeats a heavy load for nothing", () => {
  it("no allowance left: no queue read, no load, no run row", async () => {
    const f = fake({ queue: [{ id: "a" }], left: 0 });
    const r = await runWriterPassWith(f.deps, T0, f.now);
    expect(r).toMatchObject({ ran: false, note: "allowance used" });
    expect(f.seen).toMatchObject({ queue: 0, jobs: 0, write: 0, start: 0 });
  });
  it("an allowance that cannot be read counts as none", () => {
    expect(wp.callsLeft(null, 12)).toBe(0); expect(wp.callsLeft(NaN, 12)).toBe(0); expect(wp.callsLeft(12, 12)).toBe(0); expect(wp.callsLeft(15, 12)).toBe(0); expect(wp.callsLeft(3, 12)).toBe(9);
  });
  it("every note of a pass that loaded and wrote nothing backs the next passes off; a written one does not", () => {
    for (const n of [wp.passNote({ skipped: wp.NO_ROOM }), wp.passNote({ skipped: "no fact sheet" }), wp.passNote({ skipped: "the writer skipped it (allowance or time)" }), wp.passNote({ skipped: "no call made" })]) expect(wp.backsOff(n)).toBe(true);
    expect(wp.backsOff(wp.passNote({ written: 1, checked: 1, calls: 1 }))).toBe(false);
    expect(wp.backsOff(wp.passNote({ skipped: "a story build is running" }))).toBe(false);
    expect(wp.backsOff(wp.passNote({ skipped: wp.BACKING_OFF }))).toBe(false);
    expect(wp.backsOff(null)).toBe(false);
  });
  it("while backing off: no load and no run row", async () => {
    const f = fake({ queue: [{ id: "a" }], guards: { lastNoRoomAgoMs: 5 * 60_000 } });
    const r = await runWriterPassWith(f.deps, T0, f.now);
    expect(r.ran).toBe(false); expect(r.note).toContain(wp.BACKING_OFF);
    expect(f.seen).toMatchObject({ jobs: 0, write: 0, start: 0 });
  });
});

describe("rewrite check · a sentence that opens with On is not the brand On", () => {
  const t = (deck: string, body: string[] = []) => ({ headline: "More homepages animate their entrances", deck, body, how_we_know: "Measured." });
  it("the word at a sentence start does not name the brand; the brand inside a sentence does", () => {
    expect(namesBrand("On", "On all three homepages, the animation is part of the entrance.")).toBe(false);
    expect(namesBrand("On", "It moves. On all three it is part of the entrance.")).toBe(false);
    expect(namesBrand("On", "A headline\nOn the page it reads well.")).toBe(false);
    expect(namesBrand("On", "The running brand On changed its hero.")).toBe(true);
    expect(namesBrand("On", "Vercel, On and Netlify all do it.")).toBe(true);
    expect(namesBrand("On", "Only one does.")).toBe(false);
    expect(namesBrand("Vercel", "Vercel changed its hero.")).toBe(true);   // an ordinary brand counts wherever it stands
  });
  it("the 27 Nov refusals no longer happen; a real added or dropped brand is still refused", () => {
    const prev = t("Entry animations appeared on 33 of 299 homepages, including Vercel.", ["On all three homepages, the animation is part of the entrance."]);
    expect(rewriteFactFailures(prev, t("33 of 299 homepages, Vercel among them, animate as they open.", ["It is part of the entrance."]), ["On", "Vercel"])).toEqual([]);
    expect(rewriteFactFailures(t("Vercel animates.", []), t("Vercel animates.", ["On most pages it is subtle."]), ["On", "Vercel"])).toEqual([]);
    expect(rewriteFactFailures(prev, t("33 of 299 homepages animate as they open.", []), ["On", "Vercel"])).toEqual(["rewrite drops a brand: Vercel"]);
    expect(rewriteFactFailures(prev, t("33 of 299 homepages, Vercel and the shoe brand On among them.", []), ["On", "Vercel"])).toEqual(["rewrite adds a brand: On"]);
  });
});
