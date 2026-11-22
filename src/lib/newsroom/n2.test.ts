// N2 · the first three desks: the copy desk's lints, the standards checklist on the frozen cases, the editor in chief's rules, the
// review pass end to end with fake I/O, the door's new actions and release rule, the reviewed state, the health line and the prompt gate.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintLine } from "./copy";
import { allowed, checklist, failed, parseProblems, type ReviewInput } from "./standards";
import { enforceChief, offerAgain, slotsFor } from "./chief";
import { AWAITING, DESK_CAPS, isPending, runDesks, type ReviewIO, type ReviewRow, type PendingStory } from "./review";
import { storyStates } from "./states";
import { callsLine } from "../health";
import { readWording } from "../stories/view";
import { applyEdits } from "../stories/edits";
import { toRow } from "../stories/build.server";
import { handleDesk, type DeskDeps } from "../stories/desk.server";
import { DESK_PROMPTS, DESK_VERSIONS, currentDeskVersion, deskGatePasses, deskScoreOf } from "./golden/versions";
import type { LogRow } from "./log";
import fx from "./__fixtures__/standards-cases.json";

type Case = { number: number; expect: "hold" | "pass"; id: string; input: ReviewInput };
const cases = (fx as unknown as { cases: Case[] }).cases;
const byNo = (n: number) => cases.find(c => c.number === n)!;

describe("copy desk", () => {
  it("the No. 45 line fails on its run number and its capitalised stage word, and reads clean in Read-side wording", () => {
    const line = "Lifestyle photography is Rising across all sectors (forecast run 13)";
    expect(lintLine(line).map(l => l.id)).toEqual(expect.arrayContaining(["method", "stage-case"]));
    expect(readWording(line)).toBe("Lifestyle photography is rising across all sectors");
    expect(lintLine(readWording(line))).toEqual([]);
  });
  it("one date format: an ISO date fails, day then month passes", () => {
    expect(lintLine("netlify.com · captured 2026-11-21", "caption").map(l => l.id)).toEqual(["date-format"]);
    expect(lintLine("netlify.com · captured 21 Nov 2026", "caption")).toEqual([]);
  });
  it("counts as k of n, percentages with the sign, no internal ids", () => {
    expect(lintLine("1/30 tracked dev tools brands").map(l => l.id)).toContain("count-form");
    expect(lintLine("1 of 30 tracked dev tools brands")).toEqual([]);
    expect(lintLine("49 percent of brands").map(l => l.id)).toContain("percent-form");
    expect(lintLine("Names netlify.com (event:4905)").map(l => l.id)).toContain("internal-id");
  });
});

describe("standards checklist on the frozen cases", () => {
  it("holds the four must-hold stories, each on the item that went wrong", () => {
    const failing = (n: number) => failed(checklist(byNo(n).input)).map(i => i.id);
    expect(failing(77)).toContain("news");      // the item names Mother Design, not Mother
    expect(failing(92)).toContain("minimums");  // one accent colour on one page
    expect(failing(91)).toContain("minimums");  // AI-read changes with no measured change
    expect(failing(45)).toContain("brands");    // Ragged Edge: the resort's site, no longer tracked
  });
  it("passes the six must-pass stories", () => {
    for (const n of [42, 43, 44, 88, 89, 90]) expect(failed(checklist(byNo(n).input)), `No. ${n}`).toEqual([]);
  });
  it("a brand whose title lacks its name passes only on the allow-list and only while the title reads the same", () => {
    expect(allowed({ domain: "mvsm.com", title: "ManvsMachine" })).toBe(true);
    expect(allowed({ domain: "mvsm.com", title: "A different site" })).toBe(false);
    expect(allowed({ domain: "x.ai", title: "SpaceXSI" })).toBe(false);
  });
  it("the second reader's answer must be the fixed structure", () => {
    const i = byNo(42).input;
    expect(parseProblems({ problems: [{ kind: "thin", words: i.headline, severity: "blocker", why: "Says nothing." }] }, i)?.[0]).toMatchObject({ severity: "blocker", found: true });
    expect(parseProblems({ problems: [{ kind: "rewrite", words: "", severity: "blocker", why: "x" }] }, i)).toBeNull();
  });
});

