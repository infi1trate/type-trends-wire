// Structure reading (roadmap 2, J1 + M1): sections in order, first-screen asks, furniture, and the phone reading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { serve } from "./serve.js";
import { extractStructure } from "../src/extract-structure.js";
import { signalsHash } from "../src/library-lib.js";

test("structure: a desktop page reads as ordered sections, asks and furniture", async () => {
  const server = await serve("test/fixtures/structure", 4861);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:4861/");
    const s = await page.evaluate(extractStructure);
    assert.equal(s.v, 1);
    assert.deepEqual(s.sections.map((x) => x.r), ["hero", "logos", "cards", "stats", "testimonials", "pricing", "faq", "ask", "footer"]);
    assert.ok(s.sections.every((x, i, a) => i === 0 || x.y >= a[i - 1].y), "sections are in page order");
    assert.equal(s.sections[0].t, "Ship faster with Acme");
    assert.deepEqual(s.asks.map((a) => [a.l, a.k, a.p]), [["Start for free", "start", 1], ["Book a demo", "demo", 0]]);
    assert.equal(s.furniture.search, 1);
    assert.equal(s.furniture.chat, "intercom");
    assert.equal(s.furniture.hreflang, 2);
    assert.equal(s.furniture.login, "Log in");
    assert.equal(s.furniture.pricing_nav, 1);
    assert.deepEqual(s.furniture.nav_buttons, ["Solutions"], "menu buttons in the navigation are kept beside the link labels");
    assert.match(s.furniture.bar, /Acme 3\.0 is out today/);
    assert.equal(s.mobile, undefined, "no phone reading on a desktop capture");
    assert.ok(JSON.stringify(s).length < 2500, `stays small (${JSON.stringify(s).length} bytes)`);
  } finally { await browser.close(); server.close(); }
});

test("structure: a phone-width capture adds the phone reading", async () => {
  const server = await serve("test/fixtures/structure", 4862);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto("http://localhost:4862/");
    const s = await page.evaluate(extractStructure);
    assert.equal(s.mobile.nav, "drawer");
    assert.equal(s.mobile.sticky, "Start for free");
    assert.equal(s.mobile.smart_banner, 1);
    assert.equal(s.mobile.store_links, 1);
    assert.equal(s.mobile.body_px, 16);
    assert.ok(s.mobile.tap_n > 5 && s.mobile.tap_small >= 0 && s.mobile.tap_small <= 100);
    assert.equal(s.mobile.overflow_x, undefined);
    assert.equal(s.sections[0].r, "hero");
  } finally { await browser.close(); server.close(); }
});

test("structure is not part of the change hash, so adding it never reads as a change", () => {
  const base = { type: { rendered: { h1: { family: "A" }, body: { family: "B" } } }, color: { theme: "light", accent: "#06f" }, layout: {}, lexicon: { h1: "x" }, nav: [{ label: "Pricing", depth: 1 }], css_features: ["clamp"], tech: {} };
  assert.equal(signalsHash(base), signalsHash({ ...base, structure: { v: 1, sections: [{ r: "hero" }], asks: [], furniture: { search: 1 } } }));
});
