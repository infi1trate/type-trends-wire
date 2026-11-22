import { describe, expect, it } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { NO_CAPTURE_TEXT, beforeAfterAt, isIllustrated, patternCountLine, type CropRow } from "./crops";
import { changeSection, patternSection, storySection } from "./evidence-map";
import { brandModel } from "./brand-page";
import { patternIndex, patternModel, type PatternSite } from "./patterns";
import { storyEvidence, storyEventIds } from "./stories/evidence";
import { alertBaseline, readerRuns, READABLE_SANDBOX_RUN } from "./run-gap";
import { auditFixture } from "./agency/test-fixtures";
import { BrandView } from "@/components/read/BrandView";
import { PatternView } from "@/components/read/PatternViews";
import type { Signal } from "./signals";

const crop = (domain: string, section: string, captured_at: string, hash: string, last_seen_at = captured_at): CropRow => ({ domain, section, viewport: "desktop", captured_at, first_seen_at: captured_at, last_seen_at, path: `${domain}/${section}/${captured_at.slice(0, 10)}-${hash.slice(0, 8)}.webp`, width: 1280, height: 800, bytes: 1000, hash, run_id: "r" });
const brand = (crops: CropRow[] = []) => brandModel({ domain: "vercel.com", audit: { ...auditFixture(), domains: ["vercel.com"] }, events: auditFixture().events, peers: [], tiers: [], crops });
async function html(el: ReactElement) {
  const root = createRootRoute({ component: () => el });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/"] }) });
  await router.load();
  return renderToString(createElement(RouterProvider, { router } as never));
}

describe("pattern → section", () => {
  it("maps each pattern family to the section that illustrates it", () => {
    expect(patternSection("hero_media:video")).toBe("hero");
    expect(patternSection("hero_layout:split")).toBe("hero");
    expect(patternSection("components:pricing_table")).toBe("pricing");
    expect(patternSection("components:comparison_table")).toBe("pricing");
    expect(patternSection("components:cta_band")).toBe("cta");
    expect(patternSection("nav:mega_menu")).toBe("nav");
    expect(patternSection("footer:fat")).toBe("footer");
    expect(patternSection("css:subgrid")).toBe("hero");
    expect(patternSection("combo:big_type")).toBe("hero");
  });
});

describe("story change → section", () => {
  it("type and palette changes → hero; navigation → nav; pricing → pricing; rebrands → hero", () => {
    expect(changeSection({ kind: "event", type: "type_change" })).toBe("hero");
    expect(changeSection({ kind: "event", type: "palette_shift" })).toBe("hero");
    expect(changeSection({ kind: "event", type: "nav_change" })).toBe("nav");
    expect(changeSection({ kind: "event", type: "pricing_change" })).toBe("pricing");
    expect(changeSection({ kind: "event", type: "layout_change", fields: ["cta_radius_px"] })).toBe("cta");
    expect(changeSection({ kind: "event", type: "stack_change" })).toBeNull();
    expect(changeSection({ kind: "rebrand", reasons: ["font"] })).toBe("hero");
  });
  it("only MOVE, COUNTER-MOVE and REBRAND stories get a before/after section", () => {
    expect(storySection("move", [{ kind: "event", type: "nav_change" }])).toBe("nav");
    expect(storySection("rebrand", [{ kind: "rebrand", reasons: [] }])).toBe("hero");
    expect(storySection("shift", [{ kind: "event", type: "nav_change" }])).toBeNull();
    expect(storyEventIds(["event:12", "story:move:12", "story:move:9", "rebrand:x:y"])).toEqual([12, 9]);
  });
});

describe("BeforeAfter picks versions on either side of the event", () => {
  const v = [crop("a.com", "hero", "2026-09-01T06:00:00Z", "1111111111111111"), crop("a.com", "hero", "2026-09-20T06:00:00Z", "2222222222222222"), crop("a.com", "hero", "2026-10-05T06:00:00Z", "3333333333333333"), crop("a.com", "hero", "2026-10-20T06:00:00Z", "4444444444444444")];
  it("before = newest version before the change, after = earliest at or after it", () => {
    const p = beforeAfterAt(v, "2026-10-01T00:00:00Z")!;
    expect([p.before.hash, p.after.hash]).toEqual(["2222222222222222", "3333333333333333"]);
  });
  it("falls back (null) when one side is missing or the two look the same", () => {
    expect(beforeAfterAt(v, "2026-08-01T00:00:00Z")).toBeNull();
    expect(beforeAfterAt(v, "2026-12-01T00:00:00Z")).toBeNull();
    expect(beforeAfterAt([crop("a.com", "hero", "2026-09-01T06:00:00Z", "1111111111111111"), crop("a.com", "hero", "2026-10-05T06:00:00Z", "1111111111111111")], "2026-10-01T00:00:00Z")).toBeNull();
  });
});

