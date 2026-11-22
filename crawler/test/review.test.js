import test from "node:test";
import assert from "node:assert/strict";
import { isoWeek, settings, storyPath, changedShare, measuresOf, verdict, PAGES, WIDTHS } from "../src/review.js";

test("the weekly run is named for its ISO week", () => {
  assert.equal(isoWeek(new Date("2026-11-22T10:00:00Z")), "2026-W47");
  assert.equal(isoWeek(new Date("2026-11-23T00:00:00Z")), "2026-W48");
  assert.equal(isoWeek(new Date("2027-01-01T00:00:00Z")), "2026-W53");
});
test("settings: defaults, and what is refused before anything is opened", () => {
  const now = new Date("2026-11-23T09:00:00Z");
  assert.deepEqual(settings({}, now), { kind: "weekly", actor: "design review", run: "2026-W48", against: null, base: "https://slug.global", dry: false });
  assert.equal(settings({ KIND: "before", RUN: "n5-before" }, now).actor, "engineering");
  assert.match(settings({ KIND: "monthly" }, now).error, /kind/);
  assert.match(settings({ KIND: "after" }, now).error, /run needs a name/);
  assert.match(settings({ KIND: "after", RUN: "a", AGAINST: "a" }, now).error, /itself/);
  assert.match(settings({ ACTOR: "owner" }, now).error, /actor/);
  assert.match(settings({ REVIEW_BASE: "http://example.com/x" }, now).error, /https origin/);
});
test("the story page is the front page's lead, else its first item", () => {
  assert.equal(storyPath({ lead: { id: "white:dev-tools:2026-W47" }, items: [{ id: "x:1" }] }), "/stories/white%3Adev-tools%3A2026-W47");
  assert.equal(storyPath({ lead: null, items: [{ id: "census:sale:2026-W47" }] }), "/stories/census%3Asale%3A2026-W47");
  assert.equal(storyPath(null), null);
});
test("changed share counts differing pixels, and rows only one picture has", () => {
  const w = 2, row = (...px) => px.flat();
  const a = Buffer.from(row([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]));
  assert.equal(changedShare(a, Buffer.from(a), w), 0);
  assert.equal(changedShare(a, Buffer.from(row([0, 0, 0], [255, 255, 255], [0, 0, 0], [0, 0, 0])), w), 0.25);
  assert.equal(changedShare(a, Buffer.from(row([5, 5, 5], [0, 0, 0], [0, 0, 0], [0, 0, 0])), w), 0, "small differences are below the tolerance");
  assert.equal(changedShare(a, Buffer.from(row([0, 0, 0], [0, 0, 0])), w), 0.5, "a missing row is all changed");
});
test("measures: whole numbers rounded, what was not measured is left out", () => {
  assert.deepEqual(measuresOf({ height_px: 3735.4, words: 1255, first_byte_ms: 390.6, lcp_ms: NaN, cls: 0.01234, overflow_x: false, image_kb: 412.345 }, { changed_share: 0.00412 }),
    { height_px: 3735, words: 1255, image_kb: 412.3, first_byte_ms: 391, cls: 0.012, overflow_x: false, changed_share: 0.0041 });
  assert.equal("changed_share" in measuresOf({ height_px: 1 }), false);
});
test("only the door's verdict is printed", () => {
  assert.equal(verdict(201, '{"ok":true,"picture":"AAAA","detail":{"x":1}}'), "201 ok=true");
  assert.equal(verdict(400, '{"error":"Invalid input: width"}'), "400 error=Invalid input: width");
  assert.equal(verdict(504, "<html>"), "504");
});
test("nine pages at three widths", () => { assert.equal(PAGES.length, 9); assert.deepEqual(WIDTHS, [1440, 768, 390]); });
