// @vitest-environment node
// M2a · listing contract bounds and the intake against a memory store.
import { describe, expect, it } from "vitest";
import { handleListingIngest, removeListingApp, type ListingStore } from "./ingest.server";
import { listingApp, listingPayload, type ListingRow, type VersionRow, type WeekRow } from "./contract";

function memory(iconRemoved: string[] = []) {
  const L: (ListingRow & { removed_at: string | null; last_seen: string })[] = [], V: VersionRow[] = [], W: WeekRow[] = [], writes: string[] = [];
  const store: ListingStore = {
    guard: async () => null,
    authenticate: async r => r.headers.get("x-crawl-secret") === "ok",
    removed: async ids => new Set(ids.filter(id => iconRemoved.includes(id) || L.some(l => l.app_id === id && l.removed_at))),
    listings: async ids => L.filter(l => ids.includes(l.app_id)).map(({ removed_at: _r, last_seen: _s, ...l }) => l),
    versions: async keys => V.filter(v => keys.some(k => k.app_id === v.app_id && k.version === v.version)),
    weekRows: async (week, g, ids) => W.filter(w => w.week === week && w.genre_id === g && ids.includes(w.app_id)),
    upsertListings: async (rows, seen) => { writes.push(`L:${rows.length}`); for (const x of rows) { const k = L.findIndex(l => l.app_id === x.app_id); const row = { ...x, removed_at: null, last_seen: seen }; if (k >= 0) L[k] = row; else L.push(row); } },
    upsertVersions: async rows => { writes.push(`V:${rows.length}`); for (const x of rows) { const k = V.findIndex(v => v.app_id === x.app_id && v.version === x.version); if (k >= 0) V[k] = x; else V.push(x); } },
    upsertWeeks: async rows => { writes.push(`W:${rows.length}`); for (const x of rows) { const k = W.findIndex(w => w.week === x.week && w.genre_id === x.genre_id && w.app_id === x.app_id); if (k >= 0) W[k] = x; else W.push(x); } },
    prune: async oldest => { for (let k = W.length - 1; k >= 0; k--) if (W[k]!.week < oldest) W.splice(k, 1); },
    markRemoved: async (id, _reason, at) => { let n = 0; for (const l of L) if (l.app_id === id && !l.removed_at) { l.removed_at = at; l.about = null; n++; } for (const v of V) if (v.app_id === id && v.notes !== null) { v.notes = null; n++; } return n; },
  };
  return { L, V, W, writes, store };
}
const NOW = Date.parse("2026-11-25T12:00:00Z");
type App = Record<string, unknown>;
const app = (rank: number, o: App = {}): App => ({ rank, app_id: String(100000 + rank), name: `App ${rank}`, maker: `Maker ${rank}`, link: `https://apps.apple.com/us/app/a/id${100000 + rank}`,
  genre: "Finance", price: 0, currency: "USD", version: "1.0", version_at: "2026-11-24T15:40:58.000Z", first_at: "2026-05-27T07:00:00.000Z",
  notes: "Fixes.", notes_chars: 6, about: "An app.", about_chars: 7, about_words: 2, rating: 4.8, ratings: 100, size_mb: 50, min_os: "17.0", languages: 1, age: "4+", site: "example.com",
  shots: { phone: 5, pad: 0, tv: 0, way: "portrait", palettes: [[{ hex: "#FAF5EC", share: 0.8 }]] }, ...o });
const body = (o: App = {}) => ({ run_id: "r", store: "us", chart: "top-free", day: "2026-11-24", genre: { id: 6015, name: "Finance" }, part: 1, parts: 4, apps: [app(1)], ...o });
const send = async (m: ReturnType<typeof memory>, b: unknown, secret = "ok") => {
  const r = await handleListingIngest(new Request("https://slug.global/api/public/ingest-listings", { method: "POST", headers: { "x-crawl-secret": secret }, body: JSON.stringify(b) }), m.store, () => NOW);
  return { status: r.status, json: await r.json() as { stored: number; unchanged: number; refused: { app_id: string; reason: string }[] } };
};

describe("listing contract", () => {
  const ok = (o: App) => listingApp.safeParse(app(1, o)).success;
  it("checks each field's bounds", () => {
    expect(ok({})).toBe(true);
    for (const o of [{ rank: 0 }, { rank: 101 }, { app_id: "x1" }, { app_id: "1".repeat(21) }, { name: "" }, { maker: "m".repeat(121) }, { genre: "g".repeat(61) }, { price: -1 }, { price: 10000 }, { currency: "usd" },
      { version: "v".repeat(41) }, { version_at: "yesterday" }, { notes: "n".repeat(801) }, { notes_chars: null }, { about: "a".repeat(601) }, { about_chars: null }, { about_words: -1 }, { rating: 5.1 }, { ratings: -1 },
      { size_mb: 0 }, { min_os: "1".repeat(13) }, { languages: 401 }, { age: "123456789" }, { site: "https://example.com" }, { site: "Example.com" }, { shots: null }, { shots: { phone: 41, pad: 0, tv: 0, way: null, palettes: [] } },
      { shots: { phone: 1, pad: 0, tv: 0, way: "up", palettes: [] } }, { shots: { phone: 1, pad: 0, tv: 0, way: null, palettes: [[], []] } }, { shots: { phone: 1, pad: 0, tv: 0, way: null, palettes: [[{ hex: "#FFF", share: 1 }]] } }, { extra: 1 }])
      expect(ok(o), JSON.stringify(o)).toBe(false);
    for (const k of ["genre", "price", "currency", "version", "version_at", "first_at", "notes", "about", "rating", "ratings", "size_mb", "min_os", "languages", "age", "site"]) expect(ok({ [k]: null }), k).toBe(true);
  });
  it("checks part and parts", () => {
    expect(listingPayload.safeParse(body({ part: 4, parts: 4 })).success).toBe(true);
    expect(listingPayload.safeParse(body({ part: 5, parts: 4 })).success).toBe(false);
    expect(listingPayload.safeParse(body({ part: 0 })).success).toBe(false);
    expect(listingPayload.safeParse(body({ parts: 9, part: 1 })).success).toBe(false);
    expect(listingPayload.safeParse(body({ apps: Array.from({ length: 26 }, (_, k) => app(k + 1)) })).success).toBe(false);
  });
});

