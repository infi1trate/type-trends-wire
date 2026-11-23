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
