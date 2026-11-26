import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteOf, shotSize, shotFacts, listingOf, chunks, bodyOf, answerOf, lookupUrl, LISTING_LIMITS, LOOKUP_GAP_MS } from "../src/listings.js";

const shot = (n, size = "392x696bb") => `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/aa/bb/cc/${n}.png/${size}.jpg`;
const result = (over = {}) => ({
  kind: "software", trackId: 42, trackName: "Ledger", sellerName: "Ledger Inc.", primaryGenreName: "Finance", price: 0, currency: "USD",
  version: "5.2.1", currentVersionReleaseDate: "2026-11-20T07:29:44Z", releaseDate: "2019-02-05T08:00:00Z",
  releaseNotes: "Bug fixes\n\nand   a new home tab.", description: "Track every   account.\nBudget in minutes. ".repeat(60),
  averageUserRating: 4.52738, userRatingCount: 29337, fileSizeBytes: "561202176", minimumOsVersion: "15.1",
  languageCodesISO2A: ["EN", "FR", "DE"], contentAdvisoryRating: "4+", sellerUrl: "https://www.ledger.example/app?utm=1",
  screenshotUrls: [shot(1), shot(2), shot(3)], ipadScreenshotUrls: [shot(4, "576x768bb")], appletvScreenshotUrls: [], ...over,
});
const row = { rank: 3, app_id: "42", name: "Ledger", maker: "Ledger Inc.", link: "https://apps.apple.com/us/app/ledger/id42" };

test("a listing becomes measured facts and short text", () => {
  const a = listingOf(result(), row);
  assert.equal(a.app_id, "42"); assert.equal(a.rank, 3); assert.equal(a.link, row.link);
  assert.equal(a.genre, "Finance"); assert.equal(a.price, 0); assert.equal(a.currency, "USD");
  assert.equal(a.version, "5.2.1"); assert.equal(a.version_at, "2026-11-20T07:29:44.000Z"); assert.equal(a.first_at, "2019-02-05T08:00:00.000Z");
  assert.equal(a.notes, "Bug fixes and a new home tab.");
  assert.equal(a.rating, 4.53); assert.equal(a.ratings, 29337); assert.equal(a.size_mb, 535.2); assert.equal(a.min_os, "15.1");
  assert.equal(a.languages, 3); assert.equal(a.age, "4+"); assert.equal(a.site, "ledger.example");
  assert.deepEqual(a.shots, { phone: 3, pad: 1, tv: 0, way: "portrait" });
});
test("text is cut short but its true length is kept", () => {
  const a = listingOf(result({ releaseNotes: "x".repeat(5000) }), row);
  assert.equal(a.notes.length, LISTING_LIMITS.notes); assert.equal(a.notes_chars, 5000);
  assert.equal(a.about.length <= LISTING_LIMITS.about, true); assert.equal(a.about_chars > LISTING_LIMITS.about, true); assert.equal(a.about_words, 360);
});
test("a result for another app, or something that is not an app, is not a listing", () => {
  assert.equal(listingOf(result({ trackId: 43 }), row), null);
  assert.equal(listingOf(result({ kind: "song" }), row), null);
  assert.equal(listingOf(null, row), null);
});
test("missing or odd fields become null, never a guess", () => {
  const a = listingOf(result({ price: "free", currency: "usd", currentVersionReleaseDate: "soon", averageUserRating: 9, fileSizeBytes: null, languageCodesISO2A: null, sellerUrl: "javascript:alert(1)", releaseNotes: undefined, screenshotUrls: [], ipadScreenshotUrls: [] }), row);
  assert.equal(a.price, null); assert.equal(a.currency, null); assert.equal(a.version_at, null); assert.equal(a.rating, null); assert.equal(a.size_mb, null);
  assert.equal(a.languages, null); assert.equal(a.site, null); assert.equal(a.notes, null); assert.equal(a.notes_chars, 0);
  assert.deepEqual(a.shots, { phone: 0, pad: 0, tv: 0, way: null });
});
test("the maker's website is a bare host", () => {
  assert.equal(siteOf("https://www.Example.com/path?x=1"), "example.com");
  assert.equal(siteOf("http://help.example.co.uk"), "help.example.co.uk");
  assert.equal(siteOf("ftp://example.com"), null); assert.equal(siteOf("https://localhost"), null); assert.equal(siteOf(""), null);
});
test("screenshot facts read the size Apple's address states and take pictures only from Apple's picture host", () => {
  assert.deepEqual(shotSize(shot(1, "696x392bb")), { w: 696, h: 392 }); assert.equal(shotSize("https://x.example/a.jpg"), null);
  const mixed = shotFacts({ screenshotUrls: [shot(1), shot(2, "696x392bb"), "https://evil.example/392x696bb.jpg"] });
  assert.equal(mixed.facts.phone, 2); assert.equal(mixed.facts.way, "mixed"); assert.equal(mixed.lead.length, 2);
  const padOnly = shotFacts({ ipadScreenshotUrls: [shot(9, "768x576bb")] });
  assert.equal(padOnly.facts.way, "landscape"); assert.equal(padOnly.lead.length, 1);
});
test("posts are small and say which part they are", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ rank: i + 1 }));
  const parts = chunks(rows); assert.deepEqual(parts.map(p => p.length), [25, 25, 10]);
  const b = bodyOf("r", "2026-11-26", { id: 6015, name: "Finance" }, 2, 3, parts[1]);
  assert.equal(b.part, 2); assert.equal(b.parts, 3); assert.equal(b.store, "us"); assert.equal(b.chart, "top-free"); assert.equal(b.apps.length, 25);
  const full = Array.from({ length: LISTING_LIMITS.perPost }, () => listingOf(result({ releaseNotes: "n".repeat(900), description: "d".repeat(900) }), row));
  assert.equal(JSON.stringify(bodyOf("r", "2026-11-26", { id: 1, name: "x" }, 1, 1, full.map(a => ({ ...a, shots: { ...a.shots, palettes: [Array(8).fill({ hex: "#000000", share: 0.1 }), Array(8).fill({ hex: "#000000", share: 0.1 })] } })))).length < LISTING_LIMITS.requestBytes, true);
});
test("a site without the endpoint is not a failure; a busy one is asked again", () => {
  assert.equal(answerOf(200), "stored"); assert.equal(answerOf(404), "not-taken"); assert.equal(answerOf(405), "not-taken");
  assert.equal(answerOf(503), "later"); assert.equal(answerOf(429), "later"); assert.equal(answerOf(0), "later"); assert.equal(answerOf(400), "refused");
});
test("one lookup per category, paced under Apple's stated limit", () => {
  assert.equal(lookupUrl(["1", "2"]), "https://itunes.apple.com/lookup?id=1,2&country=us&entity=software");
  assert.equal(60_000 / LOOKUP_GAP_MS <= 20, true);
});
test("no picture is written or sent", () => {
  const src = readFileSync(new URL("../src/listings.js", import.meta.url), "utf8");
  assert.equal(/writeFile\(|createWriteStream|toFile\(/.test(src), false);
  assert.equal(/screenshotUrls|artworkUrl/.test(JSON.stringify(listingOf(result(), row))), false);
  assert.equal(JSON.stringify(listingOf(result(), row)).includes("mzstatic"), false);
});
