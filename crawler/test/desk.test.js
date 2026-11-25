import test from "node:test";
import assert from "node:assert/strict";
import { DESKS, CARRIED, prepare, summary, isRefusal } from "../src/desk.js";

test("desk carrier: desks only, carried actions only, the actor comes from the input", () => {
  assert.deepEqual(prepare("Standards", '{"action":"kill","id":"news:1","reason":"Not about the tracked brand"}'),
    { send: { action: "kill", id: "news:1", reason: "Not about the tracked brand", actor: "standards" } });
  // the owner never acts from here, and an owner's confirmation phrase is dropped
  assert.match(prepare("owner", '{"action":"kill","id":"x","reason":"y"}').error, /not a desk/);
  assert.equal(prepare("publisher", '{"action":"propose","kind":"chart","text":"t","confirm":"owner confirms wire_only","actor":"owner"}').send.confirm, undefined);
  assert.equal(prepare("publisher", '{"action":"propose","kind":"chart","text":"t","actor":"owner"}').send.actor, "publisher");
  // owner actions and reads are not carried
  for (const a of ["wire_only", "spend_cap", "living_approve", "living_rollback", "memory", "queue", "newsroom", "staff"]) {
    assert.match(prepare("editor in chief", JSON.stringify({ action: a })).error, /not carried/, a);
    assert.ok(!CARRIED.includes(a));
  }
  assert.match(prepare("standards", '{"action":"kill","id":"x"}').error, /needs a reason/);
  assert.match(prepare("standards", '{"action":"hold","id":"x"}').error, /a hold needs a reason/);
  assert.match(prepare("news", '{"action":"wire_drop","pick":3}').error, /a wire_drop needs a reason/);
  assert.match(prepare("data", '{"action":"finding_close","finding":9}').error, /needs a reason/);
  assert.deepEqual(prepare("data", '{"action":"finding_close","finding":9,"reason":"Checked by hand: the label is right"}'),
    { send: { action: "finding_close", finding: 9, reason: "Checked by hand: the label is right", actor: "data" } });
  assert.equal(prepare("standards", '{"action":"hold","id":"x","reason":"Thin"}').send.action, "hold");
  assert.equal(prepare("news", '{"action":"note","subject":"brand:x.com","text":"t"}').send.action, "note");
  assert.match(prepare("standards", "kill it").error, /not JSON/);
  assert.match(prepare("standards", "[1]").error, /one JSON object/);
  assert.ok(DESKS.includes("copy desk") && !DESKS.includes("owner"));
});

test("desk carrier: only the verdict of the door's answer is printed", () => {
  const s = summary(200, JSON.stringify({ ok: true, decision: "done", level: "ships alone", queue: [{ id: "secret-ish" }], log: ["x"], note: "internal" }));
  assert.equal(s, 'door answered 200 {"ok":"true","decision":"done","level":"ships alone"}');
  assert.equal(summary(403, "<html>nope</html>"), "door answered 403 {}");
});

test("a refusal by the door is an answer, not a failed run; a wrong key or a dead door still fails", () => {
  for (const st of [400, 409, 422]) assert.equal(isRefusal(st), true);
  for (const st of [200, 201, 202, 401, 403, 404, 429, 500, 502, 503]) assert.equal(isRefusal(st), false);
});
