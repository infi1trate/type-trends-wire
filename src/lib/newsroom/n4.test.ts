// N4 · the product loop's rules, each from the brief's own words: a test run never counts; budgets start from the first weekly run plus
// 10%; the gate's checks (0.4% passes and 3% fails for no visible change, a failed test, a missing page, a 900 ms first byte, a design
// move outside its range through the living-design gate); the queue's order (live needs a pass, briefed needs the accepted proposal);
// the design review desk's moves; the engineering desk's health rules; and the door's review shape.
import { describe, expect, it } from "vitest";
import { BUDGET_GROWTH, REVIEW_PAGES, REVIEW_WIDTHS, breaches, budgets, enforceMoves, missingCells, parseDesign, rankMoves, reviewPicturePath, runDiff, weeklyBreaches, type Observation, type ReviewRow, type Measures } from "./design-review";
import { gateVerdict, type GateInput } from "./build-gate";
import { moveDecision } from "./queue";
import { callProblems, checkProblems, historyProblem, jobProblems, reconcileHealth, speedProblems } from "./engineering";
import { LIVE_VALUES } from "../living/editions";
import { parseCropPath, parseSurfacePath } from "../crops";
import { deskBody } from "../stories/desk";
import { doorCall, handleDesk, type DeskDeps } from "../stories/desk.server";
import { DESK_LIMITS } from "./caps";

let id = 0;
const ok: Measures = { height_px: 3000, words: 1200, links: 100, images: 10, image_kb: 400, first_byte_ms: 400, lcp_ms: 1200, cls: 0.01, overflow_x: false, small_targets: 2, low_contrast: 0, h1: 1, headings: 12, console_errors: 0, failed_requests: 0 };
const path = (p: string) => ({ front: "/", story: "/stories/move:1", brand: "/brands/netlify.com", study: "/data/which-sector-changes-its-mind", terminal: "/terminal", digest: "/digest", studies: "/data", brands: "/brands", signals: "/signals" } as Record<string, string>)[p]!;
/** A complete run: every page at every width with the same measures, changed by `edit` where it says. */
function run(name: string, kind: ReviewRow["kind"], o: { m?: Measures; edit?: (page: string, width: number) => Measures; skip?: string; against?: string; at?: string } = {}): ReviewRow[] {
  return REVIEW_PAGES.flatMap(p => REVIEW_WIDTHS.flatMap(w => (o.skip === `${p.id}@${w}` ? [] : [{ id: ++id, at: o.at ?? "2026-11-22T06:00:00Z", run: name, kind, page: p.id, path: path(p.id), width: w, against: o.against ?? null, measures: { ...(o.m ?? ok), ...(o.edit?.(p.id, w) ?? {}) }, picture: `reviews/${name}/${p.id}-${w}-00000000.webp` }])));
}
const gateIn = (after: ReviewRow[], o: Partial<GateInput> = {}): GateInput => ({ item: { kind: "bug", expects: "no visible change", move: null }, tests: { passed: 2100, failed: 0, skipped: 3 }, before: { run: "B", kind: "before", rows: run("B", "before") }, after: { run: "A", kind: "after", rows: after }, proposal: null, live: LIVE_VALUES, ...o });
const failing = (g: ReturnType<typeof gateVerdict>) => g.checks.filter(c => !c.ok).map(c => c.id);

