import { describe, expect, it } from "vitest";
import { FOCUS_TARGETS, shouldMoveFocus } from "./route-focus";

describe("focus after a route change", () => {
  it("moves to the new page's h1 when the page changes", () => {
    expect(shouldMoveFocus({ pathname: "/" }, { pathname: "/signals" })).toBe(true);
    expect(FOCUS_TARGETS[0]).toBe("#ed-main h1");
  });
  it("stays put on the first load, a filter change or an in-page anchor", () => {
    expect(shouldMoveFocus(undefined, { pathname: "/signals" })).toBe(false);
    expect(shouldMoveFocus({ pathname: "/signals" }, { pathname: "/signals" })).toBe(false);
    expect(shouldMoveFocus({ pathname: "/" }, { pathname: "/signals", hash: "sig-archive" })).toBe(false);
  });
});
