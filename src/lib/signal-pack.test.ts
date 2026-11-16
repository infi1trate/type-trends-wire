import { describe, expect, it } from "vitest";
import { packSnapshot, unpackSnapshot } from "./signal-pack";
import type { SignalSnapshot } from "./signals";

const snap: SignalSnapshot = { run_id: 7, computed_at: "2026-11-16T00:00:00Z", prev_runs: [6, 5], prev: [["font:inter", ["rising", null]]], rows: [
  { dimension: "font", value: "inter", scope: "all", status: "ok", stage: "rising", momentum: 0.123456789, current_share: 0.4123456789, next_wave_score: null, present: ["curation"], sites: 120, usable: 5 },
  { dimension: "css", value: "has", scope: "fintech", status: "ok", stage: null, momentum: null, current_share: 0.05, next_wave_score: 0.7, present: [], sites: null, usable: null },
] };
describe("signal snapshot packing", () => {
  it("is lossless", () => { expect(unpackSnapshot(packSnapshot(snap))).toEqual(snap); });
  it("is smaller on the wire", () => { expect(JSON.stringify(packSnapshot(snap)).length).toBeLessThan(JSON.stringify(snap).length); });
  it("passes an unpacked snapshot through", () => { expect(unpackSnapshot(snap)).toBe(snap); });
});
