import { describe, expect, it } from "vitest";
import { citationHref } from "./issue";

describe("stored receipts written under the old name", () => {
  it("a wire citation on the old origin becomes a link on this site; other sites pass through", () => {
    const refs = { "wire:1": { label: "x", url: "https://type-trends-wire.lovable.app/?panel=brief&trait=css%3Asubgrid" }, "wire:2": { label: "y", url: "https://example.com/a" } };
    expect(citationHref({ kind: "wire", id: "1" }, refs)).toBe("/?panel=brief&trait=css%3Asubgrid");
    expect(citationHref({ kind: "wire", id: "2" }, refs)).toBe("https://example.com/a");
  });
});
