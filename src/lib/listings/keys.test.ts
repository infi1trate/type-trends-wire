// A stored version must compare equal to the same version sent again, whatever order the database returns an object's keys in.
import { describe, expect, it } from "vitest";
import { shotsKey, versionKey, type VersionRow } from "./contract";

const sent: VersionRow = {
  store: "us", app_id: "1", version: "1.0", version_at: "2026-11-24T15:40:58.000Z", notes: "n", notes_chars: 1, price: 0, currency: "USD", size_mb: 198.8, min_os: "17.0", languages: 1, age: "4+",
  shots: { phone: 9, pad: 0, tv: 0, way: "portrait", palettes: [[{ hex: "#FAF5EC", share: 0.8094 }], [{ hex: "#f9f5eb", share: 0.6604 }]] },
};
describe("listing version comparison", () => {
  it("is the same for a row read back with its keys reordered, its date reformatted and its numbers as text", () => {
    const stored = {
      ...sent, version_at: "2026-11-24T15:40:58+00:00", price: "0" as unknown as number, size_mb: "198.8" as unknown as number,
      shots: JSON.parse('{"tv":0,"pad":0,"way":"portrait","phone":9,"palettes":[[{"share":0.8094,"hex":"#FAF5EC"}],[{"share":0.6604,"hex":"#F9F5EB"}]]}'),
    } as VersionRow;
    expect(versionKey(stored)).toBe(versionKey(sent));
  });
  it("differs when a screenshot fact differs", () => {
    expect(versionKey({ ...sent, shots: { ...sent.shots, phone: 8 } })).not.toBe(versionKey(sent));
    expect(versionKey({ ...sent, shots: { ...sent.shots, palettes: [sent.shots.palettes[0]!] } })).not.toBe(versionKey(sent));
    expect(shotsKey(null)).toBeNull();
  });
});
