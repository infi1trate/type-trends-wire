import { test } from "node:test";
import assert from "node:assert/strict";
import { findings, follow, FIXED } from "../src/leakcheck.js";

test("a brand page link or a stored picture of an onboarding brand is a leak; a bare mention is only reported", () => {
  assert.deepEqual(findings('<a href="/brands/olaplex.com">Olaplex</a>', "olaplex.com"), ["link"]);
  assert.deepEqual(findings('<a href="/brands/olaplex.com?view=data">', "olaplex.com"), ["link"]);
  assert.deepEqual(findings('<img src="https://x.supabase.co/storage/v1/object/public/crops/olaplex.com/hero-1.webp">', "olaplex.com"), ["picture"]);
  assert.deepEqual(findings('<p>Read more at vimeo.com today</p>', "vimeo.com"), ["mention"]);
  assert.deepEqual(findings('{"domain":"olaplex.com","section":"cta"}', "olaplex.com"), ["data"]);
  assert.deepEqual(findings('{\\"domain\\":\\"olaplex.com\\"}', "olaplex.com"), ["data"]);
  assert.deepEqual(findings('path:"olaplex.com/cta/2026-11-25-ffffe1ff.webp"', "olaplex.com"), ["data"]);
  assert.deepEqual(findings('"https://vimeo.com/123456"', "vimeo.com"), ["mention"]);
  assert.deepEqual(findings('<a href="/brands/notolaplex.com">', "olaplex.com"), []);
  assert.deepEqual(findings('<a href="/brands/air.inc.example">', "air.inc"), []);
  assert.deepEqual(findings("<p>nothing here</p>", "olaplex.com"), []);
});

test("follows a handful of pages per section and reads the fixed list", () => {
  const html = Array.from({ length: 9 }, (_, i) => `<a href="/signals/css:has-${i}">x</a><a href="/boards/b${i}?view=data">y</a>`).join("") + '<a href="/about">no</a>';
  const f = follow(html);
  assert.equal(f.filter((p) => p.startsWith("/signals/")).length, 6);
  assert.equal(f.filter((p) => p.startsWith("/boards/")).length, 6);
  assert.ok(!f.includes("/about"));
  for (const p of ["/", "/boards", "/brands", "/digest/rss.xml", "/sectors/studios"]) assert.ok(FIXED.includes(p), p);
});
