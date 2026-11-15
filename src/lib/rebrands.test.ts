import { describe, expect, it } from "vitest";
import { buildRebrands, identityChanges, wireMatch, rebrandCounts, filterRebrands, type EventIn, type SideIn } from "./rebrands";

const ev = (o: Partial<EventIn>): EventIn => ({ id: 1, domain: "acme.com", source: "live", type: "type_change", before: {}, after: {}, effective_at: "2026-11-10T00:00:00Z", detected_at: "2026-11-12T00:00:00Z", snapshot_id: 20, prev_snapshot_id: 10, ...o });
const side = (o: Partial<SideIn>): SideIn => ({ id: 10, captured_at: "2026-11-01T00:00:00Z", h1: "Inter", body: "Inter", theme: "light", bg: "#FFFFFF", accent: "#2563EB", palette: ["#FFFFFF", "#2563EB"], hero_media: "image", archive_url: null, tags: { hero_layout: "centered_stack", aesthetic: ["minimal"], tone: ["technical"] }, ...o });
const sites = [{ domain: "acme.com", sector: "fintech", name: null }];
const fc = [
  { dimension: "headline", value: "serif", scope: "fintech", stage: "accelerating", status: "ok", current_share: 0.18, momentum: 1.2 },
  { dimension: "theme", value: "dark", scope: "all", stage: "peaking", status: "ok", current_share: 0.4, momentum: 0.1 },
];
const run = (events: EventIn[], snaps = [side({}), side({ id: 20, captured_at: "2026-11-12T00:00:00Z", h1: "Fraunces" })], wire: Parameters<typeof buildRebrands>[0]["wire"] = []) => buildRebrands({ events, sites, snapshots: snaps, forecasts: fc, wire, google: new Set(["fraunces", "inter"]) });

describe("rebrand detection", () => {
  it("counts a headline font change", () => {
    const [r] = run([ev({ before: { h1: "Inter" }, after: { h1: "Fraunces" } })]);
    expect(r!.reasons).toEqual(["font"]);
    expect(r!.after.h1_google).toBe(true);
    expect(r!.confirmed_at).toBe("2026-11-12T00:00:00Z");
  });
  it("ignores an accent shift within the same hue, counts a hue change", () => {
    expect(identityChanges([ev({ type: "palette_shift", before: { accent: "#2563EB" }, after: { accent: "#1D4ED8" } })])).toEqual([]);
    expect(identityChanges([ev({ type: "palette_shift", before: { accent: "#2563EB" }, after: { accent: "#DC2626" } })])[0]!.reasons).toEqual(["accent"]);
  });
  it("counts a theme flip", () => {
    expect(identityChanges([ev({ type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" } })])[0]!.reasons).toEqual(["theme"]);
  });
  it("calls ≥3 changed measured fields in one confirmed change a redesign", () => {
    const g = identityChanges([ev({ type: "layout_change", before: { hero_media: "image", grid_max_cols: 3 }, after: { hero_media: "video", grid_max_cols: 4 } }), ev({ id: 2, type: "stack_change", before: { cta_radius_px: 4 }, after: { cta_radius_px: 999 } })]);
    expect(g[0]!.reasons).toEqual(["redesign"]);
    expect(identityChanges([ev({ type: "layout_change", before: { hero_media: "image", grid_max_cols: 3 }, after: { hero_media: "video", grid_max_cols: 4 } })])).toEqual([]);
  });
  it("excludes AI-tag-only and message changes", () => {
    expect(identityChanges([ev({ type: "aesthetic_shift", before: { aesthetic: ["minimal"] }, after: { aesthetic: ["editorial"] } }), ev({ id: 3, type: "message_pivot", before: { h1: "a" }, after: { h1: "b" } })])).toEqual([]);
  });
  it("labels wayback changes ARCHIVE with both capture links", () => {
    const [r] = run([ev({ source: "wayback", before: { h1: "inter" }, after: { h1: "fraunces" }, effective_at: "2023-04-01T00:00:00Z" })], [side({ archive_url: "https://web.archive.org/web/2023if_/a" }), side({ id: 20, captured_at: "2023-07-01T00:00:00Z", h1: "Fraunces", archive_url: "https://web.archive.org/web/2023b/a" })]);
    expect(r!.source).toBe("archive");
    expect(r!.links.archive).toBe("https://web.archive.org/web/2023b/a");
    expect(r!.links.archive_before).toBe("https://web.archive.org/web/2023if_/a");
  });
  it("drops changes before 2021", () => {
    expect(run([ev({ source: "wayback", before: { h1: "a" }, after: { h1: "b" }, effective_at: "2020-06-01T00:00:00Z" })], [side({}), side({ id: 20, captured_at: "2020-07-01T00:00:00Z" })])).toEqual([]);
  });
  it("writes the read line from forecast stages", () => {
    const [r] = run([ev({ before: { h1: "Inter" }, after: { h1: "Fraunces" } })]);
    expect(r!.read).toBe("headline Inter → Fraunces; adopted rising serif headlines — ahead of 82% of fintech");
  });
  it("does not treat missing AI tags as a change", () => {
    const [r] = run([ev({ before: { h1: "Inter" }, after: { h1: "Fraunces" } })], [side({ tags: null }), side({ id: 20, captured_at: "2026-11-12T00:00:00Z", h1: "Fraunces", tags: { hero_layout: "split_left_text", aesthetic: ["editorial"], tone: ["premium"] } })]);
    expect(r!.new_traits.map(t => t.trait)).toEqual(["headline:serif"]);
  });
  it("matches wire coverage within ±14 days only", () => {
    const w = (id: number, at: string, title: string) => ({ id, title, excerpt: null, url: `https://news/${id}`, source: "itsnicethat", source_kind: "rss", published_at: at });
    expect(wireMatch("acmebank.com", null, "2026-11-12T00:00:00Z", [w(1, "2026-12-10T00:00:00Z", "Acmebank unveils new identity")])).toBeNull();
    expect(wireMatch("acmebank.com", null, "2026-11-12T00:00:00Z", [w(2, "2026-11-20T00:00:00Z", "Acmebank unveils new identity")])!.url).toBe("https://news/2");
    expect(wireMatch("notion.so", null, "2026-11-12T00:00:00Z", [w(3, "2026-11-13T00:00:00Z", "the notion of a brand")])).toBeNull();
  });
  it("counts and filters", () => {
    const rows = [{ sector: "ai", source: "live" as const, confirmed_at: "2026-11-01T00:00:00Z" }, { sector: "fintech", source: "archive" as const, confirmed_at: "2023-04-01T00:00:00Z" }];
    expect(rebrandCounts(rows, new Date("2026-11-14T00:00:00Z"))).toMatchObject({ total: 2, live: 1, archive: 1, this_quarter: 1 });
    expect(filterRebrands(rows, { source: "archive" })).toHaveLength(1);
    expect(filterRebrands(rows, { year: 2026 })).toHaveLength(1);
    expect(filterRebrands(rows, { sector: "fintech", since: "2024-01-01" })).toHaveLength(0);
  });
});