describe("N4 · page reviews and budgets", () => {
  it("a complete run is nine pages at three widths; a missing one is named", () => {
    expect(REVIEW_PAGES.map(p => p.id)).toEqual(["front", "story", "brand", "study", "terminal", "digest", "studies", "brands", "signals"]);
    expect([...REVIEW_WIDTHS]).toEqual([1440, 768, 390]);
    expect(missingCells(run("A", "weekly", { skip: "digest@768" }))).toEqual(["The Digest at 768 px"]);
  });
  it("a test run creates no budget, breach or queue item", () => {
    const t = run("T1", "test", { m: { ...ok, overflow_x: true, first_byte_ms: 5000 } });
    expect(weeklyBreaches(t)).toEqual({ run: null, budgets: [], breaches: [] });
  });
  it("budgets start from the first weekly run plus 10%, so nothing breaches on day one; until then there are no height budgets", () => {
    expect(budgets({ first: null, previous: null }).some(b => b.measure === "height_px")).toBe(false);
    const first = run("W1", "weekly");
    const day1 = weeklyBreaches(first);
    expect(day1.breaches).toEqual([]);
    expect(day1.budgets.find(b => b.page === "front" && b.width === 1440 && b.measure === "height_px")?.budget).toBe(Math.round(3000 * (1 + BUDGET_GROWTH)));
    const second = run("W2", "weekly", { at: "2026-11-29T06:00:00Z", edit: (p, w) => (p === "front" && w === 390 ? { height_px: 3400, small_targets: 3, overflow_x: true } : {}) });
    const b = weeklyBreaches([...first, ...second]).breaches.map(x => `${x.measure}:${x.bug ? "bug" : "proposal"}`).sort();
    expect(b).toEqual(["height_px:proposal", "overflow_x:bug", "small_targets:bug"]);
  });
  it("a missing measure is not measured, never zero: it is no breach and shows as not measured in the differences", () => {
    const first = run("W1", "weekly"), second = run("W2", "weekly", { at: "2026-11-29T06:00:00Z", edit: (p, w) => (p === "front" && w === 1440 ? { words: undefined } : {}) });
    const list = budgets({ first, previous: first });
    expect(breaches(second.map(r => (r.page === "front" && r.width === 1440 ? { ...r, measures: Object.fromEntries(Object.entries(r.measures).filter(([k]) => k !== "words")) } : r)), list)).toEqual([]);
    expect(runDiff(second, first).find(d => d.page === "front" && d.width === 1440)?.changes).toEqual([{ measure: "words", before: 1200, after: null }]);
  });
  it("review pictures live under reviews/ and are never read as a brand crop or a page first screen", () => {
    const p = reviewPicturePath("2026-W48", "front", 1440, "abcd1234");
    expect(p).toBe("reviews/2026-w48/front-1440-abcd1234.webp");
    expect(parseCropPath(p)).toBeNull(); expect(parseSurfacePath(p)).toBeNull();
  });
});

describe("N4 · the gate (made-up numbers)", () => {
  it("an item expecting no visible change passes at 0.4% changed and fails at 3%", () => {
    expect(gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0.004 } }))).pass).toBe(true);
    const g = gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0.03 } })));
    expect(g.pass).toBe(false); expect(failing(g)).toEqual(["visible"]);
  });
  it("a failed test fails the gate", () => {
    expect(failing(gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0 } }), { tests: { passed: 2099, failed: 1, skipped: 3 } })))).toEqual(["tests"]);
  });
  it("a missing page fails it", () => {
    expect(failing(gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0 }, skip: "signals@390" }))))).toContain("complete");
  });
  it("a first byte of 900 ms fails it", () => {
    expect(failing(gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0 }, edit: (p, w) => (p === "brand" && w === 768 ? { first_byte_ms: 900 } : {}) }))))).toEqual(["first_byte"]);
  });
  it("more console errors than the before run fails it; a test run never counts", () => {
    expect(failing(gateVerdict(gateIn(run("A", "after", { against: "B", m: { ...ok, changed_share: 0, console_errors: 1 } }))))).toEqual(["no_worse"]);
    const t = gateVerdict(gateIn(run("A", "test", { against: "B", m: { ...ok, changed_share: 0 } }), { after: { run: "A", kind: "test", rows: run("A", "test", { against: "B", m: { ...ok, changed_share: 0 } }) } }));
    expect(t.pass).toBe(false); expect(t.checks.find(c => c.id === "complete")!.problems[0]).toContain("test run");
  });
  it("a design move outside its range fails through the living-design gate; inside it passes", () => {
    const after = run("A", "after", { against: "B", m: { ...ok, changed_share: 0.02 } });
    const out = gateVerdict(gateIn(after, { item: { kind: "design move", expects: "small", move: { setting: "radius", from: 0, to: 8 } }, proposal: "accepted" }));
    expect(failing(out)).toEqual(["living"]);
    expect(out.checks.find(c => c.id === "living")!.problems.join(" ")).toContain("outside its range");
    expect(gateVerdict(gateIn(after, { item: { kind: "design move", expects: "small", move: { setting: "radius", from: 0, to: 2 } }, proposal: "accepted" })).pass).toBe(true);
  });
  it("a layout change has no pixel limit but needs the accepted proposal", () => {
    const after = run("A", "after", { against: "B", m: { ...ok, changed_share: 0.6, height_px: 4000 } });
    expect(failing(gateVerdict(gateIn(after, { item: { kind: "layout", expects: "layout", move: null }, proposal: "open" })))).toEqual(["proposal"]);
    expect(gateVerdict(gateIn(after, { item: { kind: "layout", expects: "layout", move: null }, proposal: "accepted" })).pass).toBe(true);
  });
});