describe("POST /api/public/ingest-listings (M2a)", () => {
  it("refuses a wrong secret", async () => { expect((await send(memory(), body(), "no")).status).toBe(401); });
  it("refuses a bad row without sinking the post, with each reason", async () => {
    const m = memory();
    const r = await send(m, body({ apps: [app(1), app(2, { rating: 9 }), app(3, { link: "https://evil.com/id1" }), app(4, { shots: { phone: 1, pad: 0, tv: 0, way: null, palettes: [[{ hex: "#000000", share: 0.7 }, { hex: "#FFFFFF", share: 0.7 }]] } }), app(5, { app_id: "100001" }), app(1, { app_id: "999" })] }));
    expect(r.status).toBe(200);
    expect(r.json.stored).toBe(1);
    expect(r.json.refused.map(x => x.reason)).toEqual(["invalid", "wrong_link_host", "palette_shares", "duplicate_app", "duplicate_rank"]);
  });
  it("stores a new app in all three tables, then the same version again is unchanged", async () => {
    const m = memory();
    expect((await send(m, body())).json).toMatchObject({ stored: 1, unchanged: 0 });
    expect([m.L.length, m.V.length, m.W.length]).toEqual([1, 1, 1]);
    expect(m.L[0]!.about_changed_at).toBeNull();
    const n = m.writes.length;
    expect((await send(m, body())).json).toMatchObject({ stored: 0, unchanged: 1 });
    expect(m.writes.length).toBe(n);
  });
  it("a new version adds one version row and updates the week row", async () => {
    const m = memory();
    await send(m, body());
    expect((await send(m, body({ apps: [app(1, { version: "1.1", rank: 2 })] }))).json.stored).toBe(1);
    expect(m.V.map(v => v.version)).toEqual(["1.0", "1.1"]);
    expect(m.W).toHaveLength(1);
    expect(m.W[0]).toMatchObject({ version: "1.1", rank: 2 });
  });
  it("a null version is stored under ''; a changed field on a stored version corrects it in place", async () => {
    const m = memory();
    await send(m, body({ apps: [app(1, { version: null })] }));
    await send(m, body({ apps: [app(1, { version: null, size_mb: 51 })] }));
    expect(m.V).toHaveLength(1);
    expect(m.V[0]).toMatchObject({ version: "", size_mb: 51 });
  });
  it("a changed about sets about_changed_at", async () => {
    const m = memory();
    await send(m, body());
    await send(m, body({ apps: [app(1, { about: "A new app." })] }));
    expect(m.L[0]!.about).toBe("A new app.");
    expect(m.L[0]!.about_changed_at).toBe(new Date(NOW).toISOString());
  });
  it("a later post in the same week replaces the app's week row; other apps of the week stay (parts)", async () => {
    const m = memory();
    await send(m, body({ apps: [app(1), app(2)] }));
    await send(m, body({ day: "2026-11-25", part: 2, apps: [app(3)] }));
    await send(m, body({ day: "2026-11-25", apps: [app(1, { ratings: 200 })] }));
    expect(m.W.map(w => w.app_id).sort()).toEqual(["100001", "100002", "100003"]);
    expect(m.W.find(w => w.app_id === "100001")).toMatchObject({ day: "2026-11-25", ratings: 200 });
  });
  it("keeps 26 weeks of weekly rows and leaves version rows alone", async () => {
    const m = memory();
    m.W.push({ week: "2026-W01", store: "us", chart: "top-free", genre_id: 6015, app_id: "9", genre_name: "Finance", day: "2026-01-01", rank: 1, rating: null, ratings: null, version: "" });
    m.V.push({ store: "us", app_id: "9", version: "", version_at: null, notes: null, notes_chars: 0, price: null, currency: null, size_mb: null, min_os: null, languages: null, age: null, shots: { phone: 0, pad: 0, tv: 0, way: null, palettes: [] } });
    await send(m, body());
    expect(m.W.map(w => w.week)).toEqual(["2026-W48"]);
    expect(m.V.some(v => v.app_id === "9")).toBe(true);
  });
  it("refuses an app removed from the icon study or from listings", async () => {
    const m = memory(["100001"]);
    expect((await send(m, body({ apps: [app(1), app(2)] }))).json.refused).toEqual([{ app_id: "100001", reason: "removed" }]);
    await removeListingApp("100002", "owner asked", m.store);
    expect((await send(m, body({ apps: [app(2, { version: "9" })] }))).json.refused).toEqual([{ app_id: "100002", reason: "removed" }]);
  });
  it("icon_remove's listing half blanks the stored text", async () => {
    const m = memory();
    await send(m, body());
    await send(m, body({ apps: [app(1, { version: "1.1" })] }));
    expect(await removeListingApp("100001", "owner asked", m.store)).toBe(3);
    expect(m.L[0]).toMatchObject({ about: null });
    expect(m.L[0]!.removed_at).not.toBeNull();
    expect(m.V.every(v => v.notes === null)).toBe(true);
  });
});
