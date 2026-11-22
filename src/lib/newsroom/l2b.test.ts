// L2b · the gate checks layout shift and largest paint (SPEED_TARGETS), with today's terminal numbers from the L2 gate (result 3).
import { describe, expect, it } from "vitest";
import { REVIEW_PAGES, REVIEW_WIDTHS, type Measures, type ReviewRow } from "./design-review";
import { gateVerdict, GATE_CHECKS, type GateInput } from "./build-gate";
import { LIVE_VALUES } from "../living/editions";
import { SPEED_TARGETS } from "../perf/speed";

let id = 0;
const ok: Measures = { height_px: 3000, first_byte_ms: 400, lcp_ms: 1200, cls: 0.01, overflow_x: false, small_targets: 2, low_contrast: 0, console_errors: 0, failed_requests: 0, changed_share: 0.001 };
function run(name: string, kind: ReviewRow["kind"], edit: (page: string, width: number) => Partial<Record<keyof Measures, number | undefined>> = () => ({})): ReviewRow[] {
  return REVIEW_PAGES.flatMap(p => REVIEW_WIDTHS.map(w => {
    const m = { ...ok, ...edit(p.id, w) } as Record<string, unknown>;
    for (const k of Object.keys(m)) if (m[k] === undefined) delete m[k];
    return { id: ++id, at: "2026-11-22T16:00:00Z", run: name, kind, page: p.id, path: p.path, width: w, against: kind === "after" ? "B" : null, measures: m as Measures, picture: `reviews/${name}/${p.id}-${w}.webp` };
  }));
}
const gate = (before: ReviewRow[], after: ReviewRow[]): GateInput => ({ item: { kind: "phase", expects: "layout", move: null }, tests: { passed: 1, failed: 0, skipped: 0 }, before: { run: "B", kind: "before", rows: before }, after: { run: "A", kind: "after", rows: after }, proposal: null, live: LIVE_VALUES });
const check = (g: GateInput, id: "layout_shift" | "largest_paint") => gateVerdict(g).checks.find(c => c.id === id)!;
// The page review's terminal numbers, before L2 and after (gate result 3).
const TERMINAL_CLS = { 1440: [0.04, 0.276], 768: [0.059, 0.784], 390: [0.262, 0.826] } as const;

describe("L2b · the gate checks layout shift and largest paint", () => {
  it("both checks are listed, after first byte", () => {
    const ids = GATE_CHECKS.map(c => c.id);
    expect(ids.indexOf("layout_shift")).toBe(ids.indexOf("first_byte") + 1);
    expect(ids.indexOf("largest_paint")).toBe(ids.indexOf("layout_shift") + 1);
    expect(SPEED_TARGETS.cls).toBe(0.05); expect(SPEED_TARGETS.lcpMs).toBe(2500);
  });
  it("today's terminal numbers fail: 1440 and 768 go over 0.05, 390 was over and got higher", () => {
    const before = run("B", "before", (p, w) => (p === "terminal" ? { cls: TERMINAL_CLS[w as 1440][0] } : {}));
    const after = run("A", "after", (p, w) => (p === "terminal" ? { cls: TERMINAL_CLS[w as 1440][1] } : {}));
    const c = check(gate(before, after), "layout_shift");
    expect(c.ok).toBe(false);
    expect(c.problems).toEqual(["The terminal at 1440 px: layout shift 0.04 → 0.276, over 0.05.", "The terminal at 768 px: layout shift 0.059 → 0.784, over 0.05.", "The terminal at 390 px: layout shift 0.262 → 0.826, over 0.05."]);
    expect(c.numbers["worst"]).toBe(0.826);
    expect(gateVerdict(gate(before, after)).pass).toBe(false);
  });
  it("a page already above the target before passes when it is not higher after", () => {
    const before = run("B", "before", (p, w) => (p === "terminal" && w === 390 ? { cls: 0.262 } : {}));
    const after = run("A", "after", (p, w) => (p === "terminal" && w === 390 ? { cls: 0.2 } : {}));
    const c = check(gate(before, after), "layout_shift");
    expect(c.ok).toBe(true);
    expect(c.numbers["allowed"]).toEqual(["The terminal at 390 px: 0.262 → 0.2"]);
  });
  it("within the target passes; just over fails", () => {
    expect(check(gate(run("B", "before"), run("A", "after", () => ({ cls: 0.05 }))), "layout_shift").ok).toBe(true);
    expect(check(gate(run("B", "before"), run("A", "after", (p, w) => (p === "front" && w === 1440 ? { cls: 0.051 } : {}))), "layout_shift").ok).toBe(false);
  });
  it("largest paint: over 2,500 ms fails, unless it was over before and is not slower", () => {
    const slow = check(gate(run("B", "before"), run("A", "after", (p, w) => (p === "story" && w === 390 ? { lcp_ms: 2600 } : {}))), "largest_paint");
    expect(slow.ok).toBe(false);
    expect(slow.problems).toEqual(["A story page at 390 px: largest paint 1200 ms → 2600 ms, over 2500 ms."]);
    const was = run("B", "before", (p, w) => (p === "story" && w === 390 ? { lcp_ms: 3000 } : {}));
    expect(check(gate(was, run("A", "after", (p, w) => (p === "story" && w === 390 ? { lcp_ms: 2900 } : {}))), "largest_paint").ok).toBe(true);
    expect(check(gate(was, run("A", "after", (p, w) => (p === "story" && w === 390 ? { lcp_ms: 3100 } : {}))), "largest_paint").ok).toBe(false);
  });
  it("a missing measure is not measured and fails neither check", () => {
    const after = run("A", "after", (p, w) => (p === "terminal" && w === 768 ? { cls: undefined, lcp_ms: undefined } : {}));
    const g = gate(run("B", "before"), after);
    for (const k of ["layout_shift", "largest_paint"] as const) {
      const c = check(g, k);
      expect(c.ok).toBe(true);
      expect(c.numbers["not_measured"]).toEqual(["The terminal at 768 px"]);
    }
  });
});

