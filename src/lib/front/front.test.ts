import { describe, expect, it } from "vitest";
import { archiveFill, frontModel, groupColumn, groupOf, pageState, pickLead, relTime, sectorStrip, sameWeekMatch, toFront, BUSY_MIN_STORIES } from "./front";
import { chartOfDay, CHART_RECIPES, dayNumber } from "./chart-day";
import { D, H, NOW, input, iso, quietInput, sig, st } from "./fixtures";

describe("page state", () => {
  it("BUSY with three stories in six hours, STEADY with one today, QUIET with none in a day", () => {
    expect(BUSY_MIN_STORIES).toBe(3);
    expect(pageState([iso(NOW - H), iso(NOW - 2 * H), iso(NOW - 5 * H)], NOW)).toBe("busy");
    expect(pageState([iso(NOW - H), iso(NOW - 2 * H), iso(NOW - 7 * H)], NOW)).toBe("steady");
    expect(pageState([iso(NOW - 23 * H)], NOW)).toBe("steady");
    expect(pageState([iso(NOW - 25 * H), iso(NOW - 3 * D)], NOW)).toBe("quiet");
    expect(pageState([], NOW)).toBe("quiet");
  });
});

describe("lead fallbacks", () => {
  it("last 24 hours says Today, then 72 hours and the week say This week, then the latest story", () => {
    expect(pickLead([st("a", { happened_at: iso(NOW - 2 * H) })], "all", NOW)?.label).toBe("Today");
    expect(pickLead([st("a", { happened_at: iso(NOW - 48 * H) })], "all", NOW)?.label).toBe("This week");
    expect(pickLead([st("a", { happened_at: iso(NOW - 5 * D) })], "all", NOW)?.label).toBe("This week");
    expect(pickLead([st("a", { happened_at: iso(NOW - 10 * D) })], "all", NOW)?.label).toBe("Latest story");
    expect(pickLead([], "all", NOW)).toBeNull();
  });
  it("the highest score in the window leads, even over a newer story", () => {
    const l = pickLead([st("new", { score: 40, happened_at: iso(NOW - H) }), st("big", { score: 80, happened_at: iso(NOW - 20 * H) }), st("older", { score: 99, happened_at: iso(NOW - 30 * H) })], "all", NOW);
    expect(l?.story.id).toBe("big");
  });
  it("an editor's pin wins and says so", () => {
    expect(pickLead([st("a", { score: 90 }), st("p", { score: 10, pinnedUntil: iso(NOW + D) })], "all", NOW)?.label).toBe("Pinned by the editor");
  });
  it("QUIET labels the lead This week", () => {
    const m = frontModel(quietInput());
    expect(m.state).toBe("quiet");
    expect(m.lead?.label).toBe("This week");
    expect(m.lead?.story.id).toBe("ws:media");
  });
});

describe("live column", () => {
  it("groups by plain time headings, newest first", () => {
    const now = Date.parse("2026-11-16T14:00:00Z");
    expect(groupOf("2026-11-16T13:30:00Z", now)).toBe("hour");
    expect(groupOf("2026-11-16T01:00:00Z", now)).toBe("today");
    expect(groupOf("2026-11-15T23:00:00Z", now)).toBe("yesterday");
    expect(groupOf("2026-11-12T10:00:00Z", now)).toBe("week");
    expect(groupOf("2026-11-09T13:00:00Z", now)).toBeNull();
    const items = [st("y", { happened_at: "2026-11-15T09:00:00Z" }), st("h", { happened_at: "2026-11-16T13:50:00Z" }), st("t1", { happened_at: "2026-11-16T03:00:00Z" }), st("t2", { happened_at: "2026-11-16T08:00:00Z" }), st("w", { happened_at: "2026-11-11T08:00:00Z" })].map(toFront);
    const g = groupColumn(items, now, { sector: "all", quiet: false });
    expect(g.map(x => [x.title, x.items.map(i => i.id)])).toEqual([["Last hour", ["h"]], ["Today", ["t2", "t1"]], ["Yesterday", ["y"]], ["Earlier this week", ["w"]]]);
    expect(groupColumn(items, now, { sector: "all", quiet: true }).map(x => x.title)).toEqual(["Earlier this week"]);
  });
  it("under a sector lens, that sector's stories come first in each group", () => {
    const items = [st("a", { sector: "ai", happened_at: iso(NOW - 3 * H) }), st("f", { sector: "fintech", happened_at: iso(NOW - 4 * H) })].map(toFront);
    expect(groupColumn(items, NOW, { sector: "fintech", quiet: false })[0]!.items.map(i => i.id)).toEqual(["f", "a"]);
  });
  it("relative times never point into the future", () => {
    expect(relTime(iso(NOW + 5 * 6e4), NOW)).toBe("just now");
    expect(relTime(iso(NOW - 9 * 6e4), NOW)).toBe("9 min ago");
    expect(relTime(iso(NOW - 3 * H), NOW)).toBe("3 h ago");
    expect(relTime(iso(NOW - D - H), NOW)).toBe("1 day ago");
  });
});

