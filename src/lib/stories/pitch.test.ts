// U4 · pitches: the request schema, every verdict path, staff-only access, and the rule that a pitch never publishes or changes a plan.
import { describe, expect, it } from "vitest";
import type { Check } from "../integrity";
import type { BuildInput } from "./candidates";
import { runBuild, type BuildDeps, type StoryRowOut } from "./build.server";
import { goldenChecks, goldenInput } from "./golden/run";
import { handleDesk, type DeskDeps } from "./desk.server";
import { deskBody } from "./desk";
import { isOpen, matches, pitchBody, pitchVerdict, subjectOf, verdictsToRecord, PITCH_NOTE_MAX, type EngineView, type Pitch } from "./pitch";

type View = Omit<EngineView, "numberOf">;
const build = async (o: { dry?: boolean; checks?: Record<number, Check>; withPitches?: boolean } = {}) => {
  const input = { ...goldenInput(), checks: o.checks ?? goldenChecks } as BuildInput;
  let view: View | null = null; const inserted: StoryRowOut[] = [];
  const deps: BuildDeps = { load: async () => input, existing: async () => [], insert: async rows => (inserted.push(...rows), rows.length),
    ...(o.withPitches !== false ? { pitches: async (v: View) => { view = v; return 0; } } : {}) };
  const res = await runBuild(deps, { now: () => Date.parse(input.now), ...(o.dry ? { pitchDry: true } : {}) });
  return { view: view as View | null, inserted, res };
};
const pitch = (kind: Pitch["kind"], ref: string, id = 1): Pitch => ({ id, kind, ref, facts: [], note: "Worth a look", by: "editor key", at: "2026-11-21T00:00:00Z" });
const ask = (v: View, p: Pitch, numbers: Record<string, number> = {}) => pitchVerdict(p, { ...v, numberOf: id => numbers[id] ?? null });

describe("U4 · pitch request", () => {
  it("one line of why, at most 140 characters, no $ in our words; kind and ref required", () => {
    const ok = { action: "pitch", kind: "change", ref: "4756", facts: ["Brand: netlify.com"], note: "Netlify went big" };
    expect(pitchBody.safeParse(ok).success).toBe(true);
    expect(deskBody.safeParse(ok).success).toBe(true);
    expect(pitchBody.safeParse({ ...ok, note: "x".repeat(PITCH_NOTE_MAX + 1) }).success).toBe(false);
    expect(pitchBody.safeParse({ ...ok, note: "" }).success).toBe(false);
    expect(pitchBody.safeParse({ ...ok, note: "Up $5" }).success).toBe(false);
    expect(pitchBody.safeParse({ ...ok, kind: "anything" }).success).toBe(false);
    expect(pitchBody.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
  it("names what a pitch is about in the engine's terms", () => {
    expect(subjectOf({ kind: "change", ref: "4756" })).toEqual({ sources: ["event:4756"] });
    expect(subjectOf({ kind: "brand", ref: "www.Netlify.com" })).toEqual({ domain: "netlify.com" });
    expect(subjectOf({ kind: "receipt", ref: "story:brand:x.com:2026-11-20" })).toEqual({ ids: ["brand:x.com:2026-11-20"] });
    expect(subjectOf({ kind: "receipt", ref: "brand:x.com" })).toEqual({ domain: "x.com" });
    expect(matches({ domain: "x.com" }, { id: "r", type: "roundup", domains: ["x.com", "y.com"], signalKeys: [], sourceIds: [] })).toBe(false);
  });
});

describe("U4 · the desk endpoint takes pitches only with the editor key", () => {
  const post = (body: unknown, auth = "Bearer good") => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) });
  const deps = () => { const got: unknown[] = []; const d: DeskDeps = { authorize: async r => r.headers.get("authorization") === "Bearer good", allow: () => true, now: () => 0,
    store: { exists: async () => false, insertEdit: async () => { throw new Error("a pitch never edits a story"); }, queue: async () => ({}), pitch: async p => (got.push(p), { pitch: { id: 1, ...p }, verdict: null }) } }; return { d, got }; };
  const body = { action: "pitch", kind: "brand", ref: "netlify.com", facts: [], note: "Look again" };
  it("401 without the key; nothing stored", async () => {
    const { d, got } = deps();
    expect((await handleDesk(post(body, "Bearer bad"), d)).status).toBe(401);
    expect(got).toEqual([]);
  });
  it("with the key it stores one pitch and edits no story", async () => {
    const { d, got } = deps();
    const r = await handleDesk(post(body), d);
    expect(r.status).toBe(201);
    expect(got).toEqual([{ kind: "brand", ref: "netlify.com", facts: [], note: "Look again" }]);
  });
});

