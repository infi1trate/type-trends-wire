// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { StoredStory, EditRow } from "./edits";
import { overlay } from "./edits";
import { liveModel, queueModel, storyForSource, storyPage, storiesAbout, STORY_BLOCKS } from "./view";
import { OBJECT_BLOCKS, SURFACES, toggleHref } from "../ia";
import { handleDesk, type DeskDeps } from "./desk.server";
import { gate, isOpenPath } from "../gate";
import { createRateLimiter } from "../mcp/rate-limit";
import { StoryView } from "@/components/read/StoryView";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const story = (o: Partial<StoredStory>): StoredStory => ({ id: "move:1", type: "move", status: "published", reason: "ran", score: 60, components: { size: { value: 15, why: "2 fields changed" }, brand: { value: 20, why: "trendsetter #12" }, novelty: { value: 15, why: "x" }, relevance: { value: 10, why: "y" } },
  why_ran: "Score 60 against a threshold of 45.", kicker: "Move · Color · Fintech", headline: "a.com changed its accent", deck: "Blue → Red. Confirmed 12 Nov.", facts: [{ text: "Before: Blue", href: "/brands/a.com", basis: "measured", kind: "before" }, { text: "After: Red", href: "/brands/a.com", basis: "measured", kind: "after" }, { text: "Confirmed on a second capture, 12 Nov", href: "/library/a.com", basis: "measured", kind: "date" }],
  why_line: null, why_model: null, why_at: null, sector: "fintech", signal_keys: [], domains: ["a.com"], evidence: [{ label: "Brand page", href: "/brands/a.com" }], source_ids: ["event:1"], basis: "measured", happened_at: "2026-11-15T10:00:00Z", created_at: "2026-11-15T11:00:00Z", ...o });
const edit = (id: number, story_id: string, action: EditRow["action"], payload: Record<string, unknown> = {}, at = "2026-11-16T01:00:00Z"): EditRow => ({ id, story_id, action, payload, note: null, at });

describe("story page", () => {
  it("renders headline → evidence → so what → related, with before/after and why-this-ran", async () => {
    const [s] = overlay([story({})], [], NOW);
    const page = { ...storyPage(s!, { earlier: [], soWhat: "One brand's change is a data point.", patterns: [] }), thumb: null, series: null };
    expect(page.blocks).toEqual(OBJECT_BLOCKS); expect(STORY_BLOCKS).toEqual(OBJECT_BLOCKS);
    const root = createRootRoute({ component: () => createElement(StoryView, { s: page }) });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/stories/move%3A1"] }) });
    await router.load();
    const html = renderToString(createElement(RouterProvider, { router } as never));
    expect([...html.matchAll(/data-block="([a-z-]+)"/g)].map(m => m[1])).toEqual(["headline", "evidence", "so-what", "related"]);
    expect(html).toContain("Before → after"); expect(html).toContain("Why this ran"); expect(html).not.toContain("$");
  });
  it("uses the stored AI line with its chip, or the deterministic so-what", () => {
    const [ai] = overlay([story({ why_line: "Worth watching.", why_model: "m", why_at: "2026-11-15T11:00:00Z" })], [], NOW);
    expect(storyPage(ai!, { earlier: [], soWhat: "fallback", patterns: [] }).soWhat).toMatchObject({ text: "Worth watching.", basis: "ai" });
    const [plain] = overlay([story({})], [], NOW);
    expect(storyPage(plain!, { earlier: [], soWhat: "fallback", patterns: [] }).soWhat).toMatchObject({ text: "fallback", basis: "measured" });
  });
  it("is gated (not an open path) and registered in ia.ts; backtick goes to Terminal › Live › Today focused", async () => {
    expect(isOpenPath("/stories/move:1")).toBe(false); expect(isOpenPath("/desk")).toBe(false);
    const r = await gate(new Request("https://site.test/stories/move%3A1"), { hash: "x".repeat(64), allow: createRateLimiter(100, 60000) });
    expect(r?.status).toBe(401);
    expect(SURFACES["stories.$id"]?.section).toBe("live"); expect(SURFACES["desk"]?.status).toBe("quiet");
    expect(toggleHref("/stories/move%3A1")).toBe("/terminal?panel=today&story=move%3A1");
    expect(toggleHref("/terminal", { panel: "today", story: "move:1" })).toBe("/stories/move%3A1");
  });
});