describe("never dead, never fake", () => {
  it("QUIET fills the column with Earlier this week and a labelled, dated From the archive", () => {
    const m = frontModel(quietInput());
    expect(m.column.groups.map(g => g.title)).toEqual(["Earlier this week"]);
    expect(m.sections.archive).toBe(true);
    expect(m.archive.map(a => [a.id, a.date, a.match])).toEqual([
      ["old:2025", "18 November 2025", "Same week in 2025"],
      ["rb:1", "19 November 2025", "Same week in 2025 · from the web archive"],
    ]);
  });
  it("archive only takes items older than the column, matched to this week", () => {
    expect(sameWeekMatch("2025-11-18T00:00:00Z", NOW)).toBe("Same week in 2025");
    expect(sameWeekMatch("2026-11-10T00:00:00Z", NOW)).toBeNull();
    expect(archiveFill([st("recent", { happened_at: iso(NOW - D) })], [], NOW)).toEqual([]);
  });
  it("STEADY and BUSY show no archive", () => {
    const m = frontModel(input({ stories: [st("a", { happened_at: iso(NOW - 2 * H) })] }));
    expect(m.state).toBe("steady");
    expect(m.sections.archive).toBe(false);
  });
  it("no item's displayed time is later than its stored time", () => {
    for (const i of [quietInput(), input({ stories: [st("a", { happened_at: iso(NOW - 2 * H) }), st("b", { happened_at: iso(NOW - 30 * H) }), st("c", { happened_at: iso(NOW - 3 * D) })] })]) {
      const m = frontModel(i), stored = new Map([...i.stories.map(s => [s.id, s.happened_at] as const), ...i.archiveMoves.map(a => [a.id, a.at] as const)]);
      const shown = [...(m.lead ? [m.lead.story] : []), ...m.column.items, ...m.column.groups.flatMap(g => g.items), ...m.archive];
      expect(shown.length).toBeGreaterThan(0);
      for (const s of shown) expect(Date.parse(s.at)).toBeLessThanOrEqual(Date.parse(stored.get(s.id)!));
      for (const s of shown) expect(s.at).toBe(stored.get(s.id));
    }
  });
});

