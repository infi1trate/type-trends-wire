import { describe, expect, it } from "vitest";
import { FORMATS, FRONT_SURFACES, STORY_FORMAT, SURFACE_FORMAT, frontSearch, resolveFormat, shows, storyFormat } from "./formats";
import { STORY_KINDS } from "../stories/types";
import { frontModel } from "./front";
import { H, NOW, input, iso, st } from "./fixtures";

describe("formats", () => {
  it("every story type has exactly one format", () => {
    expect(Object.keys(STORY_FORMAT).sort()).toEqual([...STORY_KINDS].sort());
    for (const k of STORY_KINDS) expect(FORMATS).toContain(STORY_FORMAT[k]);
    expect(STORY_KINDS.filter(k => STORY_FORMAT[k] === "live").sort()).toEqual(["counter_move", "launch", "move", "news", "rebrand"]);
    expect(STORY_KINDS.filter(k => STORY_FORMAT[k] === "read").sort()).toEqual(["roundup", "white_space"]);
  });
  it("every listed surface has exactly one format", () => {
    expect(Object.keys(SURFACE_FORMAT).sort()).toEqual([...FRONT_SURFACES].sort());
    expect(["moving-now", "signals", "morning-line", "sector-reports"].map(s => SURFACE_FORMAT[s as keyof typeof SURFACE_FORMAT])).toEqual(["updating", "updating", "updating", "updating"]);
    expect([SURFACE_FORMAT.patterns, SURFACE_FORMAT.brands, SURFACE_FORMAT.digest]).toEqual(["explore", "explore", "read"]);
  });
  it("All shows everything; a format shows only itself", () => {
    expect(FORMATS.every(f => shows("all", f))).toBe(true);
    expect(shows("live", "read")).toBe(false);
    expect(storyFormat("not-a-type")).toBe("live");
  });
  it("URL round trip: defaults stay out of the URL, values come back as they went in", () => {
    expect(frontSearch({ sector: "all", format: "all" })).toEqual({});
    const q = frontSearch({ sector: "fintech", format: "read" });
    expect(q).toEqual({ sector: "fintech", format: "read" });
    expect(resolveFormat(q.format)).toBe("read");
    expect(resolveFormat("bogus")).toBe("all");
    expect(resolveFormat(undefined)).toBe("all");
  });
  it("format filter combines with the sector lens", () => {
    const stories = [st("m-f", { sector: "fintech", happened_at: iso(NOW - 2 * H) }), st("m-a", { sector: "ai", happened_at: iso(NOW - 3 * H) }), st("ws-f", { type: "white_space", sector: "fintech", happened_at: iso(NOW - 4 * H) }), st("lead", { score: 99, happened_at: iso(NOW - 5 * H), sector: "ai" })];
    const live = frontModel(input({ stories, format: "live", sector: "fintech" }));
    const all = [live.lead!.story, ...live.also, ...live.column.items];
    expect(all.every(s => s.format === "live")).toBe(true);
    expect(live.also[0]!.sector).toBe("fintech");
    const read = frontModel(input({ stories, format: "read" }));
    expect([read.lead?.story.id, read.column.items.length, read.moving, read.chart, read.strip]).toEqual(["ws-f", 0, null, null, null]);
  });
});
