// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fxInput } from "@/lib/data-stories/fixtures";
import { bigTypeStory } from "@/lib/data-stories/stories";
import { indexRows } from "@/lib/data-stories/build";

const story = bigTypeStory(fxInput(), new Map(), { slug: "who-went-big-first", number: 2, question: "Who went big first?", deck: "D", template: "Adoption timeline", collection: { label: "Signal: Big type", href: "/signals/combo%3Abig_type" }, related: [] });
vi.mock("@/lib/data-stories/page.server", () => ({
  loadDataIndex: async () => ({ rows: indexRows(null, "2026-11-16T00:00:00Z") }),
  loadDataStory: async (slug: string) => (slug === "who-went-big-first" ? { kind: "live", story } : slug === "where-did-fintechs-colour-go" ? { kind: "draft", number: 3, question: "Where did fintech's colour go?", deck: "", template: "", reason: "Only 5 quarters." } : { kind: "missing" }),
}));
import { handleMcp } from "./server.server";
const req = (args: unknown) => new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "data_stories", arguments: args } }) });
const call = async (args: unknown) => (await (await handleMcp(req(args))).json()).result;

describe("MCP data_stories", () => {
  it("lists every story with status and absolute urls", async () => {
    const out = JSON.parse((await call({})).content[0].text);
    expect(out.stories.map((s: { number: number }) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(out.stories[1]).toMatchObject({ slug: "who-went-big-first", status: "live", url: "https://slug.global/data/who-went-big-first" });
    expect(out.stories[2]).toMatchObject({ status: "draft", url: null });
  });
  it("returns one story's steps as text with their figures and receipts", async () => {
    const out = JSON.parse((await call({ slug: "who-went-big-first" })).content[0].text);
    expect(out.steps).toHaveLength(story.steps.length);
    expect(out.steps[0].figures.length).toBeGreaterThan(0);
    expect(out.steps[0].figures[0].receipt).toMatch(/^https:\/\/slug\.global\//);
    expect(out.urls).toMatchObject({ image: "https://slug.global/data/who-went-big-first.png", embed: "https://slug.global/data/embed/who-went-big-first?step=1" });
    expect(out.basis.rule).toMatch(/well-covered/);
  });
  it("drafts carry their reason; unknown slugs are an error", async () => {
    expect(JSON.parse((await call({ slug: "where-did-fintechs-colour-go" })).content[0].text)).toMatchObject({ status: "draft", draft_reason: "Only 5 quarters." });
    expect((await call({ slug: "no-such-story" })).isError).toBe(true);
  });
});
