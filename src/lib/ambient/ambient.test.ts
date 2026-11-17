import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DWELL, EMPTY_BOARD_LINE, LEDGER_SIZE, SCENE_IDS, WALL_SIZE, ambientSearch, parseAmbient, playlist, playlistKey, type AmbientInput, type AmbientStory } from "./playlist";
import { BOARD_TYPE, LATE_MS, POINTER_IDLE_MS, TAP_BAR_MS, asOfText, boardKey, boardPoll, feedStart, idle, isLate, pxAt, shiftOf, slabCorner, step, wakeLock, type Feed, type Timers } from "./board";
import { gate, sha256Hex } from "../gate";
import { createRateLimiter } from "../mcp/rate-limit";
import type { Frame } from "../data-stories/types";

const st = (n: number, sector: string | null = "fintech"): AmbientStory => ({ id: `s${n}`, number: n, headline: `Story ${n}`, typeName: "Move", sector, sectorName: sector, at: `2026-11-${String(10 + (n % 9)).padStart(2, "0")}T10:00:00Z`, line: null });
const frame = (at: string): Frame => ({ id: at, at, source: "live", w: 1280, h: 800, bg: "#fff", ink: "#000", accent: null, tones: [], boxes: [["h", 0, 0, 100, 40]], crop: null } as unknown as Frame);
const tile = (k: number) => ({ id: `t${k}`, href: `/brands/b${k}.com`, label: `b${k}`, domain: `b${k}.com`, day: "14 Nov", note: null, size: "sm", frame: null, crop: null }) as never;
function input(over: Partial<AmbientInput> = {}): AmbientInput {
  return {
    now: "2026-11-16T12:00:00Z", today: "2026-11-16", state: "steady", sector: "all", ticker: [], freshness: null,
    lead: { ...st(1), label: "Today", why: "Why it matters." },
    stories: [st(1), st(2, "media"), st(3), st(4, "media"), st(5), st(6, "media"), st(7)],
    chart: { title: "Chart", name: "Big type", note: "Note", points: [{ x: "Q1", y: 0.1 }, { x: "Q2", y: 0.2 }] },
    move: { domain: "neon.com", name: "Neon", text: "neon.com changed its hero", at: "2026-11-14T17:54:00Z", pair: { kind: "before-after", title: "", note: "", domain: "neon.com", name: "Neon", href: "/brands/neon.com", before: frame("2026-11-14T11:41:00Z"), after: frame("2026-11-14T17:54:00Z"), diffs: [] } },
    collection: { slug: "who-went-big", number: 1, title: "Who went big", tiles: Array.from({ length: 14 }, (_, k) => tile(k)) },
    figure: { value: "26%", name: "Subgrid layouts", caption: "Subgrid layouts: 26%.", key: "css:subgrid" },
    data: { slug: "who-went-big-first", number: 2, question: "Who went big first?", key: { n: "181", label: "brands" }, step: { id: "a", caption: ["x"], view: { figure: "f", highlight: [] } } as never, figure: {} as never },
    ...over,
  };
}
const all = { scenes: [...SCENE_IDS], sector: "all" };

describe("ambient playlist", () => {
  it("plays every scene in the default order when all have something to show", () => {
    expect(playlist(input(), all).map(s => s.id)).toEqual(["cover", "ledger", "trail", "pair", "wall", "figure", "data"]);
  });
  it("skips empty scenes: no chart, a one-point chart, a pair without boxes, a wall under twelve tiles", () => {
    const i = input({ chart: { title: "", name: "", note: "", points: [{ x: "Q1", y: 1 }] }, collection: { slug: "c", number: 1, title: "C", tiles: Array.from({ length: WALL_SIZE - 1 }, (_, k) => tile(k)) }, figure: null });
    i.move!.pair.after = { ...i.move!.pair.after, boxes: [] };
    expect(playlist(i, all).map(s => s.id)).toEqual(["cover", "ledger", "data"]);
  });
  it("shows nothing at all when nothing is stored, and has a line in voice for it", () => {
    expect(playlist(input({ lead: null, stories: [], chart: null, move: null, collection: null, figure: null, data: null }), all)).toEqual([]);
    expect(EMPTY_BOARD_LINE).not.toMatch(/oops|sorry/i);
  });
  it("the ledger is five newest stories without the lead; the lens puts its sector first", () => {
    const l = playlist(input(), all).find(s => s.id === "ledger");
    expect(l && l.id === "ledger" && l.stories.map(s => s.id)).toEqual(["s2", "s3", "s4", "s5", "s6"]);
    const m = playlist(input(), { scenes: ["ledger"], sector: "media" })[0];
    expect(m?.id === "ledger" && m.stories.length).toBe(LEDGER_SIZE);
    expect(m?.id === "ledger" && m.stories.slice(0, 3).map(s => s.id)).toEqual(["s2", "s4", "s6"]);
  });
  it("the wall is exactly twelve tiles", () => {
    const w = playlist(input(), all).find(s => s.id === "wall");
    expect(w?.id === "wall" && w.collection.tiles.length).toBe(12);
  });
  it("?scenes= picks and orders scenes", () => {
    expect(playlist(input(), { scenes: ["data", "cover"], sector: "all" }).map(s => s.id)).toEqual(["data", "cover"]);
  });
  it("is deterministic for a given input", () => {
    expect(JSON.stringify(playlist(input(), all))).toBe(JSON.stringify(playlist(input(), all)));
    expect(playlistKey(playlist(input(), all))).toBe(playlistKey(playlist(input(), all)));
    expect(playlistKey(playlist(input({ figure: { value: "27%", name: "x", caption: "x", key: "k" } }), all))).not.toBe(playlistKey(playlist(input(), all)));
  });
});