describe("editor in chief", () => {
  const s = (id: string, type = "move", basis: "measured" | "ai" | null = "measured", domains = ["a.com"]) => ({ id, type, basis, domains });
  it("cannot run an id it was not offered, holds instead of killing, and the caps decide last", () => {
    const eligible = [s("move:1"), s("move:2", "move", "measured", ["b.com"]), s("move:3", "move", "measured", ["c.com"]), s("move:4", "move", "measured", ["d.com"])];
    const d = enforceChief({ lead: "news:9", order: ["news:9", "move:2", "move:1"], holds: [{ id: "move:4", why: "Thin." }] }, eligible, ["move:1", "move:2", "move:3", "move:4"], { all: 5, news: 3, single_brand: 2, ai_roundup: 1 });
    // N3 · the refused lead (news:9 was never offered) falls back to the engine's lead; the desk's order follows.
    expect(d.run).toEqual(["move:1", "move:2"]);
    expect(d).toMatchObject({ lead: "move:1", leadBy: "engine", refused: { id: "news:9", why: "not an eligible story" } });
    expect(d.holds).toEqual(expect.arrayContaining([{ id: "move:4", why: "Thin.", by: "editor in chief" }, expect.objectContaining({ id: "move:3", by: "cap" })]));
    expect(d.ignored.join(" ")).toContain("news:9");
  });
  it("an AI-read roundup or a weekly piece never leads", () => {
    const d = enforceChief({ lead: "roundup:x", order: [], holds: [] }, [s("roundup:x", "roundup", "ai", ["a.com", "b.com", "c.com"]), s("move:1")], ["move:1", "roundup:x"], slotsFor([]));
    // N3 · the refusal is recorded and the engine's lead among the stories that may lead stands in.
    expect(d).toMatchObject({ lead: "move:1", leadBy: "engine", refused: { id: "roundup:x" } });
  });
  it("a refused lead with nothing that may lead leaves the lead open", () => {
    const d = enforceChief({ lead: "roundup:x", order: [], holds: [] }, [s("roundup:x", "roundup", "ai", ["a.com", "b.com", "c.com"])], ["roundup:x"], slotsFor([]));
    expect(d.lead).toBeNull();
    expect(d.refused?.id).toBe("roundup:x");
  });
  it("a story held two days running is offered again only when its facts change", () => {
    const held = [{ day: "2026-11-20", facts_hash: "h1" }, { day: "2026-11-21", facts_hash: "h1" }];
    expect(offerAgain(held, "h1")).toBe(false);
    expect(offerAgain(held, "h2")).toBe(true);
    expect(offerAgain(held.slice(0, 1), "h1")).toBe(true);
  });
});

