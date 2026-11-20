import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readSeeds, npmPoint, githubPoints, batches, getJson, collect, makePoster } from "../src/indicators.js";

const seed = { label: "Tailwind CSS", topic: "styling", npm: "tailwindcss", repo: "tailwindlabs/tailwindcss" };
const noWait = async () => {};

test("the shipped seed list is valid and has no duplicates", () => {
  const seeds = readSeeds(JSON.parse(readFileSync(new URL("../seeds/indicators.json", import.meta.url), "utf8")));
  assert.ok(seeds.length >= 30);
  assert.ok(seeds.every((s) => s.label && s.topic && (s.npm || s.repo)));
});

test("seeds: bad names, missing fields and duplicates are refused", () => {
  assert.throws(() => readSeeds({}), /must be a list/);
  assert.throws(() => readSeeds([{ label: "x", topic: "t" }]), /needs npm or repo/);
  assert.throws(() => readSeeds([{ label: "x", topic: "t", npm: "../etc/passwd" }]), /bad npm name/);
  assert.throws(() => readSeeds([{ label: "x", topic: "t", repo: "owner/repo/extra" }]), /bad repo name/);
  assert.throws(() => readSeeds([{ label: "a", topic: "t", npm: "x" }, { label: "b", topic: "t", npm: "x" }]), /listed twice/);
  assert.deepEqual(readSeeds([{ label: " A ", topic: "Motion", npm: "@scope/pkg" }]), [{ label: "A", topic: "motion", npm: "@scope/pkg", repo: null }]);
});

test("npm: a count and an end date make one point; anything else makes none", () => {
  assert.deepEqual(npmPoint(seed, { downloads: 123, start: "2026-11-13", end: "2026-11-19", package: "tailwindcss" }),
    { source: "npm", key: "tailwindcss", metric: "downloads_week", value: 123, period_end: "2026-11-19", label: "Tailwind CSS", topic: "styling" });
  for (const bad of [null, {}, { downloads: -1, end: "2026-11-19" }, { downloads: 1.5, end: "2026-11-19" }, { downloads: 5, end: "soon" }, { error: "not found" }]) assert.equal(npmPoint(seed, bad), null);
});

test("github: three points keyed by the tracked name, dated today", () => {
  const ps = githubPoints(seed, { full_name: "Renamed/Repo", stargazers_count: 90000, forks_count: 4500, open_issues_count: 30 }, "2026-11-20");
  assert.deepEqual(ps.map((p) => [p.key, p.metric, p.value, p.period_end]), [["tailwindlabs/tailwindcss", "stars", 90000, "2026-11-20"], ["tailwindlabs/tailwindcss", "forks", 4500, "2026-11-20"], ["tailwindlabs/tailwindcss", "open_issues", 30, "2026-11-20"]]);
  assert.equal(githubPoints(seed, { stargazers_count: "many" }, "2026-11-20").length, 0);
  assert.equal(githubPoints({ ...seed, repo: null }, { stargazers_count: 1 }, "2026-11-20").length, 0);
});

test("batches of 200", () => {
  assert.deepEqual(batches(Array.from({ length: 450 }, (_, i) => i)).map((b) => b.length), [200, 200, 50]);
  assert.deepEqual(batches([]), []);
});

test("collect: reads both sources, sends the token only to GitHub, and keeps going past failures", async () => {
  const seen = [];
  let flaky = 0;
  const srv = createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization ?? null });
    const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.url === "/npm/downloads/point/last-week/tailwindcss") return json(200, { downloads: 1000, end: "2026-11-19" });
    if (req.url === "/npm/downloads/point/last-week/@scope/gone") return json(404, { error: "package not found" });
    if (req.url === "/npm/downloads/point/last-week/flaky") return ++flaky < 2 ? json(503, {}) : json(200, { downloads: 7, end: "2026-11-19" });
    if (req.url === "/gh/repos/tailwindlabs/tailwindcss") return json(200, { stargazers_count: 5, forks_count: 2, open_issues_count: 1 });
    if (req.url === "/gh/repos/owner/broken") return json(401, { message: "Bad credentials" });
    json(404, {});
  });
  await new Promise((r) => srv.listen(4873, "127.0.0.1", r));
  try {
    const base = "http://127.0.0.1:4873";
    const out = await collect(readSeeds([seed, { label: "Gone", topic: "x", npm: "@scope/gone" }, { label: "Flaky", topic: "x", npm: "flaky" }, { label: "Broken", topic: "x", repo: "owner/broken" }]),
      { npmApi: `${base}/npm`, githubApi: `${base}/gh`, token: "test-token", today: "2026-11-20", wait: noWait, gapMs: 0 });
    assert.deepEqual(out.points.map((p) => `${p.source}:${p.key}:${p.metric}=${p.value}`), ["npm:tailwindcss:downloads_week=1000", "github:tailwindlabs/tailwindcss:stars=5", "github:tailwindlabs/tailwindcss:forks=2", "github:tailwindlabs/tailwindcss:open_issues=1", "npm:flaky:downloads_week=7"]);
    assert.deepEqual(out.skipped.map((s) => s.key), ["npm:@scope/gone", "github:owner/broken"]);
    assert.ok(seen.filter((s) => s.url.startsWith("/npm")).every((s) => s.auth === null));
    assert.ok(seen.filter((s) => s.url.startsWith("/gh")).every((s) => s.auth === "Bearer test-token"));
    assert.equal(await getJson(`${base}/nothing`, { wait: noWait }), null);
  } finally { await new Promise((r) => srv.close(r)); }
});

test("the collector imports nothing from node_modules (its workflow installs nothing)", () => {
  const src = readFileSync(new URL("../src/indicators.js", import.meta.url), "utf8");
  const froms = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.ok(froms.length > 0 && froms.every((f) => f.startsWith("node:")), `unexpected imports: ${froms}`);
});

test("poster: sends the secret header, retries a 503, and stops at once on a 400", async () => {
  const seen = []; let n = 0;
  const srv = createServer((req, res) => {
    seen.push({ url: req.url, secret: req.headers["x-crawl-secret"] }); n++;
    if (req.url === "/ok") { res.writeHead(n === 1 ? 503 : 200, { "content-type": "application/json" }); return res.end(JSON.stringify({ accepted: 2 })); }
    res.writeHead(400); res.end("points.0.value: must be a whole number");
  });
  await new Promise((r) => srv.listen(4874, "127.0.0.1", r));
  try {
    const mk = (path) => makePoster({ endpoint: `http://127.0.0.1:4874${path}`, secret: "s3", dry: false, runId: "t", wait: noWait });
    assert.deepEqual(await mk("/ok")({ points: [] }), { accepted: 2 });
    assert.equal(seen.length, 2); assert.ok(seen.every((s) => s.secret === "s3"));
    await assert.rejects(mk("/bad")({ points: [] }), /ingest rejected \(400\): points\.0\.value/);
    assert.equal(seen.length, 3);
  } finally { await new Promise((r) => srv.close(r)); }
});
