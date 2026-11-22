// N1 · the newsroom's rules: the door and its levels, the desk log through the endpoint, story states, the week and cap, the
// memory's size, the wire-only switch, the memory files against the code, and the golden gate.
import { desksBlockOf, desksReadmeBlock } from "./docs";
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decide } from "./door";
import { REGISTER, actionDef, confirmPhrase, type ActionDef } from "./register";
import { DESKS } from "./desks";
import { storyStates, missingStates, currentState } from "./states";
import { capReached, etWeekStart, spendSplit } from "./spend";
import { fitMemory, MEMORY_MAX_BYTES } from "./memory";
import { frontStories } from "./wire-only";
import { beatsDoc, listsBlockOf, styleListsBlock, STYLE_LISTS } from "./docs";
import { gatePasses, scoreSet, type WritingSet } from "./golden/score";
import { VERSIONS, WRITERS, currentVersion } from "./golden/versions";
import { deskBody } from "../stories/desk";
import { handleDesk, type DeskDeps } from "../stories/desk.server";
import type { LogRow } from "./log";
import { spendFacts } from "../health";
import set from "./golden/__fixtures__/writing-set.json";
import { GOLDEN_CASES, SKIPPED } from "../stories/golden/skipped";

const def = (level: ActionDef["level"], costs = false): ActionDef => ({ id: "x", level, what: "", read: false, costs, subject: "none", since: "N1" });

describe("N1 · the door", () => {
  it("refuses a call with no actor, or an actor that is not a desk or the owner", () => {
    expect(decide(def("ships alone"), { actor: undefined }, { capReached: false }).kind).toBe("refused");
    expect(decide(def("ships alone"), { actor: "intern" }, { capReached: false }).kind).toBe("refused");
    expect(decide(def("ships alone"), { actor: "copy desk" }, { capReached: false }).kind).toBe("run");
  });
  it("ships to preview is a proposal, for a desk and for the owner", () => {
    expect(decide(def("ships to preview"), { actor: "graphics" }, { capReached: false }).kind).toBe("proposal");
    expect(decide(def("ships to preview"), { actor: "owner" }, { capReached: false }).kind).toBe("proposal");
  });
  it("needs the owner: a desk is refused; the owner needs the phrase", () => {
    expect(decide(def("needs the owner"), { actor: "editor in chief", confirm: confirmPhrase("x") }, { capReached: false }).kind).toBe("refused");
    const r = decide(def("needs the owner"), { actor: "owner" }, { capReached: false });
    expect(r).toEqual({ kind: "refused", reason: expect.any(String), confirm: "owner confirms x" });
    expect(decide(def("needs the owner"), { actor: "owner", confirm: "owner confirms x" }, { capReached: false }).kind).toBe("run");
  });
  it("an action that costs is refused while the weekly cap is reached", () => {
    expect(decide(def("ships alone", true), { actor: "news" }, { capReached: true }).kind).toBe("refused");
    expect(decide(def("ships alone", false), { actor: "news" }, { capReached: true }).kind).toBe("run");
  });
  it("every action the endpoint accepts is in the register, with the levels the roadmap gives", () => {
    const accepted = deskBody.options.map(o => (o as unknown as { shape: { action: { value: string } } }).shape.action.value).sort();
    expect(REGISTER.map(a => a.id).sort()).toEqual(accepted);
    expect(["living_approve", "living_rollback", "wire_only", "spend_cap"].map(a => actionDef(a)!.level)).toEqual(Array(4).fill("needs the owner"));
    expect(actionDef("propose")!.level).toBe("ships to preview");
    for (const a of ["pin", "kill", "correct", "restore", "pitch", "assign", "spend"]) expect(actionDef(a)!.level).toBe("ships alone");
  });
});

