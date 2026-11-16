import { describe, expect, it, vi } from "vitest";
import { st } from "../front/fixtures";

vi.mock("@/lib/stories/read.server", () => ({
  storyIndex: async () => [st("a", { number: 47, happened_at: "2026-11-16T10:00:00Z" }), st("k", { state: "killed", number: null, happened_at: "2026-11-16T11:00:00Z" })],
}));

describe("MCP stories output", () => {
  it("carries each story's permanent number and its /stories/no/ link", async () => {
    const tool = (await import("./tools/stories")).default as unknown as { handler: (a: Record<string, unknown>) => Promise<{ content: { text: string }[] }> };
    const out = JSON.parse((await tool.handler({ limit: 20 })).content[0]!.text) as { stories: { id: string; number: number | null; number_url: string | null }[] };
    expect(out.stories.map(s => [s.id, s.number])).toEqual([["a", 47]]);
    expect(out.stories[0]!.number_url).toMatch(/\/stories\/no\/47$/);
  });
});