const sig = (key: string): Signal => ({ key, name: key, dimension: "LAYOUT", basis: "measured", tier: "headline", reasons: [], scope: "all", stage: "Rising", share: 0.2, momentum: 1, direction: "rising", next_wave_score: 1, momentum_index: 60, confidence: "medium", confidence_reason: "", so_what: "", sites: 5, usable: 300, present: [] } as unknown as Signal);
const site = (domain: string, traits: string[], sector = "dev-tools"): PatternSite => ({ domain, name: null, sector, captured: "2026-11-14T00:00:00Z", traits });

describe("pattern header counts and the illustrated rule", () => {
  const signals = [sig("css:subgrid")];
  const sites = ["a.com", "b.com", "c.com", "d.com"].map(d => site(d, ["css:subgrid"])).concat(site("z.com", ["theme:dark"]));
  const heroes = (ds: string[]) => ds.map(d => crop(d, "hero", "2026-11-14T06:00:00Z", "abcdabcdabcdabcd"));
  it("states the real count", () => {
    expect(patternCountLine("Bento grids", 34, 21)).toBe("Bento grids · 34 examples · 21 with captures");
    expect(patternModel("css:subgrid", sites, signals, heroes(["a.com", "b.com"]))!.countLine).toMatch(/· 4 examples · 2 with captures$/);
  });
  it("2 captures is not illustrated, 3 is", () => {
    expect(isIllustrated(2)).toBe(false); expect(isIllustrated(3)).toBe(true);
    expect(patternModel("css:subgrid", sites, signals, heroes(["a.com", "b.com"]))!.illustrated).toBe(false);
    expect(patternModel("css:subgrid", sites, signals, heroes(["a.com", "b.com", "c.com"]))!.illustrated).toBe(true);
    expect(patternIndex(sites, signals, "all", heroes(["a.com", "b.com"]), { illustrated: true })).toEqual([]);
    expect(patternIndex(sites, signals, "all", heroes(["a.com", "b.com", "c.com"]), { illustrated: true }).map(p => [p.key, p.withCaptures])).toEqual([["css:subgrid", 3]]);
  });
  it("never shows a brand that does not show the pattern, and ignores stale crops", () => {
    const p = patternModel("css:subgrid", sites, signals, [...heroes(["z.com"]), crop("a.com", "hero", "2026-01-01T00:00:00Z", "1234123412341234")])!;
    expect(p.examples.map(e => e.domain)).not.toContain("z.com");
    expect(p.withCaptures).toBe(0);
  });
  it("pattern page renders captured examples first with credits", async () => {
    const p = patternModel("css:subgrid", sites, signals, heroes(["c.com", "d.com", "b.com"]))!;
    expect(p.examples.slice(0, 3).every(e => e.crop)).toBe(true);
    const out = await html(createElement(PatternView, { p }));
    expect(out).toContain('alt="c.com hero, captured 14 Nov 2026"');
    expect(out).toContain("/crops/c.com/hero/2026-11-14-abcdabcd.webp");
  });
});

describe("brand page evidence", () => {
  it("zero crops renders the honest fallback", async () => {
    const b = brand();
    expect(b.sections).toEqual([]);
    expect(b.timeline.every(t => t.compare === null)).toBe(true);
    const out = await html(createElement(BrandView, { b }));
    expect(out).toContain(NO_CAPTURE_TEXT);
    expect(out).toContain("data-crop-fallback");
    expect(out).not.toContain("<img");
  });
  it("crops on both sides of a move show a before/after on that timeline entry", async () => {
    const b = brand([crop("vercel.com", "hero", "2026-09-15T06:00:00Z", "aaaaaaaaaaaaaaaa"), crop("vercel.com", "hero", "2026-10-03T06:00:00Z", "bbbbbbbbbbbbbbbb"), crop("vercel.com", "nav", "2026-10-03T06:00:00Z", "cccccccccccccccc")]);
    expect(b.sections.map(s => [s.section, s.versions])).toEqual([["hero", 2], ["nav", 1]]);
    const move = b.timeline.find(t => t.id === "event:1")!;
    expect(move.section).toBe("hero");
    expect([move.compare?.before.hash, move.compare?.after.hash]).toEqual(["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"]);
    expect(b.timeline.find(t => t.id === "event:2")!.compare).toBeNull();
    const out = await html(createElement(BrandView, { b, section: "hero" }));
    expect(out).toContain("data-before-after");
    expect(out).toMatch(/Hero(<!-- -->)? history/);
  });
});

