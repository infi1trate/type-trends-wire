import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { GENRES, ICON_LIMITS, feedUrl, storeLink, appOf, appsOf, paletteOf, measureIcon, bodyOf } from "../src/icons.js";

const entry = (id, name, o = {}) => ({
  "im:name": { label: name }, "im:artist": { label: o.maker ?? "Maker, Inc." },
  "im:image": [{ label: "https://is1-ssl.mzstatic.com/image/thumb/a/53x53bb.png" }, { label: o.icon ?? "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.png" }],
  id: { label: o.link ?? `https://apps.apple.com/us/app/some-app/id${id}?uo=2`, attributes: { "im:id": String(id) } },
});

test("eighteen categories, each read from Apple's public chart address", () => {
  assert.equal(Object.keys(GENRES).length, 18);
  assert.equal(feedUrl(6015), "https://itunes.apple.com/us/rss/topfreeapplications/limit=100/genre=6015/json");
});
test("a store link is https on apps.apple.com and loses its tracking parameters", () => {
  assert.equal(storeLink("https://apps.apple.com/us/app/venmo/id351727428?uo=2"), "https://apps.apple.com/us/app/venmo/id351727428");
  assert.equal(storeLink("http://apps.apple.com/us/app/x/id1"), null);
  assert.equal(storeLink("https://apps.apple.com.evil.example/us/app/x/id1"), null);
  assert.equal(storeLink("not a link"), null);
});
test("a chart entry becomes a row with its rank; an entry missing a field or with a picture from elsewhere is left out", () => {
  const a = appOf(entry(351727428, "  Venmo  "), 3);
  assert.deepEqual(a.row, { rank: 3, app_id: "351727428", name: "Venmo", maker: "Maker, Inc.", link: "https://apps.apple.com/us/app/some-app/id351727428" });
  assert.equal(a.icon, "https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.png");
  assert.equal(appOf(entry("abc", "X"), 1), null);
  assert.equal(appOf(entry(1, ""), 1), null);
  assert.equal(appOf(entry(1, "X", { icon: "https://example.com/i.png" }), 1), null);
  assert.equal(appOf(entry(1, "X", { link: "https://example.com/app" }), 1), null);
  assert.equal(appOf(entry(1, "N".repeat(300)), 1).row.name.length, ICON_LIMITS.name);
});
test("ranks follow the chart's order, also when the chart holds one entry or none", () => {
  const rows = appsOf({ feed: { entry: [entry(1, "A"), entry("bad", "B"), entry(3, "C")] } });
  assert.deepEqual(rows.map(r => [r.row.rank, r.row.name]), [[1, "A"], [3, "C"]]);
  assert.equal(appsOf({ feed: { entry: entry(9, "Only") } })[0].row.rank, 1);
  assert.deepEqual(appsOf({ feed: {} }), []);
  assert.equal(appsOf({ feed: { entry: Array.from({ length: 5 }, (_, i) => entry(i + 1, `A${i}`)) } }, 2).length, 2);
});
test("a palette is at most eight colours, largest first, upper-case, and its shares never add past one", () => {
  const p = paletteOf([{ hex: "#00ff00", share: 0.2 }, { hex: "#0000FF", share: 0.7 }, { hex: "nope", share: 0.5 }, { hex: "#111111", share: 0 }, { hex: "#222222", share: 0.3 }]);
  assert.deepEqual(p, [{ hex: "#0000FF", share: 0.7 }, { hex: "#222222", share: 0.3 }]);
  assert.equal(paletteOf(Array.from({ length: 12 }, (_, i) => ({ hex: `#0000${(16 + i).toString(16)}`, share: 0.05 }))).length, 8);
  assert.deepEqual(paletteOf(null), []);
});
test("a flat blue icon measures as mostly blue, and nothing of the picture is returned", async () => {
  const buf = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 20, g: 90, b: 230, alpha: 1 } } }).png().toBuffer();
  const p = await measureIcon(buf);
  assert.ok(Array.isArray(p) && p.length >= 1);
  assert.ok(p[0].share > 0.9);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(p[0].hex.slice(i, i + 2), 16));
  assert.ok(b > r && b > g);
  assert.deepEqual(Object.keys(p[0]).sort(), ["hex", "share"]);
  assert.equal(await measureIcon(Buffer.from("not a picture")), null);
});
test("the request body names the store, the chart, the day and the category", () => {
  assert.deepEqual(bodyOf("r1", "2026-11-23", { id: 6015, name: "Finance" }, []), { run_id: "r1", store: "us", chart: "top-free", day: "2026-11-23", genre: { id: 6015, name: "Finance" }, apps: [] });
});
