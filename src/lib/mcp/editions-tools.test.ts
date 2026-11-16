// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const item = { id: "s1", type: "move", kicker: "Move", headline: "Stripe moves to serif", deck: null, at: "2026-11-16T08:00:00Z", sector: "fintech", sectorName: "Fintech", score: 72, why: { text: "Serif is rising in fintech.", basis: "measured" }, href: "/stories/s1" };
const edition = { day: "2026-11-16", title: "The Morning Line · 16 November 2026", href: "/morning/2026-11-16", final: false, as_of: "2026-11-16T12:00:00.000Z", window: { from: "2026-11-15T12:00:00.000Z", to: "2026-11-16T12:00:00.000Z" }, count: 1, thin: true,
  lead: item, more: [], moving: { pair: null, items: [] }, opening: null, figure: null, desk: [{ id: "h1", headline: "Held one", score: 40, reason: "below threshold", href: "/stories/h1" }], lastFull: null };
const loadMorning = vi.fn(async (day: string | null) => (day === "2020-01-01" ? null : { edition, archive: [{ day: "2026-11-16", title: edition.title, count: 1, lead: item.headline, final: false, href: edition.href }], today: "2026-11-16" }));
const loadSectorReport = vi.fn(async (sector: string) => ({ sector, name: "Fintech", title: "State of Fintech · Q4 2026", quarter: { key: "2026Q4", label: "Q4 2026", start: "", end: "" }, as_of: "2026-11-16T00:39:00Z", asOfText: "16 November 2026", href: `/sectors/${sector}`,
  brands: 30, coverage: { covered: 5, total: 8, enough: true }, note: null, signals: [{ key: "css:subgrid", name: "Subgrid layouts", dimension: "LAYOUT", basis: "measured", here: { stage: "Rising", share: 0.3, momentum_index: 80 }, all: { stage: "Steady", share: 0.2, momentum_index: 60 }, href: "/signals/css%3Asubgrid" }],
  contrast: { risingHere: [], risingElsewhere: [] }, whiteSpace: [], counterMoves: [], leaders: [{ domain: "stripe.com", name: "Stripe", rank: 2, href: "/brands/stripe.com", latest: null }], patterns: [], stories: [], storiesInQuarter: 0, basis: "Based on 30 brands tracked in Fintech.", blocks: [] }));
vi.mock("@/lib/editions/editions.server", () => ({ loadMorning: (d: string | null) => loadMorning(d), loadSectorReport: (s: string) => loadSectorReport(s) }));
import { handleMcp } from "./server.server";
const req = (name: string, args: unknown) => new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": "editions-test" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });

describe("MCP editions tools", () => {
  it("morning_line returns the edition as structured data with absolute urls; date is optional", async () => {
    const res = (await (await handleMcp(req("morning_line", {}))).json()).result;
    expect(res.isError).toBeFalsy();
    expect(loadMorning).toHaveBeenCalledWith(null);
    const out = JSON.parse(res.content[0].text);
    expect(out).toMatchObject({ day: "2026-11-16", thin: true, url: "https://type-trends-wire.lovable.app/morning/2026-11-16", rss: "https://type-trends-wire.lovable.app/morning/rss.xml" });
    expect(out.lead).toMatchObject({ id: "s1", score: 72, url: "https://type-trends-wire.lovable.app/stories/s1", why: { basis: "measured" } });
    expect(out.on_the_desk[0]).toMatchObject({ held_because: "below threshold" });
    expect((await (await handleMcp(req("morning_line", { date: "2020-01-01" }))).json()).result.isError).toBe(true);
    expect((await (await handleMcp(req("morning_line", { date: "16 Nov" }))).json()).result.isError).toBe(true);
  });
  it("sector_report returns the report for a library sector and rejects unknown ones", async () => {
    const res = (await (await handleMcp(req("sector_report", { sector: "fintech" }))).json()).result;
    expect(res.isError).toBeFalsy();
    const out = JSON.parse(res.content[0].text);
    expect(out).toMatchObject({ sector: "fintech", title: "State of Fintech · Q4 2026", url: "https://type-trends-wire.lovable.app/sectors/fintech", brands_tracked: 30 });
    expect(out.signals[0]).toMatchObject({ key: "css:subgrid", here: { stage: "Rising" }, all_sectors: { stage: "Steady" } });
    expect(out.leaders[0]).toMatchObject({ domain: "stripe.com", trendsetter_rank: 2 });
    expect((await (await handleMcp(req("sector_report", { sector: "crypto" }))).json()).result.isError).toBe(true);
  });
});
