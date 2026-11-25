import { test } from "node:test";
import assert from "node:assert/strict";

test("text the database cannot hold is removed before a post is sent", async () => {
  const { cleanText } = await import("../src/core.js");
  const out = JSON.parse(JSON.stringify({ a: "he\u0000llo", b: ["x\ud83dy", { c: "ok \ud83d\ude00" }], n: 3 }, cleanText));
  assert.equal(out.a, "hello");
  assert.equal(out.b[0], "x\ufffdy");
  assert.equal(out.b[1].c, "ok \ud83d\ude00");
  assert.equal(out.n, 3);
  assert.ok(!JSON.stringify(out).includes("\\u0000"));
});