describe("U4 · the engine's verdict on real golden-set rows", () => {
  it("a pitch never changes the plan or what is stored", async () => {
    const a = await build({ withPitches: false }), b = await build();
    expect(b.inserted).toEqual(a.inserted);
    expect(b.res.published).toBe(a.res.published);
  });
  it("already a story → its number; ran → its number; would run → score and rank", async () => {
    const { view } = await build({ dry: true });
    const top = view!.plan.filter(p => p.status === "published").sort((x, y) => y.score - x.score)[0]!;
    // As a stored story (the build before this one stored it)
    const stored: View = { ...view!, stories: [{ id: top.id, state: "published", headline: top.headline, domains: top.domains, signalKeys: top.signalKeys, sourceIds: top.sourceIds, type: top.type }] };
    expect(ask(stored, pitch("receipt", `story:${top.id}`), { [top.id]: 88 })).toMatchObject({ status: "story", number: 88, text: "Already a story: No. 88." });
    // Not stored yet: the desk's dry run says it would run; the build's own run says it ran
    const w = ask(view!, pitch("receipt", `story:${top.id}`));
    expect(w).toMatchObject({ status: "would_run", rank: 1, score: top.score });
    expect(ask({ ...view!, dry: false }, pitch("receipt", `story:${top.id}`), { [top.id]: 89 })).toMatchObject({ status: "ran", number: 89 });
  });
  it("held → the engine's own reason", async () => {
    const { view } = await build({ dry: true });
    const held = view!.plan.find(p => p.status === "held");
    if (!held) return expect(view!.plan.every(p => p.status === "published")).toBe(true);
    expect(ask(view!, pitch("receipt", `story:${held.id}`))).toEqual({ status: "held", candidateId: held.id, score: held.score, reason: held.reason, text: `Held: ${held.reason}` });
  });
  it("refused by the integrity rule: Netlify's change seen once", async () => {
    const seenOnce: Check = { verdict: "seen_once", pass: [], fields: { h1: { verdict: "seen_once", failed: ["two_before"], before: 1, after: 7, beforeHours: 0, afterHours: 9.5, transitions: 1 } } };
    const checks = { ...goldenChecks, 4756: seenOnce, 4757: seenOnce, 4758: seenOnce, 4759: seenOnce };
    const { view } = await build({ dry: true, checks });
    const v = ask(view!, pitch("change", "4756"));
    expect(v).toMatchObject({ status: "refused", rule: "integrity" });
    expect(v.text).toContain("the earlier value was not seen in two captures six hours apart");
  });
});

describe("U4 · verdict paths on a small engine view", () => {
  const base: View = { plan: [], stories: [], unconfirmed: [], rotating: new Set([7]), kindOf: d => (d === "shop.com" ? "merchandised" : "standard"), showcase: d => d === "studio.com", eventDomain: id => (id === 8 ? "studio.com" : null), dry: true };
  it("carousel, showcase, site kind and no candidate each say which rule", () => {
    expect(ask(base, pitch("change", "7"))).toMatchObject({ status: "refused", rule: "carousel" });
    expect(ask(base, pitch("change", "8"))).toMatchObject({ status: "refused", rule: "showcase" });
    expect(ask(base, pitch("brand", "studio.com"))).toMatchObject({ status: "refused", rule: "showcase" });
    expect(ask(base, pitch("brand", "shop.com"))).toMatchObject({ status: "refused", rule: "kinds" });
    expect(ask(base, pitch("signal", "font:serif"))).toMatchObject({ status: "refused", rule: "none" });
  });
  it("a retired story is still a story, marked retired", () => {
    const v = ask({ ...base, stories: [{ id: "brand:a.com:2026-11-20", state: "killed", headline: "A", domains: ["a.com"], signalKeys: [], sourceIds: [], type: "brand" }] }, pitch("brand", "a.com"), { "brand:a.com:2026-11-20": 84 });
    expect(v).toMatchObject({ status: "story", retired: true, text: "Already a story, since retired: No. 84." });
  });
  it("records a verdict only when the answer changed; held and would-run stay open", () => {
    const p = pitch("change", "7");
    const first = verdictsToRecord([p], new Map(), { ...base, numberOf: () => null });
    expect(first).toHaveLength(1);
    expect(verdictsToRecord([p], new Map([[1, `${first[0]!.status}|${first[0]!.verdict.text}`]]), { ...base, numberOf: () => null })).toEqual([]);
    expect([null, "held", "would_run", "story", "ran", "refused"].map(s => isOpen(s as never))).toEqual([true, true, true, false, false, false]);
  });
});
