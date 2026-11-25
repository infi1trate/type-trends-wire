import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseLibrary, parseSlice, sliceOf, inSlice, pickVanguard } from "../src/library-lib.js";
const run = promisify(execFile);
const SCRIPT = resolve("src/library.js");

test("parseSlice", () => {
  assert.equal(parseSlice(undefined), null);
  assert.equal(parseSlice(""), null);
  assert.deepEqual(parseSlice("3/24"), { i: 3, n: 24 });
  assert.deepEqual(parseSlice(" 0/1 "), { i: 0, n: 1 });
  for (const bad of ["24/24", "a/24", "3", "3/0", "-1/24", "1/2/3", "1.5/24"]) assert.throws(() => parseSlice(bad), /SLICE/, bad);
});

test("slices cover every library site exactly once and stay put", () => {
  const all = parseLibrary(readFileSync("seeds/library.csv", "utf8"));
  const parts = Array.from({ length: 24 }, (_, i) => inSlice(all, { i, n: 24 }));
  assert.equal(parts.flat().length, all.length);
  assert.equal(new Set(parts.flat().map((s) => s.domain)).size, all.length);
  // Roughly even: no hour is empty and none carries more than three times its share.
  assert.ok(parts.every((p) => p.length >= 1 && p.length <= Math.ceil(all.length / 24 * 3)), parts.map((p) => p.length).join(","));
  // Stable: fixed values, case-insensitive, independent of list order.
  assert.equal(sliceOf("stripe.com", 24), sliceOf("STRIPE.com", 24));
  assert.deepEqual(inSlice([...all].reverse(), { i: 5, n: 24 }).map((s) => s.domain).sort(), parts[5].map((s) => s.domain).sort());
  assert.equal(inSlice(all, null), all);
});

test("pickVanguard", () => {
  const sites = [{ domain: "a.com" }, { domain: "b.com" }, { domain: "c.com" }];
  assert.deepEqual(pickVanguard(sites, { vanguard: ["c.com", "WWW.A.com", "gone.com"] }), { sites: [{ domain: "a.com" }, { domain: "c.com" }], listed: 3 });
  // No list, an empty list or a malformed one: crawl nothing, never everything.
  for (const state of [{}, { vanguard: [] }, { vanguard: "a.com" }, null, undefined]) assert.deepEqual(pickVanguard(sites, state), { sites: [], listed: 0 });
});

test("library run honours SLICE and VANGUARD", { timeout: 120000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "cadence-"));
  const csv = join(dir, "lib.csv"), state = join(dir, "state.json");
  writeFileSync(csv, "domain,sector\nlocalhost:4997,dev-tools\nlocalhost:4998,ai\n");
  const env = { ...process.env, DRY_RUN: "1", ALLOW_HTTP: "1", LIBRARY_FILE: csv, STATE_FILE: state, CONCURRENCY: "2", THUMBS: "0", CROPS: "0", LIBRARY_TAG: "0" };
  delete env.RUN_ID; delete env.SLICE; delete env.VANGUARD;
  const summary = (prefix) => { const f = readdirSync(join(dir, "out")).filter((x) => x.startsWith(prefix) && x.endsWith(".summary.json")); assert.equal(f.length, 1, `${prefix}: ${f}`); return JSON.parse(readFileSync(join(dir, "out", f[0]), "utf8")); };

  // A check slice that neither site falls in: nothing to do.
  const taken = new Set([sliceOf("localhost:4997", 24), sliceOf("localhost:4998", 24)]);
  const empty = [...Array(24).keys()].find((i) => !taken.has(i));
  writeFileSync(state, JSON.stringify({ sites: [] }));
  await run("node", [SCRIPT], { cwd: dir, env: { ...env, LIBRARY_MODE: "check", SLICE: `${empty}/24` } });
  const s1 = summary("lib-check-");
  assert.equal(s1.slice, `${empty}/24`);
  assert.equal(s1.sites, 0);
  assert.equal(s1.snapshots, 0);
  assert.match(s1.run_id, new RegExp(`^lib-check-\\d{4}-\\d{2}-\\d{2}-s${empty}of24-`));

  // The slice one site falls in: only that site is looked at.
  await run("node", [SCRIPT], { cwd: dir, env: { ...env, LIBRARY_MODE: "check", SLICE: `${sliceOf("localhost:4998", 24)}/24`, RUN_ID: "one" } });
  const s2 = JSON.parse(readFileSync(join(dir, "out", "one.summary.json"), "utf8"));
  assert.equal(s2.sites, taken.size === 1 ? 2 : 1);

  // Vanguard with no list from the site: crawl nothing, and never call itself a full crawl.
  const { stdout } = await run("node", [SCRIPT], { cwd: dir, env: { ...env, VANGUARD: "1" } });
  assert.match(stdout, /no vanguard list; nothing to crawl/);
  const s3 = summary("lib-vanguard-");
  assert.deepEqual(s3.vanguard, { listed: 0, crawled: 0 });
  assert.equal(s3.sites, 0);
  assert.ok(!readdirSync(join(dir, "out")).some((x) => x.startsWith("lib-full-")));

  // Vanguard with a list: only listed library sites (the listed stranger is ignored; the listed site is down, so it fails cleanly).
  writeFileSync(state, JSON.stringify({ sites: [], vanguard: ["localhost:4998", "not-in-library.com"] }));
  await run("node", [SCRIPT], { cwd: dir, env: { ...env, VANGUARD: "1", RUN_ID: "van" } });
  const s4 = JSON.parse(readFileSync(join(dir, "out", "van.summary.json"), "utf8"));
  assert.deepEqual(s4.vanguard, { listed: 2, crawled: 1 });
  assert.equal(s4.sites_ok, 0);
  assert.equal(s4.sites_failed + s4.sites_skipped, 1);

  // VANGUARD only means something in full mode.
  await run("node", [SCRIPT], { cwd: dir, env: { ...env, VANGUARD: "1", LIBRARY_MODE: "check", RUN_ID: "chk" } });
  const s5 = JSON.parse(readFileSync(join(dir, "out", "chk.summary.json"), "utf8"));
  assert.equal(s5.vanguard, undefined);
  assert.equal(s5.sites, 2);
});