describe("story evidence", () => {
  const crops = [crop("vercel.com", "nav", "2026-09-15T06:00:00Z", "aaaaaaaaaaaaaaaa"), crop("vercel.com", "nav", "2026-10-03T06:00:00Z", "bbbbbbbbbbbbbbbb"), crop("linear.app", "hero", "2026-10-03T06:00:00Z", "cccccccccccccccc")];
  it("MOVE uses the mapped section's before/after, else falls back to the facts with a note", () => {
    const e = storyEvidence({ type: "move", domains: ["vercel.com"] }, [{ kind: "event", type: "nav_change" }], "2026-10-01T00:00:00Z", crops);
    expect([e.section, e.compare?.before.hash, e.compare?.after.hash]).toEqual(["nav", "aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"]);
    const none = storyEvidence({ type: "move", domains: ["vercel.com"] }, [{ kind: "event", type: "pricing_change" }], "2026-10-01T00:00:00Z", crops);
    expect(none.compare).toBeNull(); expect(none.after).toBeNull(); expect(none.note).toBe("No capture of this section yet.");
  });
  it("I1: a crop only after the change is shown alone, credited; no note", () => {
    const e = storyEvidence({ type: "move", domains: ["vercel.com"] }, [{ kind: "event", type: "nav_change" }], "2026-09-10T00:00:00Z", crops);
    expect(e.compare).toBeNull();
    expect(e.after?.hash).toBe("aaaaaaaaaaaaaaaa");
    expect(e.after?.caption).toContain("vercel.com");
    expect(e.note).toBeNull();
  });
  it("ROUNDUP shows member brands' current hero crops, cards where missing", () => {
    const e = storyEvidence({ type: "roundup", domains: ["linear.app", "vercel.com"] }, [], "2026-10-01T00:00:00Z", crops);
    expect(e.grid!.map(g => [g.domain, !!g.crop])).toEqual([["linear.app", true], ["vercel.com", false]]);
  });
});

describe("reader runs never fall back to a sandbox run once a newer real run exists", () => {
  const r = (id: number, at: string) => ({ id, at });
  const ok = [r(9, "2026-10-01T00:00:00Z"), r(13, "2026-11-09T00:00:00Z"), r(14, "2026-11-12T00:00:00Z"), r(15, "2026-11-13T00:00:00Z")], real = [ok[0]!, ok[1]!];
  it("today: run 15 (the sandbox run carrying the Phase 12 outputs)", () => {
    expect(READABLE_SANDBOX_RUN).toBe(15);
    const x = readerRuns(ok, real);
    expect([x.latest?.id, x.prev.map(p => p.id), x.mode]).toEqual([15, [14, 13], "sandbox"]);
  });
  it("a real run newer than the newest sandbox run takes over", () => {
    const x = readerRuns([...ok, r(16, "2026-11-16T00:00:00Z")], [...real, r(16, "2026-11-16T00:00:00Z")]);
    expect([x.latest?.id, x.prev.map(p => p.id), x.mode]).toEqual([16, [13, 9], "real"]);
  });
  it("a later sandbox run never replaces it", () => {
    const x = readerRuns([...ok, r(16, "2026-11-16T00:00:00Z"), r(17, "2026-11-17T00:00:00Z")], [...real, r(16, "2026-11-16T00:00:00Z")]);
    expect(x.latest?.id).toBe(16);
  });
  it("sandbox runs past the anchor are never read before the switch either", () => {
    expect(readerRuns([...ok, r(16, "2026-11-16T00:00:00Z")], real).latest?.id).toBe(15);
  });
});

describe("stage-change alerts compare against a run at least MIN_RUN_GAP_DAYS older", () => {
  const real = [{ id: 9, at: "2026-10-01T00:00:00Z" }, { id: 13, at: "2026-11-09T00:00:00Z" }];
  it("a rerun one day later compares against the older real run, not the rerun's neighbour", () => {
    expect(alertBaseline(real, { id: 16, at: "2026-11-10T00:00:00Z" })?.id).toBe(9);
  });
  it("seven days later the previous real run is the baseline", () => {
    expect(alertBaseline(real, { id: 16, at: "2026-11-16T00:00:00Z" })?.id).toBe(13);
  });
  it("no real run old enough → no baseline, so no stage-change alerts", () => {
    expect(alertBaseline([{ id: 13, at: "2026-11-09T00:00:00Z" }], { id: 16, at: "2026-11-10T00:00:00Z" })).toBeNull();
  });
});
