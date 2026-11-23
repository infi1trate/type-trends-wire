// N5 · the five review fixes (A1–A5) and the publisher and scout desks (B1, B2), with the times of 22 Nov 2026 (UTC).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doorHeld, holdInForce, passHeldBy, waitsOf, PASS_HOLD, WAIT_PASSES_MAX } from "./holds";
import { offerAgain } from "./chief";
import { factsHash, runDesks, type PendingStory, type ReviewIO, type ReviewRow } from "./review";
import { checklist, type ReviewInput } from "./standards";
import { HOLD_JOBS, holdNames } from "./passes";
import { flatShareFailures, FLAT_BAD_EXAMPLE } from "../stories/writer";
import { handleDesk, type DeskDeps } from "../stories/desk.server";
import type { LogRow } from "./log";
import * as pub from "./publisher";
import * as sc from "./scout";
import { WEEKLY_LIMITS } from "./caps";
import fx from "./__fixtures__/standards-cases.json";

type Case = { number: number; expect: "hold" | "pass"; id: string; input: ReviewInput };
const cases = (fx as unknown as { cases: Case[] }).cases;
const pass42 = cases.find(c => c.number === 42)!.input, pass43 = cases.find(c => c.number === 43)?.input ?? cases.filter(c => c.expect === "pass")[1]!.input;
const ID = "crossover:tone:calm:media:16";
const hold = (at: string, desk: string, o: { pass?: boolean } = {}) => ({ id: Date.parse(at) / 1000, action: "kill", payload: { hold: true, desk, reason: "r", ...(o.pass ? { pass: PASS_HOLD } : {}) }, note: "Held: r", at });

describe("A1 · a hold must stay held", () => {
  it("the editor in chief's hold through the door at 12:39:22 is a door hold: no review pass offers it", () => {
    // 12:16:15 the editor in chief's own placement call held it (review row and hold edit together); 12:39:22 the owner's session held it
    // through the door as the editor in chief.
    const reviews = [{ desk: "editor in chief", verdict: "hold", at: "2026-11-22T12:16:15Z" }];
    const passHold = hold("2026-11-22T12:16:15Z", "editor in chief");
    expect(doorHeld([passHold], reviews)).toBe(false);
    expect(passHeldBy([passHold], reviews, "editor in chief")).toBe(true);
    const restore = { id: 1, action: "restore", payload: {}, note: "placed in engine order (no decision to make)", at: "2026-11-22T12:16:25Z" };
    const doorHold = hold("2026-11-22T12:39:22Z", "editor in chief");
    expect(doorHeld([passHold, restore, doorHold], reviews)).toBe(true);
    expect(passHeldBy([passHold, restore, doorHold], reviews, "editor in chief")).toBe(false);
  });
  it("a hold marked as a review pass's own stays the pass's; only a restore ends a hold", () => {
    expect(doorHeld([hold("2026-11-22T13:00:00Z", "editor in chief", { pass: true })], [])).toBe(false);
    const h = hold("2026-11-22T12:39:22Z", "owner"), r = { id: 2, action: "restore", payload: {}, note: null, at: "2026-11-22T14:00:00Z" };
    expect(holdInForce([h])).toBe(h);
    expect(holdInForce([h, r])).toBeNull();
    expect(doorHeld([h, r], [])).toBe(false);
  });
  it("an editor's own hold stands for the rest of its UTC day, then is offered once on each of the next two days", () => {
    const h = "facts-1";
    expect(offerAgain([{ day: "2026-11-22", facts_hash: h }], h, "2026-11-22")).toBe(false);
    expect(offerAgain([{ day: "2026-11-22", facts_hash: h }], h, "2026-11-23")).toBe(true);
    expect(offerAgain([{ day: "2026-11-22", facts_hash: h }, { day: "2026-11-23", facts_hash: h }], h, "2026-11-23")).toBe(false);
    expect(offerAgain([{ day: "2026-11-22", facts_hash: h }, { day: "2026-11-23", facts_hash: h }], h, "2026-11-24")).toBe(true);
    const three = [{ day: "2026-11-22", facts_hash: h }, { day: "2026-11-23", facts_hash: h }, { day: "2026-11-24", facts_hash: h }];
    expect(offerAgain(three, h, "2026-11-25")).toBe(false);
    expect(offerAgain(three, "facts-2", "2026-11-25")).toBe(true);
  });
});

