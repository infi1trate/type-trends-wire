import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { serve } from "./serve.js";
import { homepageAllowed } from "../src/robots.js";
import { parseLibrary, discoverPages, choosePages, htmlHash, contentHash, signalsHash } from "../src/library-lib.js";
const run = promisify(execFile);

test("library csv", () => {
  const all = parseLibrary(readFileSync("seeds/library.csv", "utf8"));
  assert.ok(all.length >= 300, `the seed list shrank to ${all.length}`); // it grows by waves; the site refuses a sync that drops many brands
  assert.equal(new Set(all.map((s) => s.domain)).size, all.length);
  assert.ok(all.every((s) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s.domain)), "a seed row is not a bare domain");
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

test("product pages: a gift card is the last choice, and a page chosen before stays chosen", () => {
  const shop = [
    { href: "https://shop.com/products/gift-card", text: "Gift card", in_nav: true },
    { href: "https://shop.com/products/the-big-wool-sweater", text: "The Big Wool Sweater", in_nav: false },
  ];
  assert.equal(discoverPages(shop, "https://shop.com/").product, "https://shop.com/products/the-big-wool-sweater");
  assert.equal(discoverPages([shop[0]], "https://shop.com/").product, "https://shop.com/products/gift-card"); // nothing better on offer
  const found = { product: "https://shop.com/products/new-thing", about: "https://shop.com/about" };
  // kept while it lasts; the newly linked page is the fallback if the kept one is gone
  assert.deepEqual(choosePages({ home: "https://shop.com/", product: "https://shop.com/products/old-thing" }, found),
    { choice: { product: "https://shop.com/products/old-thing", about: "https://shop.com/about" }, fallback: { product: "https://shop.com/products/new-thing" } });
  // a gift card chosen before is traded for a real product
  assert.deepEqual(choosePages({ product: "https://shop.com/products/egift-card" }, found).choice.product, "https://shop.com/products/new-thing");
  assert.deepEqual(choosePages({}, found), { choice: found, fallback: {} });
  assert.deepEqual(choosePages({ pricing: "https://shop.com/pricing" }, {}), { choice: { pricing: "https://shop.com/pricing" }, fallback: {} });
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
    assert.ok(home.raw_text.includes("stays out of the way"));
    assert.equal(home.signals.lexicon.h1, "Software that stays out of the way"); // not the cookie banner, no doubled roll copy
    assert.ok(!home.signals.color.palette.some((p) => p.hex.startsWith("#FFC")), "cookie banner leaked into palette");
    assert.deepEqual(by["pricing:desktop"].signals.prices, ["$12 per seat", "$29 per seat"]);
    // images only for home:desktop, sent separately (never inside the snapshot payload)
    const tags = readFileSync("out/libtest.tags.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(tags.length, 1);
    assert.equal(tags[0].page_type, "home");
    assert.equal(tags[0].signals_hash, home.signals_hash);
    assert.ok(tags[0].images.fold > 1000);
    assert.ok(tags[0].images.sections.length >= 1 && tags[0].images.sections.length <= 4 && tags[0].images.sections.every((n) => n > 1000));
    assert.ok(!JSON.stringify(snaps).includes("data:image"));
    assert.equal(by["home:mobile"].signals.page.w, 390);
    assert.equal(by["home:mobile"].raw_text, undefined);
    assert.ok(by["pricing:desktop"].raw_text.includes("$29"));

    // daily check with unchanged state → nothing re-snapshotted
    const latest = Object.fromEntries(snaps.map((s) => [key(s), { html_hash: s.html_hash, content_hash: s.content_hash, signals_hash: s.signals_hash, captured_at: s.captured_at }]));
    writeFileSync("/tmp/state.json", JSON.stringify({ sites: [{ domain: "localhost:4811", sector: "dev-tools", active: true, pages: home.discovered_pages, latest }] }));
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "libcheck", LIBRARY_MODE: "check", STATE_FILE: "/tmp/state.json", LIBRARY_FILE: "/tmp/lib.csv", LIMIT: "1" } });
    const sum = JSON.parse(readFileSync("out/libcheck.summary.json", "utf8"));
    assert.equal(sum.snapshots, 0);
    assert.equal(sum.sites_skipped, 1);

    // weekly full with unchanged state → only the home page is re-sent (it carries discovered_pages)
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "libfull2", STATE_FILE: "/tmp/state.json", LIBRARY_FILE: "/tmp/lib.csv", LIMIT: "1" } });
    const sum2 = JSON.parse(readFileSync("out/libfull2.summary.json", "utf8"));
    assert.equal(sum2.snapshots, 1);
    assert.equal(sum2.unchanged, 3);
    // section crops: at least the hero of the desktop homepage is captured (dry runs count without posting)
    assert.ok(sum2.crops.captured >= 1 && sum2.crops.by_section.hero === 1);
    assert.equal(sum2.crops.failed, 0);

    // tag mode: home desktop only, forced even when unchanged
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "libtag", LIBRARY_MODE: "tag", STATE_FILE: "/tmp/state.json", LIBRARY_FILE: "/tmp/lib.csv", LIMIT: "1" } });
    const sum3 = JSON.parse(readFileSync("out/libtag.summary.json", "utf8"));
    assert.equal(sum3.snapshots, 1);
    assert.equal(sum3.tagged, 1);
  } finally { server.close(); }
});

