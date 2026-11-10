import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { serve } from "./serve.js";
import { homepageAllowed } from "../src/robots.js";
import { keepMainstream, keepVanguard, hostOf } from "../src/seeds.js";

test("robots", () => {
  assert.equal(homepageAllowed("User-agent: *\nDisallow: /"), false);
  assert.equal(homepageAllowed("User-agent: *\nDisallow: /admin"), true);
  assert.equal(homepageAllowed("User-agent: *\nDisallow:"), true);
  assert.equal(homepageAllowed("User-agent: DSGNTerminalBot\nDisallow: /\n\nUser-agent: *\nAllow: /"), false);
  assert.equal(homepageAllowed("User-agent: *\nDisallow: /\nAllow: /$"), true);
  assert.equal(homepageAllowed(""), true);
});

test("seed filters", () => {
  assert.equal(keepMainstream("googleapis.com"), false);
  assert.equal(keepMainstream("e2.cloudfront.net"), false);
  assert.equal(keepMainstream("nytimes.com"), true);
  assert.equal(keepVanguard("github.com"), false);
  assert.equal(keepVanguard("linear.app"), true);
  assert.equal(hostOf("https://www.Linear.app/path"), "linear.app");
});

test("end-to-end dry run on fixture sites", { timeout: 120000 }, async () => {
  const servers = await Promise.all([serve("test/fixtures/dark", 4801), serve("test/fixtures/light", 4802), serve("test/fixtures/blocked", 4803)]);
  writeFileSync("/tmp/seeds.json", JSON.stringify({ mainstream: ["localhost:4801", "localhost:4803", "localhost:4999"], vanguard: ["localhost:4802"] }));
  rmSync("out", { recursive: true, force: true });
  try {
    await run("node", ["src/crawl.js"], { env: { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", RUN_ID: "test", SEEDS_FILE: "/tmp/seeds.json", PER_INDEX: "5", CONCURRENCY: "2" } });
  } finally { servers.forEach((s) => s.close()); }
  const lines = readFileSync("out/test.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].kind, "start");
  assert.equal(lines.at(-1).kind, "finish");
  const sites = lines.filter((l) => l.kind === "sites").flatMap((l) => l.sites);
  const by = Object.fromEntries(sites.map((s) => [s.domain, s]));
  assert.equal(by["localhost:4803"].error, "robots_disallow");
  assert.equal(by["localhost:4999"].ok, false);

  const dark = by["localhost:4801"];
  assert.ok(dark.ok, dark.error);
  assert.equal(dark.index, "mainstream");
  assert.equal(dark.type.rendered.h1.raw, "DejaVu Sans Mono"); // the actual face behind "Acme Grotesk"
  assert.equal(dark.type.rendered.h1.family, "DejaVu Sans Mono"); // a downloaded webfont keeps its real name
  assert.equal(dark.type.rendered.h1.webfont, true);
  assert.equal(dark.layout.headline_source, "h1");
  assert.equal(dark.type.declared.h1.size_px, 88);
  assert.equal(dark.color.theme, "dark");
  assert.equal(dark.color.accent, "#FF4F00");
  assert.equal(dark.color.page_bg, "#0A0A0A");
  assert.ok(dark.color.body_contrast > 10);
  assert.equal(dark.layout.h1_align, "center");
  assert.equal(dark.layout.cta_radius_px, 999);
  assert.ok(dark.layout.cta_count >= 2);
  assert.equal(dark.layout.grid_max_cols, 3);
  assert.equal(dark.layout.nav_links, 4);
  assert.deepEqual(dark.lexicon.ctas.slice(0, 2), ["Start for free", "Book a demo"]);
  assert.equal(dark.lexicon.h1, "Agents that ship themselves");
  assert.equal(dark.title, "Acme — Build faster");
  assert.equal(by["localhost:4999"].error, "ERR_CONNECTION_REFUSED");
  assert.equal(dark.tech.generator, "Framer 2.0");

  const light = by["localhost:4802"];
  assert.ok(light.ok, light.error);
  assert.equal(light.index, "vanguard");
  assert.equal(light.color.theme, "light");
  assert.equal(light.layout.hero_media, "image");
  assert.equal(light.layout.h1_align, "left");
  assert.ok(light.color.palette.some((p) => p.hex.startsWith("#2E5E4") || p.hex.startsWith("#2F5E4") || p.hex.startsWith("#2E5D4")), JSON.stringify(light.color.palette));
  console.log(JSON.stringify(dark, null, 1).slice(0, 3000));
});