describe("ambient URL settings", () => {
  it("dwell defaults to 24 and clamps to 10–120", () => {
    expect(parseAmbient({}).dwell).toBe(DWELL.default);
    expect(DWELL.default).toBe(24);
    expect(parseAmbient({ dwell: "3" }).dwell).toBe(10);
    expect(parseAmbient({ dwell: "500" }).dwell).toBe(120);
    expect(parseAmbient({ dwell: "45.4" }).dwell).toBe(45);
    expect(parseAmbient({ dwell: "soon" }).dwell).toBe(24);
    expect(parseAmbient({ dwell: "" }).dwell).toBe(24);
  });
  it("scenes: comma list, unknown dropped, duplicates removed, empty means all", () => {
    expect(parseAmbient({ scenes: "pair, Cover,nope,pair" }).scenes).toEqual(["pair", "cover"]);
    expect(parseAmbient({ scenes: "nope" }).scenes).toEqual([...SCENE_IDS]);
  });
  it("sector: a lens sector or all", () => {
    expect(parseAmbient({ sector: "fintech" }).sector).toBe("fintech");
    expect(parseAmbient({ sector: "nowhere" }).sector).toBe("all");
  });
  it("round-trips through the URL, leaving defaults out", () => {
    const o = parseAmbient({ dwell: "30", sector: "media", scenes: "cover,data" });
    expect(ambientSearch(o)).toEqual({ dwell: "30", sector: "media", scenes: "cover,data" });
    expect(ambientSearch(parseAmbient({}))).toEqual({});
  });
});