describe("Live and related from stored stories", () => {
  const all = () => overlay([
    story({ id: "move:1", score: 60, happened_at: "2026-11-16T08:00:00Z" }),
    story({ id: "move:2", score: 90, domains: ["b.com"], happened_at: "2026-11-16T09:00:00Z", source_ids: ["event:2"] }),
    story({ id: "news:3", type: "news", score: 70, sector: null, domains: ["a.com"], happened_at: "2026-11-16T10:00:00Z", source_ids: ["wire:3"] }),
    story({ id: "move:4", status: "held", reason: "over the daily cap of 24 stories", happened_at: "2026-11-16T07:00:00Z", source_ids: ["event:4"] }),
    story({ id: "roundup:x", type: "roundup", score: 50, domains: ["c.com", "d.com", "e.com"], source_ids: ["story:move:5"], happened_at: "2026-11-14T00:00:00Z" }),
    story({ id: "move:5", score: 80, domains: ["c.com"], source_ids: ["event:5"], happened_at: "2026-11-13T00:00:00Z" }),
    story({ id: "launch:9", type: "launch", sector: null, domains: [], happened_at: "2026-11-16T11:00:00Z" }),
  ], [edit(1, "move:1", "pin", { until: "2026-11-17T00:00:00Z" })], NOW);
  it("a pinned story leads; held, folded and launch stories stay out of the stream; launches go to New on the scene", () => {
    const l = liveModel(all(), { sector: "all", page: 0, type: "all", now: NOW });
    expect(l.lead?.id).toBe("move:1"); expect(l.leadPinned).toBe(true);
    expect(l.stories.map(s => s.id)).toEqual(["news:3", "move:2", "roundup:x"]);
    expect(l.launches.map(s => s.id)).toEqual(["launch:9"]);
  });
  it("without a pin the best of the last 48 hours leads; type chips filter", () => {
    const l = liveModel(all().map(s => ({ ...s, pinnedUntil: null })), { sector: "all", page: 0, type: "news", now: NOW });
    expect(l.lead?.id).toBe("move:2"); expect(l.stories.map(s => s.id)).toEqual(["news:3"]); expect(l.counts.moves).toBe(2);
  });
  it("killed stories disappear; brand timeline links reach the story or the roundup holding it", () => {
    const killed = overlay([story({ id: "move:1" })], [edit(2, "move:1", "kill", { reason: "wrong" })], NOW);
    expect(liveModel(killed, { sector: "all", page: 0, type: "all", now: NOW }).lead).toBeNull();
    const map = storyForSource(all());
    expect(map.get("event:2")).toBe("move:2"); expect(map.get("event:5")).toBe("roundup:x"); expect(map.has("event:4")).toBe(false);
    expect(storiesAbout(all(), { domain: "a.com" }).map(s => s.id)).toEqual(["news:3", "move:1"]);
  });
  it("the queue shows ran, held and killed with reasons", () => {
    const q = queueModel(all(), null, NOW);
    expect(q.held.map(s => s.id)).toEqual(["move:4"]); expect(q.held[0]!.reason).toContain("daily cap");
    expect(q.edits[0]).toMatchObject({ story: "move:1", action: "pin" });
  });
});