// L2b · `rewrite` through the door, and the writer honouring it first at its next allowance.
import { handleDesk, type DeskDeps } from "../stories/desk.server";
import { writePriority } from "../stories/writer";
import { openRewrites, requestedFirst } from "../stories/rewrite";
import { actionDef } from "./register";
import { AI_MODELS } from "../ai-models";
import type { LogRow } from "./log";

describe("L2b · rewrite requests", () => {
  const mk = (state = "published", refused?: string) => {
    const logs: LogRow[] = [], asks: unknown[] = [];
    const d: DeskDeps = { authorize: async () => true, allow: () => true, now: () => Date.parse("2026-11-22T17:00:00Z"),
      store: { log: async r => { logs.push(r); }, exists: async () => true, queue: async () => ({}), insertEdit: async () => { throw new Error("no edit"); },
        holdOf: async () => ({ state, pending: false, heldBy: null, standardsPassed: true }), capReached: async () => false,
        rewrite: async r => { asks.push(r); return refused ? { refused } : { id: 1 }; } } };
    return { d, logs, asks };
  };
  const post = (body: unknown) => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer k" }, body: JSON.stringify(body) });
  const n43 = "breakout:css:scroll_timeline:all:13";
  it("ships alone, about a story", () => { expect(actionDef("rewrite")).toMatchObject({ level: "ships alone", subject: "story" }); });
  it("standards, the copy desk and the editor in chief may ask, with a reason; it is logged with its actor", async () => {
    for (const actor of ["standards", "copy desk", "editor in chief"]) {
      const { d, logs, asks } = mk();
      expect((await handleDesk(post({ actor, action: "rewrite", id: n43, reason: "Calls a moving share flat" }), d)).status).toBe(201);
      expect(asks).toEqual([{ story_id: n43, actor, reason: "Calls a moving share flat" }]);
      expect(logs[0]).toMatchObject({ actor, action: "rewrite", decision: "done", subject_id: n43 });
    }
  });
  it("another desk is refused; a missing or short reason is refused", async () => {
    const news = mk();
    expect((await handleDesk(post({ actor: "news", action: "rewrite", id: n43, reason: "Calls a moving share flat" }), news.d)).status).toBe(403);
    expect(news.asks).toEqual([]);
    const { d, asks } = mk();
    expect((await handleDesk(post({ actor: "standards", action: "rewrite", id: n43 }), d)).status).toBe(400);
    expect((await handleDesk(post({ actor: "standards", action: "rewrite", id: n43, reason: "flat" }), d)).status).toBe(400);
    expect(asks).toEqual([]);
  });
  it("only a published story; a second request while one is open is refused", async () => {
    const held = mk("held");
    expect((await handleDesk(post({ actor: "standards", action: "rewrite", id: n43, reason: "Calls a moving share flat" }), held.d)).status).toBe(409);
    expect(held.asks).toEqual([]);
    const twice = mk("published", "A rewrite of this story is already requested");
    expect((await handleDesk(post({ actor: "standards", action: "rewrite", id: n43, reason: "Calls a moving share flat" }), twice.d)).status).toBe(409);
  });
  it("a request stays open until the writer makes a version after it", () => {
    const ask = [{ story_id: n43, at: "2026-11-22T17:00:00Z" }];
    expect(openRewrites(ask, new Map([[n43, { created_at: "2026-11-21T10:00:00Z", model: AI_MODELS.writer, attempts: 1 }]]))).toEqual(new Map([[n43, "2026-11-22T17:00:00Z"]]));
    expect(openRewrites(ask, new Map()).has(n43)).toBe(true);
    expect(openRewrites(ask, new Map([[n43, { created_at: "2026-11-23T00:05:00Z", model: AI_MODELS.writer, attempts: 1 }]])).size).toBe(0);
    // a version after it made without the writer (out of calls) does not honour it
    expect(openRewrites(ask, new Map([[n43, { created_at: "2026-11-23T00:05:00Z", model: "template", attempts: 0 }]])).has(n43)).toBe(true);
  });
  it("a requested story comes first in the writer's queue, before a corrected story and the lead", () => {
    const st = (id: string, score: number) => ({ id, score, happened_at: "2026-11-22T10:00:00Z" });
    const order = requestedFirst(writePriority([st("lead", 9), st("fix", 1), st(n43, 0.1), st("other", 5)], { leadId: "lead", corrected: new Set(["fix"]) }), new Map([[n43, "2026-11-22T17:00:00Z"]]));
    expect(order.map(s => s.id)).toEqual([n43, "fix", "lead", "other"]);
  });
});