// A fake review pass with a clock that can move (a call takes time).
const NOW = Date.parse("2026-11-22T12:53:00Z");
const pend = (id: string, score = 50): PendingStory => ({ id, type: "crossover", basis: "measured", score, components: { size: 10, brand: 10, novelty: 10, relevance: 20, total: 50 }, happened_at: "2026-11-22T10:00:00Z", created_at: "2026-11-22T10:45:00Z", domains: ["a.com", "b.com", "c.com"], drafted: true });
function fake(o: { pending?: PendingStory[]; inputs: Record<string, ReviewInput>; reoffers?: PendingStory[]; chiefHolds?: Map<string, { day: string; facts_hash: string }[]>; readerMs?: number; waits?: number }) {
  const rows: ReviewRow[] = [], door: { actor: string; body: Record<string, unknown> }[] = [];
  let clock = NOW;
  const io: ReviewIO = {
    now: () => clock, pending: async () => o.pending ?? [], rechecks: async () => [], writerOut: async () => false, input: async id => o.inputs[id] ?? null,
    lastStandards: async () => new Map(), callsToday: async () => 0,
    secondReader: async () => { clock += o.readerMs ?? 0; return { problems: [], call_id: 1 }; },
    chief: async (_ci, ids) => ({ answer: { lead: "", order: ids, holds: [] }, call_id: 2 }),
    frontDay: async () => ({ leadOpen: false, leads: [], slots: new Map(), beats: "" }), chiefHolds: async () => o.chiefHolds ?? new Map(), reoffers: async () => o.reoffers ?? [],
    record: async r => { rows.push(...r); }, door: async (actor, body) => { door.push({ actor, body }); return { ok: true, status: 201 }; }, promptVersion: () => "v",
    waits: async ids => new Map(ids.map(id => [id, o.waits ?? 0])),
  };
  return { io, rows, door };
}
describe("A1 · no decision to make never releases an editor's hold", () => {
  it("one waiting story with an editor hold stays held (13:00, 23 Nov: offered again, alone)", async () => {
    const i = { ...pass42, id: ID };
    const f = fake({ inputs: { [ID]: i }, reoffers: [pend(ID)], chiefHolds: new Map([[ID, [{ day: "2026-11-22", facts_hash: factsHash(i) }]]]) });
    f.io.now = () => Date.parse("2026-11-23T13:00:00Z");
    const sum = await runDesks(f.io, { deadline: Date.parse("2026-11-23T13:00:40Z") });
    expect(sum.chief).toBe("no decision");
    expect(sum.kept).toEqual([ID]);
    expect(f.door.filter(d => d.body["action"] === "restore")).toEqual([]);
  });
  it("on the day of the editor's own hold the story is not offered at all", async () => {
    const i = { ...pass42, id: ID };
    const f = fake({ inputs: { [ID]: i }, reoffers: [pend(ID)], chiefHolds: new Map([[ID, [{ day: "2026-11-22", facts_hash: factsHash(i) }]]]) });
    const sum = await runDesks(f.io, { deadline: NOW + 40_000 });
    expect(sum.chief).toBe("none");
    expect(f.door).toEqual([]);
  });
});