describe("the review pass", () => {
  const NOW = Date.parse("2026-11-22T12:00:00Z");
  const pend = (id: string, score = 50): PendingStory => ({ id, type: "breakout", basis: "measured", score, components: { size: 10, brand: 10, novelty: 10, relevance: 20, total: 50 }, happened_at: "2026-11-22T08:00:00Z", created_at: "2026-11-22T09:00:00Z", domains: ["a.com", "b.com", "c.com"], drafted: true });
  const fake = (o: { pending: PendingStory[]; inputs: Record<string, ReviewInput>; standardsUsed?: number; reader?: (id: string) => { problems: never[] | { kind: "thin"; words: string; severity: "blocker" | "note"; why: string; found: boolean }[] } | null }) => {
    const rows: ReviewRow[] = [], door: { actor: string; body: Record<string, unknown> }[] = [];
    const io: ReviewIO = {
      now: () => NOW, pending: async () => o.pending, rechecks: async () => [], writerOut: async () => false, input: async id => o.inputs[id] ?? null,
      lastStandards: async () => new Map(), callsToday: async d => (d === "standards" ? o.standardsUsed ?? 0 : 0),
      secondReader: async i => { const r = o.reader ? o.reader(i.id) : { problems: [] }; return r ? { problems: r.problems as never, call_id: 1 } : null; },
      chief: async (_ci, ids) => ({ answer: { lead: "", order: ids, holds: [] }, call_id: 2 }),
      frontDay: async () => ({ leadOpen: false, leads: [], slots: new Map(), beats: "" }), chiefHolds: async () => new Map(), reoffers: async () => [],
      record: async r => { rows.push(...r); }, door: async (actor, body) => { door.push({ actor, body }); return { ok: true, status: 201 }; }, promptVersion: () => "v",
    };
    return { io, rows, door };
  };
  const pass = byNo(42).input, hold = byNo(45).input;
  it("a checklist failure holds the story through the door as standards, with the item as the reason", async () => {
    const f = fake({ pending: [pend(hold.id)], inputs: { [hold.id]: hold } });
    const sum = await runDesks(f.io, { deadline: NOW + 60_000 });
    expect(sum.held).toEqual([hold.id]);
    expect(f.door[0]).toMatchObject({ actor: "standards", body: { action: "hold", id: hold.id, reason: expect.stringContaining("Ragged Edge") } });
    expect(f.rows[0]).toMatchObject({ desk: "standards", verdict: "hold", second_reader: "not run" });
  });
  it("a passed story is released by the editor in chief (restore), recorded as reviewed", async () => {
    const f = fake({ pending: [pend(pass.id)], inputs: { [pass.id]: pass } });
    const sum = await runDesks(f.io, { deadline: NOW + 60_000 });
    expect(sum.released).toEqual([pass.id]);
    expect(f.door.at(-1)).toMatchObject({ actor: "editor in chief", body: { action: "restore", id: pass.id } });
    expect(f.rows.map(r => `${r.desk}:${r.verdict}`)).toEqual(["standards:pass", "editor in chief:run"]);
  });
  it("with the standards cap used the story runs without the second reader and says so", async () => {
    const f = fake({ pending: [pend(pass.id)], inputs: { [pass.id]: pass }, standardsUsed: DESK_CAPS.standards });
    const sum = await runDesks(f.io, { deadline: NOW + 60_000 });
    expect(sum.released).toEqual([pass.id]);
    expect(f.rows[0]).toMatchObject({ verdict: "pass", second_reader: "cap used", reason: "reviewed without second reader: cap used" });
    expect(String(f.door.at(-1)!.body["note"])).toContain("reviewed without second reader: cap used");
  });
  it("a failing second reader never stops the story", async () => {
    const f = fake({ pending: [pend(pass.id)], inputs: { [pass.id]: pass }, reader: () => null });
    expect((await runDesks(f.io, { deadline: NOW + 60_000 })).released).toEqual([pass.id]);
    expect(f.rows[0]).toMatchObject({ second_reader: "call failed" });
  });
  it("a blocker holds the story with the model's own sentence; a note does not", async () => {
    const f = fake({ pending: [pend(pass.id)], inputs: { [pass.id]: pass }, reader: () => ({ problems: [{ kind: "thin", words: pass.headline, severity: "blocker", why: "One small change is not a story.", found: true }] }) });
    const sum = await runDesks(f.io, { deadline: NOW + 60_000 });
    expect(sum.held).toEqual([pass.id]);
    expect(String(f.door[0]!.body["reason"])).toContain("One small change is not a story.");
    const g = fake({ pending: [pend(pass.id)], inputs: { [pass.id]: pass }, reader: () => ({ problems: [{ kind: "thin", words: "", severity: "note", why: "Could say more.", found: false }] }) });
    expect((await runDesks(g.io, { deadline: NOW + 60_000 })).released).toEqual([pass.id]);
  });
});