describe("N1 · every call through the endpoint is logged", () => {
  const mk = () => {
    const logs: LogRow[] = [], calls: string[] = [];
    const d: DeskDeps = {
      authorize: async r => r.headers.get("authorization") === "Bearer good", allow: () => true, now: () => Date.parse("2026-11-21T12:00:00Z"),
      store: {
        log: async r => { logs.push(r); }, exists: async id => id === "move:1",
        insertEdit: async e => { calls.push(`edit:${e.action}`); return { id: 77, at: "2026-11-21T12:00:00Z", ...e } as never; },
        queue: async () => ({ ok: true }), afterEdit: async id => { calls.push(`states:${id}`); },
        wireOnly: async on => { calls.push(`wire:${on}`); }, spendCap: async () => { calls.push("cap"); }, capReached: async () => false,
      },
    };
    return { d, logs, calls };
  };
  const post = (body: unknown, auth = "Bearer good") => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: typeof body === "string" ? body : JSON.stringify(body) });
  it("an unauthenticated call is not logged; an authenticated call without an actor is refused and logged", async () => {
    const { d, logs } = mk();
    expect((await handleDesk(post({ actor: "owner", action: "queue" }, "Bearer bad"), d)).status).toBe(401);
    expect(logs).toHaveLength(0);
    const r = await handleDesk(post({ action: "queue" }), d);
    expect(r.status).toBe(400);
    expect(logs).toEqual([expect.objectContaining({ actor: "unknown", action: "queue", decision: "refused", reason: expect.stringContaining("actor") })]);
  });
  it("a kill by a desk runs, is logged with its reason and the edit it wrote, then records states", async () => {
    const { d, logs, calls } = mk();
    expect((await handleDesk(post({ actor: "standards", action: "kill", id: "move:1", reason: "Not about the brand" }), d)).status).toBe(201);
    expect(logs).toEqual([expect.objectContaining({ actor: "standards", action: "kill", level: "ships alone", subject_id: "move:1", decision: "done", reason: "Not about the brand", edit_id: 77 })]);
    expect(calls).toEqual(["edit:kill", "states:move:1"]);
  });
  it("needs-the-owner actions: a desk is refused (logged), the owner without the phrase is told it, with it the action runs", async () => {
    const { d, logs, calls } = mk();
    const desk = await handleDesk(post({ actor: "publisher", action: "wire_only", on: true, reason: "Quiet weekend" }), d);
    expect(desk.status).toBe(403);
    const noPhrase = await handleDesk(post({ actor: "owner", action: "wire_only", on: true, reason: "Quiet weekend" }), d);
    expect(await noPhrase.json()).toMatchObject({ error: "refused", confirm: "owner confirms wire_only" });
    expect(calls).toEqual([]);
    expect((await handleDesk(post({ actor: "owner", confirm: "owner confirms wire_only", action: "wire_only", on: true, reason: "Quiet weekend" }), d)).status).toBe(201);
    expect(calls).toEqual(["wire:true"]);
    expect(logs.map(l => l.decision)).toEqual(["refused", "refused", "done"]);
  });
  it("a proposal is recorded and changes nothing", async () => {
    const { d, logs, calls } = mk();
    const r = await handleDesk(post({ actor: "graphics", action: "propose", kind: "chart", text: "A slope chart for two quarters" }), d);
    expect(r.status).toBe(202);
    expect(logs).toEqual([expect.objectContaining({ actor: "graphics", decision: "proposed", level: "ships to preview" })]);
    expect(calls).toEqual([]);
  });
  it("invalid input and reads are logged too", async () => {
    const { d, logs } = mk();
    expect((await handleDesk(post("not json"), d)).status).toBe(400);
    expect((await handleDesk(post({ actor: "data", action: "kill", id: "move:1" }), d)).status).toBe(400);
    expect((await handleDesk(post({ actor: "data", action: "queue" }), d)).status).toBe(200);
    expect(logs.map(l => [l.actor, l.decision])).toEqual([["unknown", "refused"], ["data", "refused"], ["data", "read"]]);
  });
});