describe("A2 · when time runs out, the story waits", () => {
  const a = { ...pass42, id: "breakout:css:starting_style:fintech:16" }, b = { ...pass42, id: "shift:css:starting_style:16" };
  it("no time for the second reader: the story waits for the next pass (nothing recorded, nothing released)", async () => {
    const f = fake({ pending: [pend(a.id)], inputs: { [a.id]: a } });
    const sum = await runDesks(f.io, { deadline: NOW + 8_000 });
    expect(sum.waiting).toEqual([a.id]);
    expect(sum.released).toEqual([]);
    expect(f.rows).toEqual([]);
  });
  it("after waiting six passes it runs without the second reader, and its history says so", async () => {
    const f = fake({ pending: [pend(a.id)], inputs: { [a.id]: a }, waits: WAIT_PASSES_MAX });
    const sum = await runDesks(f.io, { deadline: NOW + 8_000 });
    expect(sum.released).toEqual([a.id]);
    expect(f.rows[0]).toMatchObject({ desk: "standards", verdict: "pass", second_reader: "time ran out" });
    expect(String(f.rows[0]!.reason)).toContain("after waiting six passes");
  });
  it("no time for the editor in chief: both stories wait with their standards pass; after six passes engine order stands", async () => {
    const f = fake({ pending: [pend(a.id, 60), pend(b.id, 50)], inputs: { [a.id]: a, [b.id]: b }, readerMs: 25_000 });
    const sum = await runDesks(f.io, { deadline: NOW + 40_000 });
    expect(sum.chief).toBe("time ran out");
    expect(sum.passed.sort()).toEqual([a.id, b.id].sort());
    expect(sum.released).toEqual([]);
    expect(f.door.filter(d => d.body["action"] === "restore")).toEqual([]);
    const g = fake({ pending: [pend(a.id, 60), pend(b.id, 50)], inputs: { [a.id]: a, [b.id]: b }, readerMs: 25_000, waits: WAIT_PASSES_MAX });
    const s2 = await runDesks(g.io, { deadline: NOW + 40_000 });
    expect(s2.released).toEqual([a.id, b.id]);
    expect(String(g.door.find(d => d.body["action"] === "restore")!.body["note"])).toContain("without the editor in chief: time ran out after waiting six passes");
  });
  it("waits count the earlier passes' finish rows since the story's newest review", () => {
    const fin = [{ at: "2026-11-22T12:13:40Z", waiting: [a.id] }, { at: "2026-11-22T12:18:40Z", waiting: [a.id, b.id] }, { at: "2026-11-22T12:23:40Z", waiting: [] }];
    expect(waitsOf(fin, a.id)).toBe(2);
    expect(waitsOf(fin, a.id, "2026-11-22T12:15:00Z")).toBe(1);
  });
});

describe("A3 · a freeze for deploys", () => {
  it("job_hold takes review and stories; review and the N4b name reviews hold the same passes", () => {
    for (const j of ["review", "stories", "reviews"]) expect(HOLD_JOBS).toContain(j);
    expect(holdNames("review")).toEqual(["review", "reviews"]);
    expect(holdNames("stories")).toEqual(["stories"]);
  });
  it("the health route returns the running build's short commit", () => {
    const src = readFileSync("src/routes/api/public/health.ts", "utf8");
    expect(src).toContain("build");
  });
});

describe("A4 · steady is not flat", () => {
  const n94 = ["Immersive 3D: 16.7% of tracked fintech homepages, steady, momentum 1.6 points a quarter", "Immersive 3D: 9.4% of tracked homepages, gaining ground, momentum 0.4 points a quarter"];
  it("refuses No. 94's sentence: fintech's momentum is 1.6 points a quarter", () => {
    expect(flatShareFailures(FLAT_BAD_EXAMPLE, n94)).toEqual(["a moving share called flat: the facts give its momentum as 1.6 points a quarter"]);
    expect(flatShareFailures("In fintech its share is stable.", n94)).toHaveLength(1);
    expect(flatShareFailures("Across tracked homepages the share is flat.", n94)).toEqual([]);
  });
  it("either direction counts; under 0.5 points a quarter does not", () => {
    expect(flatShareFailures("Its share is unchanged.", ["X: 12% of tracked homepages, cooling, momentum -0.7 points a quarter"])).toHaveLength(1);
    expect(flatShareFailures("Its share is level.", ["X: 12% of tracked homepages, flat, momentum 0.4 points a quarter"])).toEqual([]);
  });
  it("reads the clause that calls the share flat (No. 42); the facts' stage key “flat” (shown as Steady) is no excuse (Nos. 43 and 94)", () => {
    const n42 = ["Logo walls: 127 of 281 tracked homepages with an AI read (45.2%), flat, momentum 0.4 points a quarter", "Logo walls: 8 of 29 tracked Consumer apps homepages with an AI read (27.6%), accelerating, momentum 1.3 points a quarter"];
    expect(flatShareFailures("Logo walls are getting more common on consumer app homepages, while their share across tracked homepages is roughly flat.", n42)).toEqual([]);
    expect(flatShareFailures("Its share was flat.", ["Scroll-driven animation: 88 of 300 tracked homepages in the latest quarter (29.3%), flat, momentum 1.3 points a quarter"])).toHaveLength(1);
    // No. 94's rewrite of 22 Nov 13:45 UTC, which the first version of this check let through because its sheet line says "flat".
    expect(flatShareFailures("Immersive 3D is emerging across the full set of homepages, but its share in fintech is flat.", ["Immersive 3D: 28 of 299 tracked homepages in the latest quarter (9.4%), emerging, momentum 0.4 points a quarter", "Immersive 3D: 5 of 30 tracked Fintech homepages in the latest quarter (16.7%), flat, momentum 1.6 points a quarter"])).toHaveLength(1);
  });
  it("newsroom/style.md carries the rule with No. 94's sentence as the bad example", () => {
    expect(readFileSync("newsroom/style.md", "utf8")).toContain(FLAT_BAD_EXAMPLE);
  });
});

