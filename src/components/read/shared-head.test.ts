import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SHARED_PATHS } from "./SharedHead";

describe("A4 · shared headline transition and reduced motion", () => {
  it("only story, brand and study pages share a headline", () => {
    expect(SHARED_PATHS.test("/stories/abc")).toBe(true);
    expect(SHARED_PATHS.test("/brands/stripe.com")).toBe(true);
    expect(SHARED_PATHS.test("/studies/x")).toBe(true);
    expect(SHARED_PATHS.test("/signals/x")).toBe(false);
    expect(SHARED_PATHS.test("/stories")).toBe(false);
  });
  it("reduced motion drops the shared name, the placeholder sweep and the listener", () => {
    const css = readFileSync("src/styles.css", "utf8"), src = readFileSync("src/components/read/SharedHead.tsx", "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .vt-head { view-transition-name: none; } }");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .ph-b::after { animation: none;");
    expect(src).toContain('matchMedia?.("(prefers-reduced-motion: reduce)").matches) return');
  });
});