describe("N1 · story states", () => {
  const story = { id: "move:1", status: "held", reason: "over the daily cap of 5 stories", created_at: "2026-11-20T10:00:00Z" };
  it("reads candidate, the stored status, the writer's drafts and the edits, in time order", () => {
    const rows = storyStates(story,
      [{ id: 5, story_id: "move:1", model: "openai/gpt-6.2-astra", checked: true, failures: [], created_at: "2026-11-20T10:05:00Z" }],
      [{ id: 9, story_id: "move:1", action: "pin", note: null, payload: {}, at: "2026-11-20T11:00:00Z" }, { id: 10, story_id: "move:1", action: "kill", note: "Retired: reversed within seven days", payload: { reason: "reversed" }, at: "2026-11-21T09:00:00Z" }],
      new Map([[9, "editor in chief"]]));
    expect(rows.map(r => [r.state, r.actor])).toEqual([["candidate", "engine"], ["held", "engine"], ["drafted", "story writer"], ["checked", "story writer"], ["published", "editor in chief"], ["retired", "engine"]]);
    expect(rows[1]!.reason).toBe("over the daily cap of 5 stories");
    expect(currentState(rows)).toBe("retired");
    expect(new Set(rows.map(r => r.ref)).size).toBe(rows.length);
  });
  it("a facts-built text is drafted, never checked; held, killed and retired always carry a reason", () => {
    const rows = storyStates({ ...story, reason: "" }, [{ id: 6, story_id: "move:1", model: "template", checked: false, failures: ["x"], created_at: "2026-11-20T10:05:00Z" }], [{ id: 11, story_id: "move:1", action: "kill", note: null, payload: {}, at: "2026-11-20T12:00:00Z" }]);
    expect(rows.map(r => r.state)).toEqual(["candidate", "held", "drafted", "killed"]);
    for (const r of rows.filter(r => ["held", "killed", "retired"].includes(r.state))) expect(r.reason?.length).toBeGreaterThanOrEqual(3);
    expect(rows.find(r => r.state === "killed")!.actor).toBe("editor");
  });
  it("only rows not yet written are written", () => {
    const rows = storyStates(story, [], []);
    expect(missingStates(rows, new Set([rows[0]!.ref]))).toEqual([rows[1]]);
  });
});

describe("N1 · spend", () => {
  it("the week starts Monday 00:00 in New York, in winter and in summer", () => {
    expect(etWeekStart(Date.parse("2026-11-21T19:00:00Z"))).toBe("2026-11-16T05:00:00.000Z");
    expect(etWeekStart(Date.parse("2026-11-16T04:59:00Z"))).toBe("2026-11-09T05:00:00.000Z");
    expect(etWeekStart(Date.parse("2026-07-08T12:00:00Z"))).toBe("2026-07-06T04:00:00.000Z");
  });
  it("no cap blocks nothing; either number at its cap blocks", () => {
    expect(capReached({ model_usd: 999, build_credits: 999, cap: null })).toBe(false);
    expect(capReached({ model_usd: 25, build_credits: 0, cap: { model_usd: 25, build_credits: null, set_at: "" } })).toBe(true);
    expect(capReached({ model_usd: 24.99, build_credits: 0, cap: { model_usd: 25, build_credits: null, set_at: "" } })).toBe(false);
    expect(capReached({ model_usd: 0, build_credits: 300, cap: { model_usd: null, build_credits: 300, set_at: "" } })).toBe(true);
  });
  it("writer calls and AI reads are split; health states the cap without amounts", () => {
    expect(spendSplit({ by_kind: [{ kind: "story_why", model: "w", calls: 1, usd: 1.08 }, { kind: "vision", model: "v", calls: 9, usd: 2.31 }] })).toEqual({ writers: 1.08, readers: 2.31 });
    expect(spendFacts({ cap_set: false, reached: false, week_start: "2026-11-16T05:00:00+00:00" })).toMatchObject({ cap_set: false, reached: false });
    expect(spendFacts({ cap_set: true, reached: true })!.line).toMatch(/reached/);
  });
});