describe("A5 · a published story is checked against what it was published with", () => {
  it("No. 85's “13 of 30” passes against its text as written, though the live count is now 15 of 30", () => {
    const base = { ...pass42, body: ["Netlify changed its homepage; 13 of 30 tracked dev tools brands now show it."], facts: [], numbers: [] } as ReviewInput;
    const live = { ...base, sheet: base.sheet ? { ...base.sheet, numbers: [{ text: "15 of 30 tracked dev tools brands", basis: "measured" as const }], lines: [] } : null };
    expect(checklist({ ...live, state: "held" }).find(x => x.id === "numbers")?.result).toBe("fail");
    const asWritten = { at: "2026-11-22T06:15:27Z", checked: true, sheet: null, text: { headline: base.headline, deck: base.deck ?? "", body: base.body } };
    expect(checklist({ ...live, state: "published", asWritten }).find(x => x.id === "numbers")?.result).toBe("pass");
  });
});

// B · the door's new actions.
const mk = (o: { draft?: string; candidate?: string } = {}) => {
  const logs: LogRow[] = [], calls: Record<string, unknown[]> = {};
  const rec = (k: string) => async (r: unknown) => { (calls[k] ??= []).push(r); return k === "audience" ? { id: 9, replaces: null } : k === "sourceNote" ? { id: 3 } : { status: (r as { status: string }).status }; };
  const d: DeskDeps = { authorize: async () => true, allow: () => true, now: () => NOW,
    store: { log: async r => { logs.push(r); }, exists: async () => true, queue: async () => ({}), insertEdit: async e => ({ id: 1, at: "x", ...e }) as never, capReached: async () => false,
      draftStatus: async r => { const prob = pub.draftMoveProblem((o.draft ?? "draft") as pub.DraftStatus, r.status as pub.DraftStatus); return prob ? { refused: prob } : rec("draftStatus")(r) as never; },
      audience: rec("audience") as never, sourceNote: rec("sourceNote") as never,
      candidateStatus: async r => { const prob = sc.candidateMoveProblem((o.candidate ?? "proposed") as sc.CandidateStatus, r.status as sc.CandidateStatus, r.actor); return prob ? { refused: prob } : rec("candidateStatus")(r) as never; } } };
  return { d, logs, calls };
};
const post = (body: unknown) => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer k" }, body: JSON.stringify(body) });
describe("B · the publisher's and scout's door actions", () => {
  it("draft_status needs the owner and the phrase, and follows draft → approved → posted, or declined", async () => {
    expect((await handleDesk(post({ actor: "publisher", action: "draft_status", draft: 1, status: "approved" }), mk().d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "owner", action: "draft_status", draft: 1, status: "approved" }), mk().d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "owner", confirm: "owner confirms draft_status", action: "draft_status", draft: 1, status: "approved" }), mk().d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "owner", confirm: "owner confirms draft_status", action: "draft_status", draft: 1, status: "posted" }), mk().d)).status).toBe(409);
    expect((await handleDesk(post({ actor: "owner", confirm: "owner confirms draft_status", action: "draft_status", draft: 1, status: "posted" }), mk({ draft: "approved" }).d)).status).toBe(201);
  });
  it("audience ships alone for the publisher: counts only, at most 20 paths and 10 sources", async () => {
    const body = { action: "audience", week: "2026-W47", visitors: 10, pageviews: 30, top: [{ path: "/stories/no/94", views: 4 }], sources: [{ name: "direct", visits: 6 }], test: true };
    const m = mk();
    expect((await handleDesk(post({ actor: "publisher", ...body }), m.d)).status).toBe(201);
    expect(m.calls["audience"]![0]).toMatchObject({ week: "2026-W47", test: true, actor: "publisher" });
    expect((await handleDesk(post({ actor: "news", ...body }), mk().d)).status).toBe(403);
    expect((await handleDesk(post({ actor: "publisher", ...body, top: Array.from({ length: 21 }, (_, i) => ({ path: `/p${i}`, views: 1 })) }), mk().d)).status).toBe(400);
    expect((await handleDesk(post({ actor: "publisher", ...body, email: "x@y.z" }), mk().d)).status).toBe(400);
  });
  it("source_note is the scout's, for a source in the register", async () => {
    expect((await handleDesk(post({ actor: "scout", action: "source_note", source: "dribbble", status: "closed by its terms", read_on: "2026-11-20", note: "No automated collection." }), mk().d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "scout", action: "source_note", source: "pinterest", status: "read", note: "Not in the register." }), mk().d)).status).toBe(400);
    expect((await handleDesk(post({ actor: "data", action: "source_note", source: "dribbble", status: "off", note: "Not the scout." }), mk().d)).status).toBe(403);
  });
  it("candidate_status: the owner accepts or declines; engineering only marks an accepted candidate added", async () => {
    expect((await handleDesk(post({ actor: "engineering", action: "candidate_status", candidate: 1, status: "accepted" }), mk().d)).status).toBe(409);
    expect((await handleDesk(post({ actor: "owner", action: "candidate_status", candidate: 1, status: "accepted" }), mk().d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "engineering", action: "candidate_status", candidate: 1, status: "added" }), mk().d)).status).toBe(409);
    expect((await handleDesk(post({ actor: "engineering", action: "candidate_status", candidate: 1, status: "added" }), mk({ candidate: "accepted" }).d)).status).toBe(201);
    expect((await handleDesk(post({ actor: "scout", action: "candidate_status", candidate: 1, status: "accepted" }), mk().d)).status).toBe(403);
  });
  it("the weekly limits: publisher drafts 2 a day, scout candidates 1 a day", () => {
    expect(WEEKLY_LIMITS.map(l => `${l.desk}:${l.purpose}:${l.cap}`)).toEqual(["publisher:drafts:2", "scout:candidates:1"]);
  });
});