describe("N4 · the queue's order", () => {
  const base = { kind: "bug", actor: "engineering", reason: null, proposal: null, gatePass: null } as const;
  it("live is refused without a pass, and allowed after one", () => {
    expect(moveDecision({ ...base, status: "gate failed", to: "live" }).ok).toBe(false);
    expect(moveDecision({ ...base, status: "gate passed", to: "live", gatePass: false })).toEqual({ ok: false, reason: "The newest gate result for this item is a fail." });
    expect(moveDecision({ ...base, status: "gate passed", to: "live", gatePass: true }).ok).toBe(true);
  });
  it("briefed is refused for a layout item whose proposal is not accepted; a bug needs none", () => {
    expect(moveDecision({ ...base, kind: "layout", status: "queued", to: "briefed", proposal: "open" }).ok).toBe(false);
    expect(moveDecision({ ...base, kind: "layout", status: "queued", to: "briefed", proposal: "accepted" }).ok).toBe(true);
    expect(moveDecision({ ...base, status: "queued", to: "briefed" }).ok).toBe(true);
  });
  it("only the listed order; only a gate result sets the gate statuses; a decline needs a reason; the owner may only decline", () => {
    expect(moveDecision({ ...base, status: "queued", to: "built" }).ok).toBe(false);
    expect(moveDecision({ ...base, status: "built", to: "gate passed" }).ok).toBe(false);
    expect(moveDecision({ ...base, status: "built", to: "declined" }).ok).toBe(false);
    expect(moveDecision({ ...base, status: "built", to: "declined", reason: "no longer found" }).ok).toBe(true);
    expect(moveDecision({ ...base, actor: "owner", status: "queued", to: "briefed" }).ok).toBe(false);
    expect(moveDecision({ ...base, actor: "owner", status: "queued", to: "declined", reason: "not wanted" }).ok).toBe(true);
    expect(moveDecision({ ...base, status: "live", to: "declined", reason: "too late" }).ok).toBe(false);
  });
});

