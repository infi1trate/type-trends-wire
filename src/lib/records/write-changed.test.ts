// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { stableHash, stableJson } from "../stable-json";

const db = vi.hoisted(() => ({ hashes: new Map<string, string>(), upserts: [] as string[], stamped: [] as string[] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => {
  let op = "select", keys: string[] = [], rows: { key: string; body_hash: string }[] = [];
  const run = () => {
    if (op === "select") return { data: keys.filter(k => db.hashes.has(k)).map(key => ({ key, body_hash: db.hashes.get(key)! })), error: null };
    if (op === "update") { db.stamped.push(...keys); return { data: null, error: null }; }
    for (const r of rows) { db.upserts.push(r.key); db.hashes.set(r.key, r.body_hash); }
    return { data: null, error: null };
  };
  const q = { select: () => q, update: () => { op = "update"; return q; }, upsert: (r: typeof rows) => { op = "upsert"; rows = r; return Promise.resolve(run()); },
    in: (_c: string, k: string[]) => { keys = k; return Promise.resolve(run()); } };
  return q;
} } }));

describe("D1 Part 3 · written only when something changed", () => {
  it("reads a reordered copy of the same value as the same", async () => {
    expect(stableJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(stableJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
    expect(await stableHash({ a: 1, b: 2 })).toBe(await stableHash({ b: 2, a: 1 }));
    expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 2 }));
  });
  it("a stored page whose body is unchanged is not rewritten: only its time moves", async () => {
    const { writeRecords } = await import("./store.server");
    db.upserts = []; db.stamped = [];
    expect(await writeRecords([{ key: "signals", body: { x: 1, y: [2] }, source: "wire" }, { key: "front-tape", body: { t: 1 }, source: "wire" }])).toEqual(["signals", "front-tape"]);
    db.upserts = []; db.stamped = [];
    // The same bodies with their keys in another order, and one real change.
    expect(await writeRecords([{ key: "signals", body: { y: [2], x: 1 }, source: "wire" }, { key: "front-tape", body: { t: 2 }, source: "wire" }])).toEqual(["front-tape"]);
    expect(db.stamped).toEqual(["signals"]);
    expect(db.upserts).toEqual(["front-tape"]);
  });
  it("a verdict read back with its keys reordered is the same verdict (no new change_checks row)", async () => {
    const { sameCheck } = await import("../integrity.server");
    const a = { verdict: "pass", pass: ["color", "type"], fields: { color: { ok: true, n: 2 }, type: { n: 1, ok: false } } } as never;
    const b = { verdict: "pass", pass: ["type", "color"], fields: { type: { ok: false, n: 1 }, color: { n: 2, ok: true } } } as never;
    expect(sameCheck(a, b)).toBe(true);
    expect(sameCheck(a, { ...(b as object), verdict: "fail" } as never)).toBe(false);
  });
});