describe("ambient board behaviour", () => {
  it("keys: Space pauses, arrows step, F full screen, Escape leaves", () => {
    expect(boardKey(" ")).toBe("pause");
    expect(boardKey("ArrowLeft")).toBe("prev"); expect(boardKey("ArrowUp")).toBe("prev");
    expect(boardKey("ArrowRight")).toBe("next"); expect(boardKey("ArrowDown")).toBe("next");
    expect(boardKey("f")).toBe("fullscreen"); expect(boardKey("F")).toBe("fullscreen");
    expect(boardKey("Escape")).toBe("leave");
    expect(boardKey("a")).toBeNull();
    expect(step(0, 3, -1)).toBe(2); expect(step(2, 3, 1)).toBe(0); expect(step(0, 0, 1)).toBe(0);
  });
  function fakeTimers() {
    let now = 0; const q: { at: number; fn: () => void; id: number }[] = []; let id = 0;
    const t: Timers = { set: (fn, ms) => { q.push({ at: now + ms, fn, id: ++id }); return id; }, clear: x => { const k = q.findIndex(e => e.id === x); if (k >= 0) q.splice(k, 1); } };
    const advance = (ms: number) => { now += ms; for (const e of q.filter(e => e.at <= now)) { q.splice(q.indexOf(e), 1); e.fn(); } };
    return { t, advance };
  }
  it("the pointer hides after three seconds of stillness and shows again on movement", () => {
    const { t, advance } = fakeTimers(), seen: boolean[] = [];
    const p = idle(t, POINTER_IDLE_MS, s => seen.push(s));
    p.poke(); advance(2999); expect(p.shown()).toBe(true);
    p.poke(); advance(2999); expect(p.shown()).toBe(true);
    advance(1); expect(p.shown()).toBe(false);
    p.poke(); expect(p.shown()).toBe(true);
    expect(seen).toEqual([true, false, true]);
    expect(POINTER_IDLE_MS).toBe(3000); expect(TAP_BAR_MS).toBe(5000);
  });
  it("the wake lock is requested, re-requested when visible again, and released", async () => {
    const release = vi.fn(async () => undefined);
    const sentinel = { release, released: false };
    const request = vi.fn(async () => sentinel);
    const wl = wakeLock({ wakeLock: { request } });
    expect(wl.supported).toBe(true);
    expect(await wl.request()).toBe(true);
    expect(request).toHaveBeenCalledWith("screen");
    sentinel.released = true; await wl.visible();
    expect(request).toHaveBeenCalledTimes(2);
    await wl.release();
    expect(release).toHaveBeenCalled();
    expect(wl.held()).toBe(false);
    const none = wakeLock({});
    expect(none.supported).toBe(false);
    expect(await none.request()).toBe(false);
  });
  it("polling keeps the last good data on failure and marks it late; 304 and 200 refresh it", async () => {
    let feed: Feed<string> = feedStart("first", 0), t = 1000, fresh: string | null = null;
    const set = (f: (x: Feed<string>) => Feed<string>) => { feed = f(feed); };
    const ok = boardPoll({ head: async () => ({ status: 200, etag: "\"b\"" }), load: async () => "second", now: () => t, feed: set, fresh: d => { fresh = d; } });
    const down = boardPoll<string>({ head: async () => { throw new Error("offline"); }, load: async () => "never", now: () => t, feed: set, fresh: () => undefined });
    const bad = boardPoll<string>({ head: async () => ({ status: 503, etag: null }), load: async () => "never", now: () => t, feed: set, fresh: () => undefined });
    const same = boardPoll<string>({ head: async () => ({ status: 304, etag: null }), load: async () => "never", now: () => t, feed: set, fresh: () => undefined });
    await expect(down(null)).rejects.toThrow();
    expect(feed).toMatchObject({ data: "first", stale: true });
    await expect(bad(null)).rejects.toThrow();
    expect(feed.data).toBe("first");
    t = 2000; await same("\"a\"");
    expect(feed).toMatchObject({ data: "first", stale: false, goodAt: 2000 });
    t = 3000; expect(await ok("\"a\"")).toMatchObject({ status: 200, etag: "\"b\"" });
    expect(feed).toMatchObject({ data: "second", stale: false, goodAt: 3000 });
    expect(fresh).toBe("second");
    expect(isLate(feed, 3000 + LATE_MS + 1)).toBe(true);
    expect(isLate(feed, 3001)).toBe(false);
    expect(isLate(feed, 3001, true)).toBe(true);
    expect(asOfText(Date.parse("2026-11-16T14:02:30Z"))).toBe("as of 14:02 UTC");
  });
  it("spares the panel: the board shifts a few pixels each scene and the mark swaps corner", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 6; n++) { const [x, y] = shiftOf(n); expect(Math.abs(x)).toBeLessThanOrEqual(8); expect(Math.abs(y)).toBeLessThanOrEqual(8); seen.add(`${x},${y}`); }
    expect(seen.size).toBe(6);
    expect(slabCorner(0)).not.toBe(slabCorner(1));
    for (let n = 0; n < 10; n++) expect(shiftOf(n)).not.toEqual(shiftOf(n + 1));
  });
  it("type is sized for distance: headline ≥ 6% of the height, nothing under 28 px at 1080p", () => {
    expect(BOARD_TYPE.headline).toBeGreaterThanOrEqual(6);
    for (const u of Object.values(BOARD_TYPE)) expect(pxAt(u, 1080)).toBeGreaterThanOrEqual(28);
    const css = readFileSync("src/styles.css", "utf8"), block = css.slice(css.indexOf("THE AMBIENT BOARD"));
    expect(block).toMatch(/--u: min\(1vh/);
    const sizes = [...block.matchAll(/font-size: (?:max\([^,]+, )?calc\(var\(--u\) \* ([\d.]+)\)/g)].map(m => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(8);
    for (const s of sizes) expect(pxAt(s, 1080)).toBeGreaterThanOrEqual(28);
    expect(block).toMatch(/prefers-reduced-motion: reduce\) \{ \.amb-cut \{ animation: none/);
  });
});

describe("ambient is gated whenever a password is set", () => {
  it("answers the password page without the cookie", async () => {
    const cfg = { hash: await sha256Hex("x"), allow: createRateLimiter(10, 60_000) };
    for (const p of ["/ambient", "/ambient/setup"]) {
      const r = await gate(new Request(`https://slug.global${p}`), cfg);
      expect(r?.status).toBe(401);
      expect(r?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });
});
