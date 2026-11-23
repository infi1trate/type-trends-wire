import test from "node:test";
import assert from "node:assert/strict";
import { readHealth, retryAfterMs, makeGate, healthUrl } from "../src/gate.js";

test("a slow or silent database means wait; a stale job does not", () => {
  assert.equal(readHealth(200, { status: "ok", database: null }).go, true);
  assert.equal(readHealth(200, { status: "down", database: null, jobs: [{ job: "wire", stale: true }] }).go, true);
  assert.equal(readHealth(200, { status: "down", database: { status: "slow" } }).go, false);
  assert.equal(readHealth(200, { database: { status: "bad" } }).go, false);
  assert.equal(readHealth(200, { safe_mode: { on: true } }).go, false);
  assert.equal(readHealth(0, null).go, false);
  assert.equal(readHealth(503, null).go, false);
});
test("Retry-After is read as seconds or a date and capped at five minutes", () => {
  assert.equal(retryAfterMs("12"), 12000);
  assert.equal(retryAfterMs("900"), 300000);
  assert.equal(retryAfterMs(null), null);
  assert.equal(retryAfterMs("Mon, 23 Nov 2026 04:00:30 GMT", Date.parse("2026-11-23T04:00:00Z")), 30000);
  assert.equal(retryAfterMs("Mon, 23 Nov 2026 03:00:00 GMT", Date.parse("2026-11-23T04:00:00Z")), null);
});
test("the health address is the site's own, whatever the ingest path", () => {
  assert.equal(healthUrl("https://slug.global/api/public/ingest-crawl"), "https://slug.global/api/public/health");
});
const clock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; }, add: (ms) => { t += ms; } }; };
const answers = (list) => { let i = 0; const calls = []; return { calls, fetchImpl: async (u) => { calls.push(u); const a = list[Math.min(i++, list.length - 1)]; if (a === null) throw new Error("no answer"); return { status: a.status ?? 200, json: async () => a.body }; } }; };
test("the gate waits out a slow database, then lets the post through", async () => {
  const c = clock(), a = answers([{ body: { database: { status: "slow" } } }, null, { body: { status: "ok", database: null } }]), said = [];
  const ready = makeGate({ endpoint: "https://x.test/api/public/ingest-crawl", fetchImpl: a.fetchImpl, sleep: c.sleep, now: c.now, log: (m) => said.push(m), limits: { gapMs: 1500, maxWaitMs: 20 * 60000, reuseMs: 20000, healthTimeoutMs: 100, waits: [30000, 60000, 120000] } });
  await ready();
  assert.equal(a.calls.length, 3); assert.equal(c.now(), 90000); assert.equal(said.length, 2); assert.match(said[0], /database is slow/); assert.match(said[1], /did not answer/);
});
test("a good health answer is reused for twenty seconds, and posts keep their gap", async () => {
  const c = clock(), a = answers([{ body: { status: "ok" } }]);
  const ready = makeGate({ endpoint: "https://x.test/api/public/ingest-crawl", fetchImpl: a.fetchImpl, sleep: c.sleep, now: c.now, log: () => {}, limits: { gapMs: 1500, maxWaitMs: 60000, reuseMs: 20000, healthTimeoutMs: 100, waits: [30000] } });
  await ready(); const t1 = c.now(); await ready(); await ready();
  assert.equal(a.calls.length, 1); assert.equal(c.now() - t1, 3000);
  c.add(21000); await ready(); assert.equal(a.calls.length, 2);
});
test("a database that stays slow stops the run with a plain reason", async () => {
  const c = clock(), a = answers([{ body: { database: { status: "slow" } } }]);
  const ready = makeGate({ endpoint: "https://x.test/api/public/ingest-crawl", fetchImpl: a.fetchImpl, sleep: c.sleep, now: c.now, log: () => {}, limits: { gapMs: 0, maxWaitMs: 5 * 60000, reuseMs: 20000, healthTimeoutMs: 100, waits: [30000, 60000, 120000] } });
  await assert.rejects(ready(), /site not ready after 6 min \(the site says its database is slow\)/);
});
