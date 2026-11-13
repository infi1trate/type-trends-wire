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

test("junk font names fall back to the declared family", () => {
  const r = resolveFonts({ h1: { raw: "Copyright Klim Type Foundry", webfont: true, glyphs: 10, also: [] } }, { h1: { stack: '"Tiempos Headline", serif' }, body: null, cta: null });
  assert.equal(r.h1.family, "Tiempos Headline");
  assert.equal(r.h1.system, false);
});

test("system stacks and Times New Roman", () => {
  const r = resolveFonts({ h1: { raw: "Liberation Sans", glyphs: 5, also: [] } }, { h1: { stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }, body: null, cta: null });
  assert.equal(r.h1.family, "System UI");
  assert.equal(normalizeFamily("Times New Roman"), "Times New Roman");
});

test("gambling filtered", () => {
  assert.equal(keepMainstream("dpbossnet.me"), false);
  assert.equal(keepMainstream("xosodaiphat.com"), false);
  assert.equal(keepMainstream("people.com"), true);
});

test("css-style family names become display names", async () => {
  const { normalizeFamily: n } = await import("../src/fonts.js");
  assert.equal(n("basier-square"), "Basier Square");
  assert.equal(n("abcNormal"), "ABC Normal");
  assert.equal(n("pp-neue-montreal"), "PP Neue Montreal");
  assert.equal(n("GT-America-Standard-Regular"), "GT America Standard");
  assert.equal(n("Basiersquare Webfont"), "Basiersquare");
  assert.equal(n("."), "(obfuscated)");
  assert.equal(n("Söhne"), "Söhne");
  assert.equal(n("IBM Plex Sans"), "IBM Plex Sans");
  assert.equal(n("__styreneA_403256"), "Styrene A");
  assert.equal(n("__Inter_Fallback_aaf875"), "Inter");
  assert.equal(n("__fkGrotesk_716da7"), "Fk Grotesk");
});