describe("the door: hold, note, proposal status and the release rule", () => {
  const mk = (h: { state: string; pending: boolean; heldBy: string | null; standardsPassed: boolean }) => {
    const logs: LogRow[] = [], edits: { action: string; payload: unknown }[] = [];
    const d: DeskDeps = { authorize: async () => true, allow: () => true, now: () => Date.parse("2026-11-22T12:00:00Z"),
      store: { log: async r => { logs.push(r); }, exists: async () => true, queue: async () => ({}), holdOf: async () => h,
        insertEdit: async e => { edits.push(e); return { id: 5, at: "2026-11-22T12:00:00Z", ...e } as never; },
        note: async r => ({ id: 1, ...r }), proposalStatus: async r => r.status, capReached: async () => false } };
    return { d, logs, edits };
  };
  const post = (body: unknown) => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer k" }, body: JSON.stringify(body) });
  const published = { state: "published", pending: false, heldBy: null, standardsPassed: true };
  it("hold ships alone, writes a marked hold edit and logs its reason", async () => {
    const { d, logs, edits } = mk(published);
    expect((await handleDesk(post({ actor: "copy desk", action: "hold", id: "move:1", reason: "The caption names the wrong brand" }), d)).status).toBe(201);
    expect(edits[0]).toMatchObject({ action: "kill", payload: { hold: true, desk: "copy desk" } });
    expect(logs[0]).toMatchObject({ actor: "copy desk", action: "hold", decision: "done", reason: "The caption names the wrong brand" });
  });
  it("a story waiting for review runs only when the editor in chief places it after standards passed it, or the owner runs it", async () => {
    const waiting = { state: "held", pending: true, heldBy: null, standardsPassed: true };
    expect((await handleDesk(post({ actor: "news", action: "restore", id: "move:1" }), mk(waiting).d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "editor in chief", action: "restore", id: "move:1" }), mk({ ...waiting, standardsPassed: false }).d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "editor in chief", action: "restore", id: "move:1" }), mk(waiting).d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "owner", action: "restore", id: "move:1" }), mk(waiting).d)).status).toBe(201);
  });
  it("a story standards held is released only by the editor in chief or the owner", async () => {
    const held = { state: "held", pending: false, heldBy: "standards", standardsPassed: false };
    expect((await handleDesk(post({ actor: "copy desk", action: "restore", id: "move:1" }), mk(held).d)).status).toBe(403);
    // N4c · a checklist hold standing is the owner's to release; the editor in chief places it only after standards passed it again.
    expect((await handleDesk(post({ actor: "editor in chief", action: "restore", id: "move:1" }), mk(held).d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "editor in chief", action: "restore", id: "move:1" }), mk({ ...held, standardsPassed: true }).d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "owner", action: "restore", id: "move:1" }), mk(held).d)).status).toBe(201);
  });
  it("a note ships alone; a proposal's status needs the owner", async () => {
    expect((await handleDesk(post({ actor: "data", action: "note", subject_kind: "signal", subject: "imagery:photography_lifestyle", text: "Watch the dev tools count next week" }), mk(published).d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "publisher", action: "proposal_status", log: 4, status: "accepted" }), mk(published).d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "owner", confirm: "owner confirms proposal_status", action: "proposal_status", log: 4, status: "accepted" }), mk(published).d)).status).toBe(201);
  });
});

