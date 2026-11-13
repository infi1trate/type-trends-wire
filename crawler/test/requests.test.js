import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, rmSync } from "node:fs";
import { serve } from "./serve.js";
import { privateAddress, checkUrl, fitSignals } from "../src/requests.js";
const run = promisify(execFile);

test("private addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1", "nonsense"]) assert.equal(privateAddress(ip), true, ip);
  for (const ip of ["93.184.216.34", "1.1.1.1", "2606:4700::1111", "::ffff:8.8.8.8"]) assert.equal(privateAddress(ip), false, ip);
});

test("url shape guard", () => {
  assert.equal(checkUrl("https://example.org/work", { allowPrivate: false }).hostname, "example.org");
  for (const [u, code] of [["ftp://example.org", "bad_scheme"], ["file:///etc/passwd", "bad_scheme"], ["https://user:pw@example.org", "bad_url"], ["https://example.org:8080/", "bad_port"], ["http://localhost/", "private_host"], ["http://intranet/", "private_host"], ["http://box.internal/", "private_host"], ["not a url", "bad_url"]])
    assert.throws(() => checkUrl(u, { allowPrivate: false }), new RegExp(code), u);
});

test("fitSignals trims bulky detail to the cap", () => {
  const s = { type: { a: 1 }, layout: { skeleton: "x".repeat(5000), hero: "split" }, lexicon: { h1: "Hi", nav: "y".repeat(5000) } };
  assert.deepEqual(fitSignals(s, 100_000), s);
  const t = fitSignals(s, 6000);
  assert.equal(t.layout.skeleton, undefined); assert.equal(t.layout.hero, "split"); assert.equal(t.lexicon.h1, "Hi");
  assert.equal(fitSignals({ type: "z".repeat(9000) }, 1000), null);
});

test("render queue end to end (fixture, dry run)", { timeout: 120000 }, async () => {
  const site = await serve("test/fixtures/dark", 4791);
  const blocked = await serve("test/fixtures/blocked", 4792);
  writeFileSync("/tmp/queue.json", JSON.stringify({ requests: [
    { url: "http://127.0.0.1:4791/", domain: "127.0.0.1" },
    { url: "http://127.0.0.1:4792/", domain: "127.0.0.1" },
    { url: "ftp://x.org/", domain: "x.org" },
  ] }));
  try {
    const { stdout } = await run("node", ["src/requests.js"], { env: { ...process.env, DRY_RUN: "1", QUEUE_FILE: "/tmp/queue.json", ALLOW_PRIVATE: "1" } });
    const lines = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
    assert.equal(lines.length, 3);
    assert.equal(lines[0].status, "done"); assert.equal(lines[0].signals, "(omitted)");
    assert.equal(lines[1].status, "error"); assert.equal(lines[1].error, "robots_disallow");
    assert.deepEqual(lines[2], { url: "ftp://x.org/", status: "error", error: "bad_scheme" });
  } finally { site.close(); blocked.close(); rmSync("/tmp/queue.json", { force: true }); }
});