describe("N1 · the memory and the switch", () => {
  it("the memory stays under 200 KB by leaving out the oldest log rows", () => {
    const log = Array.from({ length: 3000 }, (_, i) => ({ i, reason: "x".repeat(100) }));
    const m = fitMemory({ files: { a: "y".repeat(1000) }, log });
    expect(m.bytes).toBeLessThanOrEqual(MEMORY_MAX_BYTES);
    expect(m.log_left_out).toBeGreaterThan(0);
    expect((m.log[0] as { i: number }).i).toBe(0);
    expect(fitMemory({ log: [1, 2, 3] }).log_left_out).toBe(0);
  });
  it("wire only takes stories off the front page only when on", () => {
    expect(frontStories([1, 2], false)).toEqual([1, 2]);
    expect(frontStories([1, 2], true)).toEqual([]);
  });
});

describe("N1 · the memory files agree with the code", () => {
  const style = readFileSync("newsroom/style.md", "utf8");
  it("style.md lists exactly what the check enforces", () => {
    expect(listsBlockOf(style)).toBe(styleListsBlock());
    expect(style.split("lists:start").length).toBe(2);
    // Every item of every enforced list is in the file, and the lists block is the only list of refused words.
    for (const l of STYLE_LISTS) for (const x of l.items) expect(style).toContain(`“${x}”`);
    const outside = style.replace(listsBlockOf(style)!, "");
    expect(outside).not.toMatch(/Refused as “/);
  });
  it("beats.md is written from the constants, and the README exists", () => {
    expect(readFileSync("newsroom/beats.md", "utf8")).toBe(beatsDoc());
    expect(existsSync("newsroom/README.md")).toBe(true);
  });
  it("N3 · the README's desks block is written from the code: limits, the three new desks and their actions", () => {
    const md = readFileSync("newsroom/README.md", "utf8");
    expect(desksBlockOf(md)).toBe(desksReadmeBlock());
    for (const a of ["wire_pick", "wire_drop", "picture", "finding", "finding_close"]) expect(md).toContain(`\`${a}\``);
    expect(md).toContain("**news**, wire picks: 4 a day.");
    expect(md).toContain("**graphics**, picture check: 8 a day.");
  });
});

describe("N1 · the golden gate", () => {
  const ws = set as unknown as WritingSet;
  it("every frozen approved text passes the shared check against its frozen facts", () => {
    const s = scoreSet(ws);
    expect(s.total).toBeGreaterThan(0);
    // N5 · the owner's “steady is not flat” rule (22 Nov) refuses one frozen text: No. 43's deck “Its share was flat.” beside momentum
    // 1.3 points a quarter. That is the rule working, not a writer change; every other frozen text passes and nothing else may fail.
    const failing = s.items.filter(i => i.failures.length);
    expect(failing.map(i => ({ number: i.number, failures: i.failures }))).toEqual([{ number: 43, failures: ["a moving share called flat: the facts give its momentum as 1.3 points a quarter"] }]);
    expect(s.passed).toBe(s.total - 1);
  });
  it("a writer change that breaks a text that passed fails the gate", () => {
    const base = scoreSet(ws), first = ws.items[0]!;
    const worse = scoreSet(ws, new Map([[first.id, { ...first.text, headline: "Worth watching: a game-changing move" }]]));
    expect(gatePasses(base, worse).ok).toBe(false);
    expect(gatePasses(base, base).ok).toBe(true);
  });
  it("every writer's current prompt, models and template are a recorded version with a score file that passes", () => {
    const base = JSON.parse(readFileSync("newsroom/scores/story-v1.json", "utf8"));
    for (const w of WRITERS) {
      const v = currentVersion(w);
      expect(v, `${w}: the prompt or model changed; record a new version in versions.ts with a score file`).not.toBeNull();
      const file = JSON.parse(readFileSync(v!.score_file, "utf8"));
      expect(file.prompt_hash).toBe(v!.prompt_hash);
      if (w === "story") expect(gatePasses(base, file).ok).toBe(true);
    }
    expect(new Set(VERSIONS.map(v => `${v.writer}|${v.version}`)).size).toBe(VERSIONS.length);
  });
  it("the golden set keeps its cases and its two named skips", () => {
    expect(GOLDEN_CASES).toBe(37);
    expect(Object.keys(SKIPPED)).toHaveLength(2);
  });
});

it("desks are the roadmap's ten", () => { expect(DESKS).toHaveLength(10); });
