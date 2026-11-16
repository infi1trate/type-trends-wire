import { test } from "node:test";
import assert from "node:assert/strict";
import { healthVerdict, workflowTitle, HEALTH_TITLE } from "../src/watchdog.js";

test("health verdicts", () => {
  assert.equal(healthVerdict(404, null).state, "skip");
  assert.deepEqual(healthVerdict(200, { status: "ok", jobs: [] }), { state: "ok", status: "ok" });
  const down = healthVerdict(0, null, "2026-11-14T00:00:00Z");
  assert.equal(down.state, "alert"); assert.match(down.body, /network error/);
  assert.equal(healthVerdict(502, null).status, "unreachable");
  const v = healthVerdict(200, { status: "degraded", checked_at: "t", jobs: [
    { job: "wire", stale: false, last_status: "ok", consecutive_failures: 0 },
    { job: "forecast", stale: true, last_status: "ok", last_ok_at: "2026-11-01", expected_every: "7d", consecutive_failures: 0, note: "a|b" },
    { job: "ai-worker", stale: false, last_status: "error", consecutive_failures: 3 },
  ] });
  assert.equal(v.state, "alert");
  assert.match(v.body, /\*\*DEGRADED\*\*/);
  assert.match(v.body, /\| forecast \| ok \| 2026-11-01 \| 7d \| 0 \| a\/b \|/);
  assert.match(v.body, /\| ai-worker \| error \|/);
  assert.doesNotMatch(v.body, /\| wire \|/);
});

test("issue titles are stable", () => {
  assert.equal(HEALTH_TITLE, "slug health check failing");
  assert.equal(workflowTitle("crawl"), "Workflow failing: crawl");
});