describe("B1 · the publisher's package check and drafts", () => {
  const ok = { status: 200, type: "image/png", bytes: 60_000 };
  const rss = (link: string) => ({ status: 200, body: `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><item><title>a &amp; b</title><link>${link}</link></item></channel></rss>` });
  const issue: pub.PackageIssue = { week: "2026-W46", number: 1, words: 540, rows: [1, 2, 3, 4, 5].map(n => ({ href: `/stories/no/${n}`, picture: n <= 3 })), chart: { href: "/stories/no/1" }, cover: { id: "a", href: "/stories/no/1", subject: "Netlify" }, links: [] };
  const input = (o: Partial<pub.PackageInput> = {}): pub.PackageInput => ({ now: NOW, closed: true, issue, share: ok, cover: { status: 200 }, digestRss: rss("https://slug.global/digest/2026-W46"), morningRss: rss("https://slug.global/morning/2026-11-21"), morningNewest: "2026-11-21", links: [{ path: "/digest/2026-W46", status: 200 }], ...o });
  it("every item passes for a sound issue", () => {
    const items = pub.packageChecks(input());
    expect(items.map(i => i.id)).toEqual(pub.PACKAGE_ITEMS.map(i => i.id));
    expect(pub.packagePassed(items)).toBe(true);
  });
  it("names what fails: 600 words, two pictures, an old first item, a broken link, a malformed feed", () => {
    const items = pub.packageChecks(input({ issue: { ...issue, words: 600, rows: issue.rows.map((r, i) => ({ ...r, picture: i < 2 })), picturesAvailable: 5 }, digestRss: rss("https://slug.global/digest/2026-W45"), morningRss: { status: 200, body: "<rss><channel><item></channel></rss>" }, links: [{ path: "/what-we-show", status: 404 }] }));
    expect(items.filter(i => !i.ok).map(i => i.id)).toEqual(["words", "pictures", "digest_rss", "morning_rss", "links"]);
  });
  it("issueLinks lists the issue's internal links once each", () => {
    const l = pub.issueLinks({ week: "2026-W46", cover: { id: "a", number: 1 }, rows: [{ href: "/stories/no/1" }, { href: "/stories/no/2" }], chart: { storyId: "a", number: 1 }, numbers: [{ href: "/terminal?panel=library#seen-once" }], corrections: { href: "/what-we-show#ed-w-story" }, keep: [{ href: "https://example.com" }] });
    expect(l).toEqual(["/digest/2026-W46", "/stories/no/1", "/stories/no/2", "/terminal?panel=library", "/what-we-show", "/digest/archive", "/digest/rss.xml", "/digest/2026-W46.png"]);
  });
  const sheet: pub.DraftSheet = { week: "2026-W46", digest: { kind: "digest", link: pub.digestLink("2026-W46"), headline: "Calm voices", deck: "Media sites turned calm.", facts: ["Calm tone is on 17.9% of media homepages, up from 8.3%."] },
    stories: [{ kind: "story", id: "s", number: 94, link: pub.storyLink(94), headline: "Fintech goes 3D", deck: null, facts: ["Immersive 3D: 16.7% of tracked fintech homepages, steady, momentum 1.6 points a quarter"] }] };
  it("keeps a sound draft with its link and drops what breaks a rule, saying why", () => {
    const e = pub.enforceDrafts({ drafts: [
      { target: "digest", story: null, text: "Calm tone is on 17.9% of media homepages." },
      { target: "digest", story: null, text: "Calm tone went from 8.3% to 17.9% of media homepages." },
      { target: "digest", story: null, text: "Calm tone is everywhere 🎉" },
      { target: "story", story: 94, text: "In fintech it’s more common, but its share is flat." },
      { target: "story", story: 12, text: "Something else." },
      { target: "digest", story: null, text: "Calm tone is on 21% of media homepages." },
    ] }, sheet);
    expect(e.kept.map(k => k.body)).toEqual(["Calm tone is on 17.9% of media homepages. https://slug.global/digest/2026-W46"]);
    const why = e.dropped.map(d => d.reasons[0]);
    expect(why[0]).toBe("2 numbers (at most one)");
    expect(why[1]).toBe("an emoji");
    expect(why[2]).toContain("a moving share called flat");
    expect(why[3]).toContain("not one of the week's led stories");
    expect(e.dropped[4]!.reasons).toContain("number not on its facts: 21");
    const four = pub.enforceDrafts({ drafts: Array.from({ length: 4 }, () => ({ target: "digest" as const, story: null, text: "Calm tone is on 17.9% of media homepages." })) }, sheet);
    expect(four.kept).toHaveLength(3);
    expect(four.dropped[0]!.reasons).toEqual(["more than 3 Digest drafts"]);
  });
  it("a draft over 280 characters with its link is dropped; two hashtags are too many", () => {
    expect(pub.draftFailures("x ".repeat(130).trim() + " more words here to pass it", sheet.digest).join()).toContain("characters with its link");
    expect(pub.draftFailures("Calm voices #design #web", sheet.digest)).toContain("2 hashtags (at most 1)");
  });
  it("audience: the newest entry for a week is shown; a test is shown only when no real entry exists", () => {
    const row = (id: number, week: string, test = false): pub.AudienceRow => ({ id, at: "", week, visitors: id, pageviews: id, top: [], sources: [], test });
    expect(pub.audienceFor([row(1, "2026-W47"), row(2, "2026-W47")], "2026-W47")!.id).toBe(2);
    expect(pub.audienceFor([row(1, "2026-W47"), row(3, "2026-W47", true)], "2026-W47")!.id).toBe(1);
    expect(pub.audienceFor([row(3, "2026-W47", true)], "2026-W47")!.id).toBe(3);
    expect(pub.weekBefore("2026-W47")).toBe("2026-W46");
  });
  it("there is no posting code: nothing in the publisher's files calls an outside service", () => {
    for (const f of ["src/lib/newsroom/publisher.ts", "src/lib/newsroom/publisher.server.ts"]) expect(readFileSync(f, "utf8")).not.toMatch(/api\.(twitter|x|bsky|linkedin|threads)|statuses\/update|createRecord|\/v2\/tweets/i);
  });
});

