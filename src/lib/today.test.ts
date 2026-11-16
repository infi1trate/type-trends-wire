import { describe, it, expect } from "vitest";
import { buildToday, stageChanges, type TodayInput } from "./today";

const NOW = "2026-11-15T18:00:00Z";
const base: TodayInput = {
  now: NOW,
  runs: { latest: { id: 13, computed_at: "2026-11-15T15:33:00Z" }, previous: { id: 9, computed_at: "2026-11-14T00:35:00Z" } },
  stages: {
    latest: [{ dimension: "css", value: "subgrid", stage: "peaking", momentum: 4.8, current_share: 0.12 }, { dimension: "components", value: "bento_grid", stage: "accelerating", momentum: 1.2, current_share: 0.3 }, { dimension: "theme", value: "dark", stage: "flat", momentum: 0, current_share: 0.36 }],
    previous: [{ dimension: "css", value: "subgrid", stage: "accelerating", momentum: 3, current_share: 0.1 }, { dimension: "components", value: "bento_grid", stage: "emerging", momentum: 1, current_share: 0.25 }, { dimension: "theme", value: "dark", stage: "flat", momentum: 0, current_share: 0.35 }],
  },
  alerts: [{ title: "BREAKOUT $SUBGRID +4.8 pts/q in all", url: "https://type-trends-wire.lovable.app/?panel=brief&trait=css%3Asubgrid", source: "DSGN/TERMINAL", published_at: "2026-11-15T15:34:00Z", ref: "css:subgrid" }, { title: "x", url: "u", source: "s", published_at: "2026-11-15T15:34:00Z" }],
  wire: { count24h: 42, latest: { title: "A new serif from Klim", url: "https://x", source: "Dezeen", published_at: "2026-11-15T17:50:00Z" } },
  event: { domain: "lattice.com", summary: "hero media none → image", detected_at: "2026-11-15T09:00:00Z", sector: "enterprise-saas" },
  crawl: { finished_at: "2026-11-10T23:10:00Z", sites: 1012 },
  type: { family: "Fraunces", delta7: 31, snapshot: "2026-11-15" },
};

describe("TODAY", () => {
  it("is deterministic and leads with stage moves in plain words", () => {
    const t = buildToday(base);
    expect(buildToday(base)).toEqual(t);
    expect(t.date).toBe("2026-11-15");
    expect(t.lines).toHaveLength(5);
    expect(t.lines[0]!.text).toBe("Bento grids moved from Emerging to Rising across all sectors (30% of sites)");
    expect(t.lines[1]).toMatchObject({ text: "Subgrid layouts moved from Rising to Peaking across all sectors (12% of sites)", href: "/terminal?panel=brief&trait=css%3Asubgrid", dimension: "LAYOUT", target: "trait" });
    expect(t.lines[2]!.text).toBe("New alert: BREAKOUT · Subgrid layouts [LAYOUT] +4.8 pts/q · all sectors (1 of 2 from the 2026-11-15 forecast)");
    expect(t.lines[2]!.href).toBe("/?panel=brief&trait=css%3Asubgrid");
    expect(t.lines[3]).toMatchObject({ href: "/library/lattice.com", target: "site" });
    expect(t.changed).toBe(6);
    expect(t.note).toBeNull();
    expect(t.asOf).toBe("2026-11-15T17:50:00Z");
    for (const l of t.lines) expect(l.text).not.toMatch(/\$[A-Z]/);
  });
  it("says so plainly when fewer than three things changed and shows the freshest instead", () => {
    const quiet: TodayInput = { ...base, now: "2026-11-17T12:00:00Z", alerts: [], type: null, event: { ...base.event!, detected_at: "2026-11-12T09:00:00Z" }, wire: { count24h: 3, latest: { ...base.wire.latest!, published_at: "2026-11-17T08:00:00Z" } } };
    const t = buildToday(quiet);
    expect(t.changed).toBe(1);
    expect(t.note).toBe("Only 1 thing changed in the last 24 hours, so the freshest data fills the rest.");
    expect(t.lines).toHaveLength(5);
    expect(t.lines[0]!.id).toBe("wire");
    expect(t.lines.map(l => l.fresh)).toEqual([true, false, false, false, false]);
    expect(t.lines.some(l => l.target === "site")).toBe(true);
    expect(t.lines[1]!.id).toBe("stage:components:bento_grid");
    const silent = buildToday({ ...quiet, wire: { count24h: 0, latest: null } });
    expect(silent.note).toBe("Nothing new in the last 24 hours, so here is the freshest data we have.");
  });
  it("only counts real stage word changes", () => {
    expect(stageChanges([{ dimension: "a", value: "b", stage: "accelerating", momentum: 1, current_share: 0 }], [{ dimension: "a", value: "b", stage: "accelerating", momentum: 1, current_share: 0 }])).toEqual([]);
    expect(buildToday({ ...base, alerts: [], event: null, type: null, wire: { count24h: 0, latest: null }, crawl: null, runs: { latest: null, previous: null } }).note).toMatch(/^No data has arrived yet/);
  });
});
