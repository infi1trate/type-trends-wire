// W3d-c Part 4 · a removal (icon_remove, art_remove) rewrites the stored copies that can show the app or the work straight away, from
// rows read after it, and clears the copies the server that took it holds in memory; no read is added to a reader's request.
import { describe, expect, it } from "vitest";
import { afterRemoval, copiesFor, inputPredates, type RemovalDeps } from "./removal.server";

function fake(o: { slow?: string; fail?: string } = {}) {
  const log: string[] = [], written = new Map<string, unknown>();
  const deps: RemovalDeps = {
    forget: () => { log.push("forget"); },
    compute: async key => { log.push(`compute ${key}`); if (key === o.fail) throw new Error("boom"); if (key === o.slow) return new Promise(() => {}); return { key, fresh: true }; },
    write: async rows => { for (const r of rows) { written.set(r.key, r.body); log.push(`write ${r.key}`); } return rows.map(r => r.key); },
  };
  return { deps, log, written };
}

describe("an app removed on request (icon_remove)", () => {
  it("rewrites study No. 8 and the Studies home at once, between two forgets of this server's copies", async () => {
    const f = fake();
    const r = await afterRemoval("icon", f.deps, Date.now() + 20_000);
    expect(r).toEqual({ rewritten: ["data-story:the-colour-app-icons-sit-on", "data-index"], held: [], failed: [] });
    expect(f.log).toEqual(["forget", "compute data-story:the-colour-app-icons-sit-on", "write data-story:the-colour-app-icons-sit-on", "compute data-index", "write data-index", "forget"]);
  });
  it("a study copy that cannot be rebuilt in time is hidden at once (readers see 'being prepared', the sweep rebuilds it first)", async () => {
    const f = fake({ fail: "data-story:the-colour-app-icons-sit-on" });
    const r = await afterRemoval("icon", f.deps, Date.now() + 20_000);
    expect(r.held).toEqual(["data-story:the-colour-app-icons-sit-on"]);
    expect(f.written.get("data-story:the-colour-app-icons-sit-on")).toEqual({ kind: "missing" });
    expect(r.rewritten).toEqual(["data-index"]);
  });
});

describe("a museum work removed on request (art_remove)", () => {
  it("rewrites both museum studies and the Studies home at once, between two forgets", async () => {
    const f = fake();
    const r = await afterRemoval("art", f.deps, Date.now() + 20_000);
    expect(r.rewritten).toEqual(["data-story:nearest-in-the-museum", "data-story:colours-the-museum-does-not-hold", "data-index"]);
    expect(f.log[0]).toBe("forget");
    expect(f.log.at(-1)).toBe("forget");
  });
  it("past the time it is given, the rest of the study copies are hidden, not left showing the work", async () => {
    const f = fake({ slow: "data-story:nearest-in-the-museum" });
    const r = await afterRemoval("art", f.deps, Date.now() + 50);
    expect(r.held).toEqual(["data-story:nearest-in-the-museum", "data-story:colours-the-museum-does-not-hold"]);
    expect(r.failed).toEqual(["data-index"]); // names no work; the sweep rewrites it
  });
});

describe("jobs never write a removed app or work back", () => {
  it("a cached study input loaded before the newest removal is dropped; one loaded after is kept", () => {
    expect(inputPredates(1_000, 2_000)).toBe(true);
    expect(inputPredates(3_000, 2_000)).toBe(false);
    expect(inputPredates(undefined, 2_000)).toBe(false);
    expect(inputPredates(1_000, 0)).toBe(false);
  });
  it("the copies named are the ones that can show it", () => {
    expect(copiesFor("icon")).toEqual(["data-story:the-colour-app-icons-sit-on", "data-index"]);
    expect(copiesFor("art")).toEqual(["data-story:nearest-in-the-museum", "data-story:colours-the-museum-does-not-hold", "data-index"]);
  });
});
