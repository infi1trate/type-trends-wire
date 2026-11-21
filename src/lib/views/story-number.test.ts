import { describe, expect, it } from "vitest";
import { storyNumberTarget } from "./story-number";

describe("/stories/no/<n> redirect", () => {
  const id = "brand:coinbase.com:2026-11-20";
  it("keeps the Data view", () => { expect(storyNumberTarget(id, "?view=data")).toBe("/stories/brand%3Acoinbase.com%3A2026-11-20?view=data"); });
  it("keeps receipt and sector together", () => {
    expect(storyNumberTarget(id, "?view=data&receipt=story%3Abrand%3Acoinbase.com%3A2026-11-20&sector=fintech")).toBe("/stories/brand%3Acoinbase.com%3A2026-11-20?view=data&receipt=story%3Abrand%3Acoinbase.com%3A2026-11-20&sector=fintech");
  });
  it("adds nothing when there is no query", () => {
    expect(storyNumberTarget(id, "")).toBe("/stories/brand%3Acoinbase.com%3A2026-11-20");
    expect(storyNumberTarget(id, "?")).toBe("/stories/brand%3Acoinbase.com%3A2026-11-20");
  });
});
