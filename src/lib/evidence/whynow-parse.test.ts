import { describe, expect, it } from "vitest";
import { parseWhy } from "./whynow";
const dossier = [{ id: "e1", date: "2026-01-01", link: "https://example.com", source: "MDN" }] as never;
describe("parseWhy", () => {
  it("reads an answer sent as JSON text the same as an object", () => {
    const obj = { known: [{ entry: "e1", sentence: "S." }], likely: [], read: ["Our read: x."] };
    expect(parseWhy(JSON.stringify(obj), dossier, [])).toEqual(parseWhy(obj, dossier, []));
    expect(parseWhy("```json\n" + JSON.stringify(obj) + "\n```", dossier, [])?.known.length).toBe(1);
  });
  it("refuses text that is not JSON", () => { expect(parseWhy("not json", dossier, [])).toBeNull(); });
});