describe("B2 · the scout's register and candidates", () => {
  it("the register holds every source the code reads and the closed list, never an invented terms date or link", () => {
    const by = new Map(sc.SOURCES.map(s => [s.name, s]));
    for (const n of ["Dezeen", "Hacker News", "Bluesky accounts", "Google Fonts", "GitHub indicators", "npm indicators", "Product Hunt", "Wayback Machine"]) expect(by.get(n)?.status).toBe("read");
    for (const n of ["Figma Community", "Canva", "TikTok organic posts", "Instagram organic posts", "Dribbble", "Behance", "Mobbin", "Land-book", "Awwwards", "Fonts In Use", "LinkedIn"]) expect(by.get(n)).toMatchObject({ status: "closed by its terms", terms_read: "2026-11-20", terms_link: sc.NOT_RECORDED });
    expect(by.get("Are.na")).toMatchObject({ status: "off" });
    // W3a · the two museums are the only read sources whose terms the owner read and linked (22 Nov 2026); every other stays not recorded.
    const museums = ["The Metropolitan Museum of Art (Open Access)", "Art Institute of Chicago (Open Access)"];
    // W3d-c · and Apple's App Store charts (terms read 23 Nov 2026).
    expect(sc.SOURCES.filter(s => s.status === "read" && !museums.includes(s.name) && s.id !== "apple-app-store-charts").every(s => s.terms_read === sc.NOT_RECORDED && s.terms_link === sc.NOT_RECORDED)).toBe(true);
    expect(by.get(museums[0]!)).toMatchObject({ status: "read", terms_read: "2026-11-22", terms_link: "https://www.metmuseum.org/policies/terms-and-conditions" });
    expect(by.get(museums[1]!)).toMatchObject({ status: "read", terms_read: "2026-11-22", terms_link: "https://www.artic.edu/terms" });
  });
  it("a terms reading changes only what the register shows", () => {
    const r = sc.registerWithNotes([{ id: 1, at: "2026-11-22T13:00:00Z", source: "dribbble", status: "needs permission", read_on: "2026-11-22", link: "https://dribbble.com/terms", note: "Asks for written permission.", actor: "scout" }]);
    expect(r.find(x => x.id === "dribbble")).toMatchObject({ status: "needs permission", terms_read: "2026-11-22", terms_link: "https://dribbble.com/terms" });
    expect(r.find(x => x.id === "canva")).toMatchObject({ status: "closed by its terms" });
  });
  const sheet: sc.ScoutSheet = { now: "2026-11-22T13:00:00Z", week: "2026-W47", names: [],
    items: [{ ref: "wire:1", kind: "outlet", source: "It's Nice That", title: "Mother Design rebrands Monzo's savings app Plum", excerpt: "A new identity and website for Plum.", date: "2026-11-21", url: "https://www.itsnicethat.com/x" },
      { ref: "wire:2", kind: "launch", source: "Product Hunt", title: "Glyphs 4", excerpt: "Type design tool", date: "2026-11-20", url: "https://glyphsapp.com" }] };
  const opts = { tracked: new Set(["monzo.com", "netlify.com"]), optedOut: new Set(["optout.com"]), proposed: new Set(["seen.com"]), outlets: new Set(["itsnicethat.com"]) };
  it("keeps a well-formed, untracked candidate whose name is in its item; drops the rest with every reason", () => {
    const e = sc.enforceCandidates({ candidates: [
      { name: "Plum", website: "https://www.withplum.com/", sector: "fintech", why: "A rebrand and new website.", cites: "wire:1" },
      { name: "Monzo", website: "monzo.com", sector: "fintech", why: "Named.", cites: "wire:1" },
      { name: "Glyphs", website: "glyphsapp.com", sector: "type", why: "A type tool.", cites: "wire:2" },
      { name: "Figma", website: "figma.com", sector: "dev-tools", why: "Tool.", cites: "wire:2" },
      { name: "Acme", website: "not a domain", sector: "ai", why: "Made up.", cites: "wire:9" },
      { name: "Quiet", website: "optout.com", sector: "media", why: "Opted out.", cites: "wire:1" },
    ] }, sheet, opts);
    expect(e.kept).toEqual([{ name: "Plum", domain: "withplum.com", sector: "fintech", why: "A rebrand and new website.", cites: "wire:1" }]);
    const r = new Map(e.dropped.map(d => [d.name, d.reasons]));
    expect(r.get("Monzo")).toContain("monzo.com is already in the library (tracked or inactive)");
    expect(r.get("Glyphs")).toContain("“type” is not one of slug's ten sectors");
    expect(r.get("Figma")!.join()).toContain("not the brand's own website");
    expect(r.get("Acme")).toEqual(["“not a domain” is not a well-formed domain", "it cites “wire:9”, which is not an item it was given"]);
    expect(r.get("Quiet")).toEqual(expect.arrayContaining(["optout.com is on the opt-out list", "the name “Quiet” is not in the item it cites"]));
  });
  it("at most 10 kept and 15 read", () => {
    const many = Array.from({ length: 16 }, (_, i) => ({ name: "Plum", website: `plum${i}.com`, sector: "fintech", why: "Rebrand.", cites: "wire:1" }));
    const e = sc.enforceCandidates({ candidates: many }, sheet, opts);
    expect(e.kept).toHaveLength(10);
    expect(e.dropped.map(d => d.reasons[0])).toEqual([...Array(5).fill("over the 10 kept a week"), "over the 15 the scout may return"]);
  });
  it("candidate moves: proposed → accepted | declined (owner) → added (engineering or owner)", () => {
    expect(sc.candidateMoveProblem("proposed", "accepted", "owner")).toBeNull();
    expect(sc.candidateMoveProblem("proposed", "added", "engineering")).toBe("a proposed candidate cannot become added");
    expect(sc.candidateMoveProblem("accepted", "added", "engineering")).toBeNull();
    expect(sc.candidateMoveProblem("proposed", "declined", "engineering")).toBe("only the owner accepts or declines a candidate");
    expect(sc.candidateMoveProblem("declined", "accepted", "owner")).toBe("a declined candidate cannot become accepted");
  });
  it("domains are read bare", () => {
    expect(sc.domainOf("https://www.Acme.co.uk/about?x=1")).toBe("acme.co.uk");
    expect(sc.domainOf("acme")).toBeNull();
  });
});

// W3d-c Part 5 · Apple's charts in the sources register, as the owner worded it.
import { SOURCES as REGISTERED } from "./scout";
describe("the sources register (W3d-c)", () => {
  it("lists Apple's App Store top charts, read, with its terms date, link, what it takes and the icon note", () => {
    expect(REGISTERED.find(s => s.id === "apple-app-store-charts")).toEqual({ id: "apple-app-store-charts", name: "Apple App Store top charts (US)", status: "read", terms_read: "2026-11-23",
      terms_link: "https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html",
      provides: "Top free apps per category: names, makers, App Store links and icon colours we measure. No icon pictures kept",
      note: "Apple allows app icons only to promote store content, beside a store badge; slug shows none." });
  });
});