describe("states, storage and health", () => {
  const story = { id: "move:1", status: "held", reason: AWAITING, created_at: "2026-11-22T09:00:00Z" };
  it("a story waiting for review has no held row; standards plus the editor's placement is reviewed, then published", () => {
    const edits = [{ id: 9, story_id: "move:1", action: "restore", note: "Reviewed: standards passed it; the editor in chief placed it 1 of 1.", payload: {}, at: "2026-11-22T10:00:01Z" }];
    const reviews = [{ id: 3, story_id: "move:1", desk: "editor in chief", verdict: "run", reason: "Reviewed: …", at: "2026-11-22T10:00:00Z" }];
    expect(storyStates(story, [], edits, new Map([[9, "editor in chief"]]), reviews).map(r => r.state)).toEqual(["candidate", "reviewed", "published"]);
  });
  it("the engine stores a story it would run as held, awaiting review, and that story counts as waiting until a desk acts", () => {
    const p = { id: "move:1", type: "move", status: "published", reason: "ran", score: 50 } as unknown as Parameters<typeof toRow>[0];
    expect(toRow(p, null, { desks: true })).toMatchObject({ status: "held", reason: AWAITING });
    expect(toRow(p, null)).toMatchObject({ status: "published" });
    const row = { id: "move:1", type: "move", status: "held" as const, reason: AWAITING, kicker: "", headline: "h", deck: null, facts: [], why_line: null, domains: [], source_ids: [], evidence: null } as never;
    expect(isPending(applyEdits(row, [], Date.now()))).toBe(true);
    expect(isPending(applyEdits(row, [{ id: 1, story_id: "move:1", action: "restore", payload: {}, note: null, at: "2026-11-22T10:00:00Z" }], Date.now()))).toBe(false);
  });
  it("the writer meter says what it counts: each writer and desk against its own limit", () => {
    expect(callsLine({ story: 2, study: 4, digest: 2, standards: 0, chief: 0, without_second_reader: 1 })).toBe("story writer 2 of 12, study writer 4 of 4, Digest writer 2 of 2, standards 0 of 12, editor in chief 0 of 6 model calls today (UTC); 1 story reviewed without second reader today");
  });
});

describe("the desks' prompts under the golden gate", () => {
  it("every desk's live prompt is a recorded version whose score file was made with it", () => {
    for (const d of DESK_PROMPTS) {
      const v = currentDeskVersion(d);
      expect(v, `${d}: the prompt or model changed; record a new version with a score file`).not.toBeNull();
      expect(JSON.parse(readFileSync(v!.score_file, "utf8")).prompt_hash).toBe(v!.prompt_hash);
    }
  });
  it("the tuned standards prompt passes the gate against the baseline", () => {
    const score = (f: string) => deskScoreOf(JSON.parse(readFileSync(f, "utf8")));
    const v1 = DESK_VERSIONS.find(v => v.desk === "standards" && v.version === "v1")!, v2 = DESK_VERSIONS.find(v => v.desk === "standards" && v.version === "v2")!;
    expect(deskGatePasses(score(v1.score_file), score(v2.score_file)).ok).toBe(true);
    expect(deskGatePasses({ cases: [{ key: "No. 42", right: true }] }, { cases: [{ key: "No. 42", right: false }] }).ok).toBe(false);
  });
});

describe("No. 85 · a page that followed its homepage stays a fact of the brand's story", async () => {
  const { followFailures } = await import("../stories/writer");
  const lines = [{ text: "The changelog page now uses Systemia too, between 14 and 20 Nov.", basis: null }];
  it("a written text that leaves out the followed page fails the writer's check; one that names it passes", () => {
    expect(followFailures("Netlify moved its homepage to Systemia.", { lines })).toEqual(["leaves out a fact on the sheet: the changelog page"]);
    expect(followFailures("Netlify moved its homepage to Systemia, and its changelog followed.", { lines })).toEqual([]);
  });
});

describe("the release rule follows the text", async () => {
  const { standardsPassStands } = await import("./newsroom.server");
  it("a standards pass stands only until the story's written text or a correction changes what readers see", () => {
    const pass = { verdict: "pass", at: "2026-11-22T10:00:00Z" };
    expect(standardsPassStands(pass, null)).toBe(true);
    expect(standardsPassStands(pass, "2026-11-22T09:00:00Z")).toBe(true);
    expect(standardsPassStands(pass, "2026-11-22T11:00:00Z")).toBe(false);
    expect(standardsPassStands({ verdict: "hold", at: pass.at }, null)).toBe(false);
    expect(standardsPassStands(null, null)).toBe(false);
  });
});
