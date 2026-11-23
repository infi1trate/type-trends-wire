import { describe, expect, it } from "vitest";
import { checkedEvents } from "./integrity.server";

// P2c · when the change checks can't be read, live changes are left out (fail closed) and the result now says so, so the brands
// directory and the rebrands list refuse to keep or store a result that is missing them (the short /brands of 22 Nov).
const failingDb = () => ({ from: () => ({ select: () => ({ in: async () => ({ data: null, error: new Error("statement timeout") }) }) }) });
const events = [
  { id: 1, type: "palette", source: "live", before: null, after: null },
  { id: 2, type: "palette", source: "wayback", before: null, after: null },
];

describe("checkedEvents failure flag", () => {
  it("a failed checks read keeps no live change and reports failed", async () => {
    const r = await checkedEvents(failingDb() as never, events);
    expect(r.failed).toBe(true);
    expect(r.tape.map(e => e.id)).toEqual([2]);
  });
  it("with no events to check nothing fails", async () => {
    const r = await checkedEvents(failingDb() as never, []);
    expect(r.failed).toBe(false);
    expect(r.tape).toEqual([]);
  });
});

// D1b · the newest check per change comes from the one-probe-per-change helper: the DISTINCT ON view read every older copy (2–3.3 s
// for 200 changes) and the anonymous three-second limit cut the rebrands list, so it was never stored for 5.8 hours.
describe("newest change check per change", () => {
  it("reads change_checks_latest_for, never the change_checks_latest view", async () => {
    const { latestChecks } = await import("./integrity.server");
    const seen: string[] = [];
    const db = {
      rpc: async (name: string, args: { _ids: number[] }) => { seen.push(`rpc ${name} ${args._ids.length}`); return { data: args._ids.map(id => ({ event_id: id, verdict: "pass", pass_fields: ["palette"], fields: {} })), error: null }; },
      from: (t: string) => { seen.push(`from ${t}`); return { select: () => ({ in: async () => ({ data: [], error: null }) }) }; },
    };
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);
    const r = await latestChecks(db as never, ids);
    expect(r.size).toBe(450);
    expect(seen.filter(s => s.startsWith("rpc"))).toEqual(["rpc change_checks_latest_for 200", "rpc change_checks_latest_for 200", "rpc change_checks_latest_for 50"]);
    expect(seen).not.toContain("from change_checks_latest");
  });
});
