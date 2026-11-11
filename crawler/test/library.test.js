import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { serve } from "./serve.js";
import { homepageAllowed } from "../src/robots.js";
import { parseLibrary, discoverPages, htmlHash, contentHash, signalsHash } from "../src/library-lib.js";
const run = promisify(execFile);

test("library csv", () => {
  const all = parseLibrary(readFileSync("seeds/library.csv", "utf8"));
  assert.equal(all.length, 300);
  assert.equal(new Set(all.map((s) => s.domain)).size, 300);
  assert.throws(() => parseLibrary("domain,sector\nx.com,toys"));
});

test("robots paths", () => {
  const txt = "User-agent: *\nDisallow: /about\nDisallow: /*.pdf$\nAllow: /about/team";
  assert.equal(homepageAllowed(txt, undefined, "/about"), false);
  assert.equal(homepageAllowed(txt, undefined, "/about/team"), true);
  assert.equal(homepageAllowed(txt, undefined, "/pricing"), true);
  assert.equal(homepageAllowed(txt, undefined, "/x.pdf"), false);
  assert.equal(homepageAllowed(txt), true);
});

test("discoverPages", () => {
  const links = [
    { href: "https://a.com/pricing/", text: "Pricing", in_nav: true },
    { href: "https://a.com/blog/pricing-our-product", text: "How we price", in_nav: false },
    { href: "https://a.com/changelog", text: "Changelog", in_nav: false },
    { href: "https://docs.a.com/changelog", text: "Changelog", in_nav: true },
    { href: "https://a.com/company", text: "Company", in_nav: true },
    { href: "https://a.com/features", text: "Features", in_nav: true },
    { href: "https://b.com/pricing", text: "Pricing", in_nav: true },
  ];
  assert.deepEqual(discoverPages(links, "https://www.a.com/"), { pricing: "https://a.com/pricing", changelog: "https://a.com/changelog", product: "https://a.com/features", about: "https://a.com/company" });
});

test("hashes ignore noise", () => {
  const a = `<html><script>var t=${Date.now()}</script><div nonce="abc" class="x">Hi</div><img src="/a/3f9a8b7c6d5e4f3a2b1c.png"></html>`;
  const b = `<html><script>var t=1</script><div nonce="zzz" class="x">Hi</div>\n<img src="/a/0000aaaa1111bbbb2222.png"></html>`;
  assert.equal(htmlHash(a), htmlHash(b));
  assert.notEqual(htmlHash(a), htmlHash(a.replace("Hi", "Hello")));
  assert.equal(contentHash("Pro  $29\n"), contentHash("pro $29"));
  assert.notEqual(contentHash("pro $29"), contentHash("pro $39"));
  const s = { type: { rendered: { h1: { family: "Inter" } } }, color: { theme: "light" }, nav: [{ label: "Pricing", depth: 1 }] };
  assert.equal(signalsHash(s), signalsHash(JSON.parse(JSON.stringify(s))));
  assert.notEqual(signalsHash(s), signalsHash({ ...s, color: { theme: "dark" } }));
});

test("library dry run on fixture site", { timeout: 120000 }, async () => {
  const server = await serve("test/fixtures/lib", 4811);
  writeFileSync("/tmp/lib.csv", "domain,sector\nlocalhost:4811,dev-tools\nlocalhost:4998,ai\n");
  rmSync("out", { recursive: true, force: true });
  try {
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "libtest", LIBRARY_FILE: "/tmp/lib.csv", CONCURRENCY: "2" } });
    const lines = readFileSync("out/libtest.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].kind, "library_sync");
    assert.equal(lines[0].sites.length, 2);
    const snaps = lines.filter((l) => l.kind === "library_snapshots").flatMap((l) => l.snapshots);
    const key = (s) => `${s.page_type}:${s.viewport}`;
    const by = Object.fromEntries(snaps.map((s) => [key(s), s]));
    assert.deepEqual(Object.keys(by).sort(), ["changelog:desktop", "home:desktop", "home:mobile", "pricing:desktop"].sort());
    // about is robots-disallowed; product 404s (no fixture) → not emitted
    const home = by["home:desktop"];
    assert.equal(home.domain, "localhost:4811");
    assert.equal(home.source, "live");
    assert.ok(home.html_hash && home.content_hash && home.signals_hash);
    assert.deepEqual(Object.keys(home.discovered_pages).sort(), ["about", "changelog", "pricing", "product"]);
    assert.ok(home.signals.css_features.includes("container_queries"));
    assert.ok(home.signals.css_features.includes("has_selector"));
    assert.ok(home.signals.css_features.includes("text_wrap_balance"));
    assert.ok(home.signals.nav.some((n) => n.label === "Pricing" && n.depth === 1));
    assert.ok(home.signals.skeleton.length > 3 && home.signals.skeleton.length <= 400);
    assert.ok(home.signals.skeleton.some((b) => b.kind === "heading"));
    assert.equal(home.signals.layout.grid_max_cols, 3);
    assert.ok(home.raw_text.includes("Software that stays out of the way"));
    assert.equal(by["home:mobile"].signals.page.w, 390);
    assert.equal(by["home:mobile"].raw_text, undefined);
    assert.ok(by["pricing:desktop"].raw_text.includes("$29"));

    // daily check with unchanged state → nothing re-snapshotted
    const latest = Object.fromEntries(snaps.map((s) => [key(s), { html_hash: s.html_hash, content_hash: s.content_hash, captured_at: s.captured_at }]));
    writeFileSync("/tmp/state.json", JSON.stringify({ sites: [{ domain: "localhost:4811", sector: "dev-tools", active: true, pages: home.discovered_pages, latest }] }));
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "libcheck", LIBRARY_MODE: "check", STATE_FILE: "/tmp/state.json", LIBRARY_FILE: "/tmp/lib.csv", LIMIT: "1" } });
    const sum = JSON.parse(readFileSync("out/libcheck.summary.json", "utf8"));
    assert.equal(sum.snapshots, 0);
    assert.equal(sum.sites_skipped, 1);
  } finally { server.close(); }
});