test("wayback mode on a fake archive", { timeout: 120000 }, async () => {
  const { createServer } = await import("node:http");
  const html = readFileSync("test/fixtures/lib/index.html", "utf8");
  let cdxCalls = 0;
  const server = createServer((req, res) => {
    if (req.url.startsWith("/cdx/")) {
      cdxCalls++;
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify([["timestamp", "original", "statuscode"], ["20220401000000", "https://wb.example/", "200"], ["20240915000000", "https://wb.example/", "200"], ["20240920000000", "https://wb.example/", "404"]]));
    }
    if (/^\/web\/\d+if_\//.test(req.url)) { res.setHeader("content-type", "text/html"); return res.end(html); }
    res.statusCode = 404; res.end();
  });
  await new Promise((r) => server.listen(4831, r));
  writeFileSync("/tmp/wb.csv", "domain,sector\nwb.example,studios\nother.example,ai\n");
  try {
    await run("node", ["src/library.js"], { env: { ...process.env, DRY_RUN: "1", RUN_ID: "libwb", LIBRARY_MODE: "wayback", SECTOR: "studios", WAYBACK_BASE: "http://localhost:4831", WAYBACK_DELAY_MS: "0", LIBRARY_FILE: "/tmp/wb.csv" } });
    const lines = readFileSync("out/libwb.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].sites.length, 2); // sync still sends the whole list
    const snaps = lines.filter((l) => l.kind === "library_snapshots").flatMap((l) => l.snapshots);
    assert.equal(cdxCalls, 1); // SECTOR filter: only wb.example
    assert.deepEqual(snaps.map((s) => s.captured_at).sort(), ["2022-04-01T00:00:00.000Z", "2024-09-15T00:00:00.000Z"]);
    for (const s of snaps) {
      assert.equal(s.source, "wayback");
      assert.equal(s.url, "https://wb.example/");
      assert.equal(s.raw_text, undefined);
      assert.equal(s.html_hash, null);
      assert.match(s.signals.archive.wayback_url, /\/web\/\d+if_\/https:\/\/wb\.example\//);
      assert.ok(s.signals.archive.bucket);
    }
    const tags = readFileSync("out/libwb.tags.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(tags.length, 2);
    assert.ok(tags.every((t) => t.source === "wayback"));
  } finally { server.close(); }
});

test("pickCaptures: one per half-year, skips filled buckets", async () => {
  const { pickCaptures, halfYearBuckets } = await import("../src/library-lib.js");
  const now = new Date("2026-11-12");
  assert.equal(halfYearBuckets(2021, now).length, 11);
  const rows = [["timestamp", "original", "statuscode"], ["20210115000000", "https://x.com/", "200"], ["20210402000000", "https://x.com/", "200"], ["20230930120000", "https://x.com/", "200"], ["20260801000000", "https://x.com/", "200"]];
  const p = pickCaptures(rows, { now });
  assert.deepEqual(p.map((x) => x.bucket), ["2021H1", "2023H2"]); // 2026H2 is the live half
  assert.equal(p[0].timestamp, "20210402000000"); // nearest the Apr 1 midpoint
  assert.equal(pickCaptures(rows, { now, have: ["2021-02-01T00:00:00Z"] }).length, 1);
});
