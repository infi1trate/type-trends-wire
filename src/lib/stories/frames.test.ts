import { describe, expect, it } from "vitest";
import { AFTER_SLACK_MS, FRAME_LABEL, compareKind, storyFrames } from "./frames";
import { fxCapture } from "../data-stories/fixtures";

describe("story before/after fallback", () => {
  it("order: real crops, then frames redrawn from the stored layout, then text, then nothing", () => {
    expect(compareKind({ crops: true, frames: true, text: true })).toBe("crops");
    expect(compareKind({ crops: false, frames: true, text: true })).toBe("frames");
    expect(compareKind({ crops: false, frames: false, text: true })).toBe("text");
    expect(compareKind({ crops: false, frames: false, text: false })).toBe("none");
    expect(FRAME_LABEL).toBe("Redrawn from the stored layout");
  });
  it("frames pick the capture before the change and the one that showed it", () => {
    const caps = [fxCapture(1, "2026-10-01T00:00:00Z"), fxCapture(2, "2026-11-01T00:00:00Z", { bg: "#000000" }), fxCapture(3, "2026-11-20T00:00:00Z")];
    const f = storyFrames("a.com", caps, "2026-11-10T00:00:00Z")!;
    expect(f).not.toBeNull();
    expect(f.before.boxes.length).toBeGreaterThan(0); expect(f.after.boxes.length).toBeGreaterThan(0);
  });
  it("a change stamped just after its capture uses that capture as 'after' (within two days)", () => {
    expect(AFTER_SLACK_MS).toBe(2 * 864e5);
    const caps = [fxCapture(1, "2026-11-01T00:00:00Z"), fxCapture(2, "2026-11-16T13:58:00Z", { bg: "#000000" })];
    expect(storyFrames("neon.com", caps, "2026-11-16T14:05:00Z")).not.toBeNull();
    expect(storyFrames("neon.com", caps, "2026-11-20T14:05:00Z")).toBeNull();
  });
  it("no frames without two captures or without stored skeletons", () => {
    expect(storyFrames("a.com", [fxCapture(1, "2026-11-01T00:00:00Z")], "2026-11-10T00:00:00Z")).toBeNull();
    const bare = [fxCapture(1, "2026-10-01T00:00:00Z", { skeleton: null }), fxCapture(2, "2026-11-11T00:00:00Z", { skeleton: null })];
    expect(storyFrames("a.com", bare, "2026-11-10T00:00:00Z")).toBeNull();
  });
});
