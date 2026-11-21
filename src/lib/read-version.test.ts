import { describe, expect, it } from "vitest";
import { readVersion, visionReadVersion, IMAGE_RECIPE, READ_VERSION_LENGTH } from "./read-version";

describe("read version (I3b)", () => {
  it("is the stamp stored on every read made since 11 Nov 21:45 UTC, while model, prompt, labels and images stay the same", async () => {
    expect(await visionReadVersion("google/gemini-3-flash-preview")).toBe("f43f51b4993c");
  });
  it("changes when the model, the request, the label list or the image recipe changes", async () => {
    const base = { model: "m", request: { system: "a" }, vocab: { x: ["y"] }, recipe: IMAGE_RECIPE }, v = await readVersion(base);
    expect(v).toHaveLength(READ_VERSION_LENGTH);
    for (const other of [{ ...base, model: "n" }, { ...base, request: { system: "b" } }, { ...base, vocab: { x: ["z"] } }, { ...base, recipe: "fold only" }]) expect(await readVersion(other)).not.toBe(v);
  });
});
