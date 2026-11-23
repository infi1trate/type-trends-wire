// @vitest-environment node
// W3d Part 1 · the icon intake against a memory store: the secret first, the 256 KB line, per-row refusals that do not sink the post,
// one snapshot per ISO week per category (a later post replaces, an unchanged one writes nothing), 26 weeks kept, removal forever.
import { describe, expect, it } from "vitest";
import { handleIconIngest, removeIconApp, type IconRow, type IconStore } from "./ingest.server";
import { oldestKept, weekOfDay, dayProblem, linkOk } from "./contract";

type Row = IconRow & { removed_at: string | null; reason?: string };
function memory() {
  const rows: Row[] = [], writes: string[] = [];
  const store: IconStore = {
    guard: async () => null,
    authenticate: async r => r.headers.get("x-crawl-secret") === "ok",
    removed: async ids => new Set(rows.filter(r => r.removed_at && ids.includes(r.app_id)).map(r => r.app_id)),
    weekRows: async (week, g) => rows.filter(r => r.week === week && r.genre_id === g && !r.removed_at).map(r => ({ app_id: r.app_id, rank: r.rank, name: r.name, maker: r.maker, link: r.link, palette: r.palette, day: r.day })),
    upsert: async xs => { writes.push(`upsert:${xs.length}`); for (const x of xs) { const k = rows.findIndex(r => r.week === x.week && r.genre_id === x.genre_id && r.app_id === x.app_id); const row = { ...x, removed_at: null }; if (k >= 0) rows[k] = row; else rows.push(row); } },
    dropOthers: async (week, g, keep) => { let n = 0; for (let k = rows.length - 1; k >= 0; k--) { const r = rows[k]!; if (r.week === week && r.genre_id === g && !r.removed_at && !keep.includes(r.app_id)) { rows.splice(k, 1); n++; } } writes.push(`drop:${n}`); return n; },
    prune: async oldest => { for (let k = rows.length - 1; k >= 0; k--) if (rows[k]!.week < oldest && !rows[k]!.removed_at) rows.splice(k, 1); },
    markRemoved: async (id, reason, at) => { let n = 0; for (const r of rows) if (r.app_id === id && !r.removed_at) { r.removed_at = at; r.reason = reason; n++; } return n; },
    isRemoved: async id => { const r = rows.find(x => x.app_id === id && x.removed_at); return r ? { at: r.removed_at! } : null; },
  };
  return { rows, writes, store };
}
const NOW = Date.parse("2026-11-25T12:00:00Z");
const app = (rank: number, o: Partial<{ app_id: string; link: string; palette: { hex: string; share: number }[]; name: string }> = {}) => ({ rank, app_id: o.app_id ?? String(100000 + rank), name: o.name ?? `App ${rank}`, maker: `Maker ${rank}`,
  link: o.link ?? `https://apps.apple.com/us/app/app-${rank}/id${o.app_id ?? 100000 + rank}`, palette: o.palette ?? [{ hex: "#1F4FC0", share: 0.6 }, { hex: "#FFFFFF", share: 0.4 }] });
const body = (o: Partial<{ day: string; apps: unknown[]; genre: { id: number; name: string } }> = {}) => ({ run_id: "run-1", store: "us", chart: "top-free", day: o.day ?? "2026-11-24", genre: o.genre ?? { id: 6015, name: "Finance" }, apps: o.apps ?? Array.from({ length: 100 }, (_, k) => app(k + 1)) });
const post = (b: unknown, secret = "ok") => new Request("https://slug.global/api/public/ingest-icons", { method: "POST", headers: { "x-crawl-secret": secret, "content-type": "application/json" }, body: typeof b === "string" ? b : JSON.stringify(b) });
const send = async (m: ReturnType<typeof memory>, b: unknown, secret = "ok") => { const r = await handleIconIngest(post(b, secret), m.store, () => NOW); return { status: r.status, json: await r.json() as Record<string, unknown> }; };

