import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { ART_LIMITS, AIC_SLICES, MET_SLICES, aicWork, metWork, aicSearchUrl, metSearchUrl, movementOf, kindOf, readPicture, workBody, nextBatch, makeArtSender } from "../src/art.js";

const aic = { id: 16568, title: "Water Lilies", artist_title: "Claude Monet", date_start: 1906, date_end: 1906, date_display: "1906", style_title: "Impressionism", artwork_type_title: "Painting",
  department_title: "Painting and Sculpture of Europe", image_id: "3c27b499-af56-f0d5-93b5-a7f2f1ad5813", credit_line: "Mr. and Mrs. Martin A. Ryerson Collection", is_public_domain: true };
const met = { objectID: 436535, isPublicDomain: true, primaryImageSmall: "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg", title: "Wheat Field with Cypresses", artistDisplayName: "Vincent van Gogh",
  objectBeginDate: 1889, objectEndDate: 1889, objectDate: "1889", department: "European Paintings", classification: "Paintings", creditLine: "Purchase, The Annenberg Foundation Gift, 1993", objectURL: "https://www.metmuseum.org/art/collection/search/436535" };

test("only works the museum marks public domain, with a picture and whole-year dates, become works", () => {
  assert.equal(aicWork({ ...aic, is_public_domain: false }), null);
  assert.equal(aicWork({ ...aic, image_id: null }), null);
  assert.equal(aicWork({ ...aic, date_start: null }), null);
  assert.equal(metWork({ ...met, isPublicDomain: false }), null);
  assert.equal(metWork({ ...met, primaryImageSmall: "" }), null);
  assert.equal(metWork({ ...met, objectURL: "https://example.com/x" }), null);
  const a = aicWork(aic), m = metWork(met, MET_SLICES[9]);
  assert.deepEqual([a.source, a.source_id, a.movement, a.kind, a.licence, a.link], ["aic", "16568", "Impressionism", "painting", "CC0", "https://www.artic.edu/artworks/16568"]);
  assert.match(a.credit_line, /^The Art Institute of Chicago\. /);
  assert.deepEqual([m.source, m.source_id, m.movement, m.tradition, m.kind, m.licence], ["met", "436535", null, "European paintings", "painting", "CC0"]);
  assert.match(m.credit_line, /^The Metropolitan Museum of Art\. /);
});
test("a century is not a movement; kinds are read from the museum's own words", () => {
  assert.equal(movementOf("17th Century"), null);
  assert.equal(movementOf("nineteenth century"), null);
  assert.equal(movementOf(""), null);
  assert.equal(movementOf("Japanese (culture or style)"), "Japanese (culture or style)");
  assert.deepEqual(["Painting", "Woodblock print", "Print", "Drawing and Watercolor", "Vessel"].map(kindOf), ["painting", "print", "print", "drawing", "other"]);
});
test("the searches ask for public-domain works with pictures and never for the CC-BY description", () => {
  for (const s of AIC_SLICES) {
    const u = aicSearchUrl(s);
    assert.match(u, /\[term\]\[is_public_domain\]=true/);
    assert.match(u, /\[exists\]\[field\]=image_id/);
    assert.doesNotMatch(u, /description/);
  }
  const style = aicSearchUrl({ style: "Impressionism" }), years = aicSearchUrl({ from: 1850, to: 1899 });
  assert.match(style, /filter\]\[2\]\[term\]\[style_title\.keyword\]=Impressionism/);
  assert.match(style, /filter\]\[3\]\[terms\]\[artwork_type_title\.keyword\]\[0\]=Painting&query\[bool\]\[filter\]\[3\]\[terms\]\[artwork_type_title\.keyword\]\[1\]=Print/);
  assert.match(years, /filter\]\[3\]\[range\]\[date_start\]\[gte\]=1850&query\[bool\]\[filter\]\[4\]\[range\]\[date_start\]\[lte\]=1899/);
  assert.match(metSearchUrl(MET_SLICES[0]), /\/v1\.1\/search\?hasImages=true&departmentId=11&dateBegin=1400&dateEnd=1449&q=painting&limit=80&offset=0$/);
});
test("a batch takes works in turn across the slices and skips what was sent", () => {
  const w = (source, id) => ({ source, source_id: String(id) });
  const slices = [[w("aic", 1), w("aic", 2), w("aic", 3)], [w("met", 1), w("met", 2)], [w("aic", 2), w("aic", 9)]];
  assert.deepEqual(nextBatch(slices, [], 4).map(x => `${x.source}:${x.source_id}`), ["aic:1", "met:1", "aic:2", "met:2"]);
  assert.deepEqual(nextBatch(slices, ["aic:1", "met:1"], 10).map(x => `${x.source}:${x.source_id}`), ["aic:2", "met:2", "aic:3", "aic:9"]);
  assert.deepEqual(nextBatch(slices, [], 0), []);
});
test("a picture gives a palette and a thumbnail inside the limits; the picture's address is not sent", async () => {
  const buf = await sharp({ create: { width: 900, height: 1400, channels: 3, background: { r: 40, g: 90, b: 160 } } }).composite([{ input: { create: { width: 300, height: 300, channels: 3, background: { r: 230, g: 200, b: 60 } } }, left: 100, top: 100 }]).jpeg().toBuffer();
  const pic = await readPicture(buf);
  assert.ok(pic.palette.length >= 2 && pic.palette.length <= 8);
  for (const c of pic.palette) { assert.match(c.hex, /^#[0-9A-F]{6}$/); assert.ok(c.share > 0 && c.share <= 1); }
  assert.ok(pic.palette.reduce((a, c) => a + c.share, 0) <= 1.001);
  assert.ok(pic.width <= ART_LIMITS.thumbWidth && pic.height <= ART_LIMITS.thumbHeight);
  assert.ok(Buffer.from(pic.webp_base64, "base64").length <= ART_LIMITS.thumbBytes);
  assert.equal(await readPicture(Buffer.from("not a picture")).catch(() => null), null);
  const body = workBody({ ...aicWork(aic) }, pic);
  assert.equal("image" in body, false);
  assert.deepEqual(Object.keys(body).sort(), ["artist", "credit_line", "date_display", "height", "kind", "licence", "link", "movement", "palette", "source", "source_id", "title", "tradition", "webp_base64", "width", "year_end", "year_start"]);
});
test("the sender keeps to twenty works a request, counts what the site says, and remembers what was answered", async () => {
  const calls = [], fetchImpl = async (url, init) => { const b = JSON.parse(init.body); calls.push({ url: String(url), n: b.works.length, secret: init.headers["x-crawl-secret"] });
    return { ok: true, status: 200, json: async () => ({ stored: b.works.length - 1, unchanged: 0, refused: [{ source: "aic", source_id: b.works[0].source_id, reason: "not_public_domain" }] }) }; };
  const s = makeArtSender({ endpoint: "https://slug.global/api/public/ingest-crawl", secret: "k", runId: "art-test", fetchImpl, log: () => {} });
  for (let i = 0; i < 45; i++) s.add({ source: "aic", source_id: String(i), webp_base64: "AAAA" });
  await s.flush();
  assert.deepEqual(calls.map(c => c.n), [20, 20, 5]);
  assert.ok(calls.every(c => c.url === "https://slug.global/api/public/ingest-art" && c.secret === "k"));
  assert.deepEqual([s.totals.read, s.totals.stored, s.totals.refused, s.totals.failed, s.totals.done.length], [45, 42, 3, 0, 45]);
  assert.deepEqual(s.totals.reasons, { not_public_domain: 3 });
  const down = makeArtSender({ endpoint: "https://slug.global/api/public/ingest-crawl", secret: "k", runId: "x", fetchImpl: async () => ({ ok: false, status: 400 }), log: () => {} });
  down.add({ source: "met", source_id: "1", webp_base64: "AAAA" }); await down.flush();
  assert.deepEqual([down.totals.failed, down.totals.done.length], [1, 0]);
  const dry = makeArtSender({ endpoint: "https://slug.global/api/public/ingest-crawl", dry: true, fetchImpl: async () => { throw new Error("a dry run sends nothing"); } });
  dry.add({ source: "met", source_id: "1", webp_base64: "AAAA" }); await dry.flush();
  assert.equal(dry.totals.stored, 1);
});