describe("N4 · the design review desk's moves", () => {
  const obs = (move: Partial<Observation["move"]>, measure: Observation["measure"] = "picture"): Observation => ({ where: "the lead", sees: "three blocks compete", focus: "density", evidence: "the 390 px picture", measure, move: { type: "setting", setting: "density", value: "4.25", text: "More space between sections.", touches: "none", ...move } });
  it("a setting move needs a register setting and a value inside its range; else it is dropped", () => {
    const r = enforceMoves("front", [obs({}), obs({ value: "6" })], { live: LIVE_VALUES, breached: new Set() });
    expect(r.kept.map(k => k.type === "setting" && k.to)).toEqual([4.25]);
    expect(r.dropped[0]!.why).toContain("not a value inside its range");
  });
  it("anything else is a layout move needing the owner; a move touching the never list is dropped", () => {
    const r = enforceMoves("front", [obs({ type: "layout", setting: "none", text: "Show four cards instead of six in Also today." }), obs({ type: "layout", setting: "none", text: "Move the navigation to the left.", touches: "navigation" })], { live: LIVE_VALUES, breached: new Set() });
    expect(r.kept.map(k => k.type === "layout" && k.needsOwner)).toEqual([true]);
    expect(r.dropped[0]!.why).toContain("navigation");
    expect(enforceMoves("front", [obs({ type: "layout", setting: "none", text: "Set the headline in a different typeface." })], { live: LIVE_VALUES, breached: new Set() }).dropped.length).toBe(1);
  });
  it("a brand page's subject name is not slug's name; renaming slug is", () => {
    const tighten = obs({ setting: "tracking", value: "-0.01", text: "Tighten the letter-spacing of the condensed brand name and section headers." });
    expect(enforceMoves("brand", [tighten], { live: LIVE_VALUES, breached: new Set() }).kept.length).toBe(1);
    expect(enforceMoves("front", [obs({ type: "layout", setting: "none", text: "Rename slug to something longer." })], { live: LIVE_VALUES, breached: new Set() }).dropped.length).toBe(1);
  });
  it("at most five a week, the ones tied to a breach first", () => {
    const xs = ["signals", "front", "story", "brand", "study", "terminal"].map((page, i) => ({ page, tied: i === 0 }));
    const r = rankMoves(xs, 0);
    expect(r.file.map(x => x.page)).toEqual(["signals", "front", "story", "brand", "study"]);
    expect(rankMoves(xs, 4).file.length).toBe(1);
  });
  it("the call's answer is the fixed structure or nothing; at most two observations", () => {
    expect(parseDesign({ observations: [obs({}), obs({}), obs({})] })!.length).toBe(2);
    expect(parseDesign({ observations: [{ where: "x" }] })).toBeNull();
    expect(DESK_LIMITS.find(l => l.desk === "design review")?.cap).toBe(9);
  });
});

describe("N4 · the engineering desk's health rules", () => {
  const NOW = Date.parse("2026-11-22T08:00:00Z"), at = (h: number) => new Date(NOW - h * 36e5).toISOString();
  const daily = (n: number, ok = true, secs = 2) => Array.from({ length: n }, (_, i) => ({ started_at: at(24 * i + 1), finished_at: new Date(Date.parse(at(24 * i + 1)) + secs * 1000).toISOString(), ok }));
  it("a failed job, a job that has not run within twice its interval, and one over three times its median", () => {
    expect(jobProblems("ingest-producthunt", daily(10, false), NOW).map(p => p.key)).toEqual(["health:job-failed:ingest-producthunt"]);
    expect(jobProblems("ingest-gfonts", daily(10).map(r => ({ ...r, started_at: new Date(Date.parse(r.started_at) - 3 * 864e5).toISOString(), finished_at: new Date(Date.parse(r.finished_at) - 3 * 864e5).toISOString() })), NOW).map(p => p.key)).toEqual(["health:job-late:ingest-gfonts"]);
    const slow = daily(10); slow[0] = { ...slow[0]!, finished_at: new Date(Date.parse(slow[0]!.started_at) + 30_000).toISOString() };
    expect(jobProblems("ingest-wire", slow, NOW).map(p => p.key)).toEqual(["health:job-slow:ingest-wire"]);
    expect(jobProblems("ingest-wire", daily(10), NOW)).toEqual([]);
  });
  it("speed, model-call failures over 10%, shared-check failures over half, and the history refresh over 60 s", () => {
    expect(speedProblems({ run: "A", rows: run("A", "after", { edit: (p, w) => (p === "brand" && w === 390 ? { first_byte_ms: 1200 } : {}) }) }).map(p => p.key)).toEqual(["health:speed:brand"]);
    expect(callProblems([...Array(9).fill({ who: "news", ok: true }), { who: "news", ok: false }]).length).toBe(0);
    expect(callProblems([...Array(8).fill({ who: "news", ok: true }), { who: "news", ok: false }, { who: "news", ok: false }]).map(p => p.key)).toEqual(["health:calls:news"]);
    expect(checkProblems([{ writer: "story", passed: false }, { writer: "story", passed: false }, { writer: "story", passed: true }]).map(p => p.key)).toEqual(["health:check:story"]);
    expect(historyProblem({ ms: 61_000, started_at: at(1) }).length).toBe(1);
    expect(historyProblem({ ms: 59_000, started_at: at(1) }).length).toBe(0);
  });
  it("a problem that is gone is declined; one still found is not filed twice", () => {
    expect(reconcileHealth([{ id: 1, key: "health:stale:crawl" }, { id: 2, key: "health:speed:front" }], [{ key: "health:speed:front", title: "t", why: "w" }, { key: "health:check:story", title: "t", why: "w" }]))
      .toEqual({ add: [{ key: "health:check:story", title: "t", why: "w" }], close: [1] });
  });
});