describe("POST /api/public/ingest-icons (W3d)", () => {
  it("refuses a wrong secret before reading the body", async () => {
    const m = memory();
    expect((await send(m, "not json", "no")).status).toBe(401);
  });
  it("refuses a body over 256 KB, bad JSON and a bad envelope", async () => {
    const m = memory();
    expect((await send(m, JSON.stringify({ ...body(), pad: "x".repeat(256 * 1024) }))).status).toBe(413);
    expect((await send(m, "{")).status).toBe(400);
    expect((await send(m, { ...body(), store: "gb" })).status).toBe(400);
    expect((await send(m, { ...body(), extra: 1 })).status).toBe(400);
    expect((await send(m, body({ apps: [] }))).status).toBe(400);
    expect((await send(m, body({ apps: Array.from({ length: 101 }, (_, k) => app((k % 100) + 1)) }))).status).toBe(400);
    expect((await send(m, body({ day: "2026-02-30" }))).json["error"]).toMatch(/real calendar day/);
    expect((await send(m, body({ day: "2026-11-28" }))).json["error"]).toMatch(/later than today/);
    expect(m.rows).toHaveLength(0);
  });
  it("stores one week of one category and answers stored, unchanged, refused", async () => {
    const m = memory(), r = await send(m, body());
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ week: "2026-W48", stored: 100, unchanged: 0, dropped: 0, refused: [] });
    expect(m.rows).toHaveLength(100);
  });
  it("a row that fails a check is refused with its reason and does not sink the post", async () => {
    const m = memory(), apps = [app(1), app(2, { link: "https://example.com/id2" }), app(3, { palette: [{ hex: "#000000", share: 0.7 }, { hex: "#FFFFFF", share: 0.4 }] }), { rank: 4, app_id: "abc", name: "x", maker: "y", link: "https://apps.apple.com/x", palette: [] }, app(5, { app_id: "100001" }), app(1, { app_id: "777" })];
    const r = await send(m, body({ apps }));
    expect(r.json["stored"]).toBe(1);
    expect((r.json["refused"] as { rank: number; reason: string }[]).map(x => `${x.rank}:${x.reason}`)).toEqual(["2:wrong_link_host", "3:palette_shares", "4:invalid", "5:duplicate_app", "1:duplicate_rank"]);
  });
  it("an unchanged later post writes nothing; a changed one replaces that category's week", async () => {
    const m = memory();
    await send(m, body());
    m.writes.length = 0;
    const same = await send(m, body({ day: "2026-11-25" }));
    expect(same.json).toMatchObject({ stored: 0, unchanged: 100, dropped: 0 });
    expect(m.writes).toEqual([]);
    const apps = [...Array.from({ length: 98 }, (_, k) => app(k + 1)), app(99, { app_id: "999", palette: [{ hex: "#E03030", share: 0.9 }] })];
    const next = await send(m, body({ day: "2026-11-25", apps }));
    expect(next.json).toMatchObject({ stored: 1, unchanged: 98, dropped: 2 });
    expect(m.rows.filter(r => r.week === "2026-W48")).toHaveLength(99);
    expect(m.rows.every(r => r.app_id !== "100100")).toBe(true);
  });
  it("an older day in the same week does not replace a newer one", async () => {
    const m = memory();
    await send(m, body({ day: "2026-11-25" }));
    expect((await send(m, body({ day: "2026-11-23", apps: [app(1, { name: "Other" })] }))).status).toBe(409);
  });
  it("another category or another week is its own snapshot", async () => {
    const m = memory();
    await send(m, body());
    await send(m, body({ genre: { id: 6014, name: "Games" } }));
    await send(m, body({ day: "2026-11-17", apps: [app(1)] }));
    expect(m.rows.filter(r => r.week === "2026-W48")).toHaveLength(200);
    expect(m.rows.filter(r => r.week === "2026-W47")).toHaveLength(1);
  });
  it("keeps 26 weeks: a post prunes weeks older than the kept ones", async () => {
    const m = memory();
    m.rows.push({ ...app(1), week: "2026-W21", day: "2026-05-18", store: "us", chart: "top-free", genre_id: 6015, genre_name: "Finance", run_id: "old", removed_at: null });
    m.rows.push({ ...app(2), week: "2026-W23", day: "2026-06-01", store: "us", chart: "top-free", genre_id: 6015, genre_name: "Finance", run_id: "old", removed_at: null });
    await send(m, body());
    expect(oldestKept("2026-W48")).toBe("2026-W23");
    expect(m.rows.some(r => r.week === "2026-W21")).toBe(false);
    expect(m.rows.some(r => r.week === "2026-W23")).toBe(true);
    expect(dayProblem("2026-05-01", NOW)).toMatch(/older than the 26 weeks/);
  });
  it("a removed app is refused forever and its rows stay as the record", async () => {
    const m = memory();
    await send(m, body());
    expect(await removeIconApp({ app_id: "100007", reason: "Maker asked" }, m.store, "2026-11-25T13:00:00Z")).toEqual({ removed: true, rows: 1 });
    expect(await removeIconApp({ app_id: "100007", reason: "Again" }, m.store)).toEqual({ refused: "App 100007 was already removed on 2026-11-25." });
    expect(await removeIconApp({ app_id: "424242", reason: "Never stored" }, m.store)).toBeNull();
    const r = await send(m, body({ day: "2026-11-25" }));
    expect((r.json["refused"] as { app_id: string; reason: string }[])).toEqual([{ rank: 7, app_id: "100007", reason: "removed" }]);
    expect(m.rows.filter(x => x.app_id === "100007")).toHaveLength(1);
    expect(m.rows.find(x => x.app_id === "100007")!.removed_at).toBe("2026-11-25T13:00:00Z");
    m.rows.splice(0, m.rows.length, ...m.rows.filter(x => x.removed_at));
    await send(m, body({ day: "2026-12-01" }));
    expect(m.rows.filter(x => x.app_id === "100007" && !x.removed_at)).toHaveLength(0);
  });
  it("links must be https on apps.apple.com; days map to ISO weeks", () => {
    expect(linkOk("https://apps.apple.com/us/app/x/id1")).toBe(true);
    expect(linkOk("http://apps.apple.com/us/app/x/id1")).toBe(false);
    expect(linkOk("https://apps.apple.com.evil.com/x")).toBe(false);
    expect(linkOk("https://itunes.apple.com/x")).toBe(false);
    expect(weekOfDay("2026-11-23")).toBe("2026-W48");
    expect(weekOfDay("2026-11-29")).toBe("2026-W48");
    expect(weekOfDay("2027-01-01")).toBe("2026-W53");
  });
});
