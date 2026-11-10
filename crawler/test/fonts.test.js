import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFamily, resolveFonts, firstDeclared } from "../src/fonts.js";
import { keepMainstream } from "../src/seeds.js";

test("normalize", () => {
  assert.equal(normalizeFamily("Inter Variable"), "Inter");
  assert.equal(normalizeFamily("Inter Semi Bold"), "Inter");
  assert.equal(normalizeFamily("Newsreader 16pt"), "Newsreader");
  assert.equal(normalizeFamily("Exposure[-10]"), "Exposure");
  assert.equal(normalizeFamily("Builder Extended ExtraBold"), "Builder Extended");
  assert.equal(normalizeFamily("ABC Oracle Book"), "ABC Oracle");
  assert.equal(normalizeFamily("Anthropic Serif Variable Text"), "Anthropic Serif Variable Text");
  assert.equal(normalizeFamily(".\x7f"), "(obfuscated)");
  assert.equal(normalizeFamily("Geist"), "Geist");
});

test("fallback maps back to the declared family", () => {
  const r = resolveFonts({ h1: { raw: "Liberation Sans", glyphs: 10, also: [] }, body: { raw: "Inter Variable", glyphs: 99, also: [] } },
    { h1: { stack: "Helvetica Neue, Arial, sans-serif" }, body: { stack: "Inter, sans-serif" }, cta: null });
  assert.equal(r.h1.family, "Helvetica Neue");
  assert.equal(r.h1.system, true);
  assert.equal(r.h1.substituted, true);
  assert.equal(r.body.family, "Inter");
  assert.equal(r.body.substituted, false);
  assert.equal(firstDeclared('-apple-system, BlinkMacSystemFont, "Segoe UI"'), "Segoe UI");
});

test("gambling filtered", () => {
  assert.equal(keepMainstream("dpbossnet.me"), false);
  assert.equal(keepMainstream("xosodaiphat.com"), false);
  assert.equal(keepMainstream("people.com"), true);
});