describe("N4 · the door", () => {
  const good = { action: "review", run: "2026-W48", kind: "weekly", page: "front", path: "/", width: 1440, measures: { height_px: 3735, words: 1255 } };
  it("unknown pages, widths and measure names are refused; every measure is optional", () => {
    expect(deskBody.safeParse(good).success).toBe(true);
    expect(deskBody.safeParse({ ...good, page: "about" }).success).toBe(false);
    expect(deskBody.safeParse({ ...good, width: 1024 }).success).toBe(false);
    expect(deskBody.safeParse({ ...good, measures: { height: 3 } }).success).toBe(false);
    expect(deskBody.safeParse({ ...good, page: "brand", path: "/" }).success).toBe(false);
    const p = deskBody.safeParse({ ...good, measures: {} });
    expect(p.success && "measures" in p.data && p.data.measures).toEqual({});
  });
  const deps = (o: Partial<DeskDeps["store"]> = {}): DeskDeps & { logs: unknown[] } => {
    const logs: unknown[] = [];
    return { logs, authorize: async () => true, allow: () => true, now: () => Date.now(), store: { exists: async () => false, insertEdit: async () => { throw new Error("no"); }, queue: async () => ({}), log: async r => { logs.push(r); return logs.length; }, ...o } };
  };
  it("the design review desk cannot move a queue item; the owner may only decline; gate_result is engineering's", async () => {
    const d = deps({ queueMove: async r => ({ status: r.to }) });
    expect((await doorCall(d, { actor: "design review", action: "queue_move", item: 1, to: "briefed" })).status).toBe(403);
    expect((await doorCall(d, { actor: "news", action: "gate_result", item: 1, commit: "abcdef1", tests: { passed: 1, failed: 0, skipped: 0 }, before_run: "B", after_run: "A" })).status).toBe(403);
    expect((await doorCall(d, { actor: "news", ...good })).status).toBe(403);
  });
  it("a review body may carry a picture; any other action over 8 KB is refused", async () => {
    const d = deps({ review: async () => ({ id: 7, picture: "reviews/x.webp" }), note: async () => ({}) });
    const req = (b: unknown) => new Request("http://x/api/public/desk", { method: "POST", body: JSON.stringify(b) });
    const r1 = await handleDesk(req({ actor: "design review", ...good, picture: "A".repeat(150_000) }), d);
    expect(r1.status).toBe(201);
    const r2 = await handleDesk(req({ actor: "data", action: "note", subject_kind: "brand", subject: "x.com", text: "y".repeat(9000) }), d);
    expect(r2.status).toBe(413);
  });
  it("a proposal returns its desk-log id, so a queue item can name it", async () => {
    const d = deps();
    const r = await doorCall(d, { actor: "design review", action: "propose", kind: "layout", text: "Show four cards instead of six." });
    expect((r.body as { log?: number }).log).toBe(1);
  });
  it("R1 · a brand candidate without sector, category and sub-category from the map is refused at the door; with them it is recorded", async () => {
    const d = deps();
    const bad = await doorCall(d, { actor: "scout", action: "propose", kind: "brand", subject: "brand:withplum.com", sector: "fintech", text: "Track Plum (withplum.com)." });
    expect(bad.status).toBe(409);
    expect((bad.body as { reason: string }).reason).toBe("A brand candidate needs its sector, category and sub-category from the category map. Choose a category in this sector.");
    const ok = await doorCall(d, { actor: "scout", action: "propose", kind: "brand", subject: "brand:withplum.com", sector: "fintech", category: "investing", subcategory: "wealth", text: "Track Plum (withplum.com)." });
    expect(ok.status).toBe(202);
  });
});