describe("desk endpoint", () => {
  const deps = (o: Partial<DeskDeps> = {}) => {
    const edits: unknown[] = [];
    const d: DeskDeps = { authorize: async r => r.headers.get("authorization") === "Bearer good", allow: () => true, now: () => NOW,
      store: { exists: async id => id === "move:1", insertEdit: async e => { edits.push(e); return { id: edits.length, at: new Date(NOW).toISOString(), ...e }; }, queue: async () => ({ ok: "queue" }) }, ...o };
    return { d, edits };
  };
  const post = (body: unknown, auth = "Bearer good") => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) });
  it("401 without the key, before reading the body", async () => {
    const { d, edits } = deps();
    expect((await handleDesk(new Request("https://site.test/api/public/desk", { method: "POST", body: "{}" }), d)).status).toBe(401);
    expect((await handleDesk(post({ action: "kill", id: "move:1", reason: "nope" }, "Bearer bad"), d)).status).toBe(401);
    expect(edits).toEqual([]);
  });
  it("rate limits per IP", async () => {
    const { d } = deps({ allow: () => false });
    expect((await handleDesk(post({ action: "queue" }), d)).status).toBe(429);
  });
  it("queue, pin, kill, correct, restore write only edits", async () => {
    const { d, edits } = deps();
    expect(await (await handleDesk(post({ action: "queue" }), d)).json()).toEqual({ ok: "queue" });
    expect((await handleDesk(post({ action: "pin", id: "move:1", until: "2026-11-17T12:00:00Z" }), d)).status).toBe(201);
    expect((await handleDesk(post({ action: "kill", id: "move:1", reason: "duplicate" }), d)).status).toBe(201);
    expect((await handleDesk(post({ action: "correct", id: "move:1", headline: "a.com changed its accent to red" }), d)).status).toBe(201);
    expect((await handleDesk(post({ action: "restore", id: "move:1" }), d)).status).toBe(201);
    expect(edits.map(e => (e as { action: string }).action)).toEqual(["pin", "kill", "correct", "restore"]);
    expect((edits[0] as { payload: unknown }).payload).toEqual({ until: "2026-11-17T12:00:00.000Z" });
  });
  it("rejects bad input: unknown story, past or far pins, empty corrections, $", async () => {
    const { d, edits } = deps();
    expect((await handleDesk(post({ action: "kill", id: "nope:1", reason: "x y z" }), d)).status).toBe(404);
    expect((await handleDesk(post({ action: "pin", id: "move:1", until: "2026-11-01T00:00:00Z" }), d)).status).toBe(400);
    expect((await handleDesk(post({ action: "pin", id: "move:1", until: "2026-12-30T00:00:00Z" }), d)).status).toBe(400);
    expect((await handleDesk(post({ action: "correct", id: "move:1" }), d)).status).toBe(400);
    expect((await handleDesk(post({ action: "correct", id: "move:1", headline: "Costs $5" }), d)).status).toBe(400);
    expect(edits).toEqual([]);
  });
});

vi.mock("./read.server", () => ({ storyIndex: vi.fn(async () => overlay([
  story({ id: "move:1" }), story({ id: "shift:headline:serif:13", type: "shift", sector: null, domains: [], signal_keys: ["headline:serif"], why_line: "Serif headlines are moving.", why_model: "m", why_at: "2026-11-15T00:00:00Z" }),
  story({ id: "move:7", status: "held" }),
], [], NOW)) }));
describe("MCP stories tool", () => {
  it("returns published stories with facts, why line basis, score and urls", async () => {
    const { handleMcp } = await import("../mcp/server.server");
    const res = await handleMcp(new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": "stories-test" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "stories", arguments: { type: "shift" } } }) }));
    const out = JSON.parse((await res.json()).result.content[0].text);
    expect(out.matched).toBe(1);
    expect(out.stories[0]).toMatchObject({ id: "shift:headline:serif:13", why_it_matters: { text: "Serif headlines are moving.", basis: "ai" }, score: 60 });
    expect(out.stories[0].url).toMatch(/\/stories\/shift%3Aheadline%3Aserif%3A13$/);
    expect(JSON.stringify(out)).not.toMatch(/\$[A-Z]/);
  });
});