describe("chart of the day", () => {
  const composites = ["c:1", "c:2", "c:3", "c:4", "c:5"].map((k, i) => sig(k, { share: 0.1 + i / 20, momentum: i / 10 }));
  const stories = ["move", "move", "news", "rebrand", "white_space", "move"].map(type => ({ type }));
  const full = { composites, headline: [], series: [], stories };
  it("rotates by UTC date over the named recipes", () => {
    const seen = new Set<string>();
    for (let d = 0; d < CHART_RECIPES.length; d++) seen.add(chartOfDay({ ...full, day: iso(Date.parse("2026-11-16T00:00:00Z") + d * D).slice(0, 10) })!.recipe);
    // biggest-mover has no series here, so the day it would lead falls through to the next recipe
    expect([...seen].sort()).toEqual(["common-composites", "share-momentum", "stories-by-type"]);
    expect(dayNumber("2026-11-16")).toBe(20773);
    expect(CHART_RECIPES[dayNumber("2026-11-16") % CHART_RECIPES.length]!.id).toBe("biggest-mover");
  });
  it("skips thin recipes and is absent when every recipe is thin", () => {
    expect(chartOfDay({ composites: composites.slice(0, 2), headline: [], series: [], stories: [{ type: "move" }], day: "2026-11-16" })).toBeNull();
    const onlyStories = chartOfDay({ composites: [], headline: [], series: [], stories, day: "2026-11-16" });
    expect(onlyStories?.recipe).toBe("stories-by-type");
  });
  it("is stable for the whole UTC day, even when a story lands during it", () => {
    const base = input({ chart: { composites: [], headline: [], series: [] }, stories: ["move", "news", "rebrand", "move", "white_space"].map((type, i) => st(`s${i}`, { type, happened_at: iso(Date.parse("2026-11-15T10:00:00Z") - i * H) })) });
    const early = frontModel({ ...base, now: Date.parse("2026-11-16T00:05:00Z") }).chart;
    const late = frontModel({ ...base, now: Date.parse("2026-11-16T23:55:00Z"), stories: [...base.stories, st("today", { type: "news", happened_at: "2026-11-16T20:00:00Z" })] }).chart;
    expect(early).not.toBeNull();
    expect(late).toEqual(early);
  });
});

describe("your sector strip", () => {
  const lens = (sector: string, note: string | null) => ({ sector, scope: note ? "all" : sector, note, signals: [sig("x:low", { momentum_index: 10 }), sig("x:top", { momentum_index: 90 }), sig("x:mid", { momentum_index: 50 }), sig("x:sup", { tier: "supply", momentum_index: 99 } as never)] });
  const stream = [st("ws", { type: "white_space", sector: "fintech", happened_at: iso(NOW - 3 * H) }), st("new", { sector: "fintech", happened_at: iso(NOW - H) }), st("ai", { sector: "ai" })];
  it("a covered sector: top two headline signals by Momentum, newest story, white space and the report link", () => {
    const s = sectorStrip("fintech", lens("fintech", null), stream);
    expect(s.kind).toBe("sector");
    if (s.kind !== "sector") return;
    expect(s.signals.map(x => x.key)).toEqual(["x:top", "x:mid"]);
    expect([s.newest?.id, s.whiteSpace?.id, s.report, s.scope]).toEqual(["ws", "ws", "/sectors/fintech", "fintech"]);
  });
  it("an uncovered sector falls back to All with its note, and no white space when none exists", () => {
    const s = sectorStrip("hardware", lens("hardware", "Hardware has too few sites; showing all sectors."), stream);
    expect(s.kind === "sector" && [s.scope, s.note, s.newest, s.whiteSpace]).toEqual(["all", "Hardware has too few sites; showing all sectors.", null, null]);
  });
  it("All sectors invites picking one", () => {
    const s = sectorStrip("all", null, stream);
    expect(s.kind).toBe("pick");
    expect(s.kind === "pick" && s.sectors.length).toBeGreaterThan(5);
  });
});

describe("absent, not empty", () => {
  it("New on the scene is absent without launches and present with one", () => {
    expect(frontModel(input({ stories: [st("a")] })).sections.launches).toBe(false);
    const m = frontModel(input({ stories: [st("a"), st("l", { type: "launch", kicker: "Launch" })] }));
    expect([m.sections.launches, m.launches.map(l => l.id)]).toEqual([true, ["l"]]);
    expect(m.column.items.some(i => i.id === "l")).toBe(false);
  });
  it("no stories: no lead, no chart, no editions; without a comparison Moving now is not drawn (E3)", () => {
    const m = frontModel(input());
    expect([m.sections.lead, m.sections.chart, m.sections.editions, m.sections.explore, m.sections.archive]).toEqual([false, false, false, false, false]);
    expect(m.moving).toBeNull();
    expect(m.sections.moving).toBe(false);
  });
  it("killed stories are not shown and show no number", () => {
    const m = frontModel(input({ stories: [st("k", { state: "killed", number: 9, happened_at: iso(NOW - 2 * H) }), st("a", { number: 10, happened_at: iso(NOW - 3 * H) })] }));
    expect([m.lead?.story.id, m.lead?.story.number, m.column.items.map(i => i.id)]).toEqual(["a", 10, []]);
  });
});
