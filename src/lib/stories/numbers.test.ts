import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assignNumbers, numberLabel, numberPath, storyIdForNumber, withNumbers } from "./numbers";
import { morningRss } from "../editions/morning-rss";

describe("story numbers", () => {
  it("are assigned in order of publication (happened_at, then id), starting at 1", () => {
    expect(assignNumbers([{ id: "b", happened_at: "2026-11-02" }, { id: "a", happened_at: "2026-11-02" }, { id: "c", happened_at: "2026-11-01" }], []))
      .toEqual([{ story_id: "c", number: 1 }, { story_id: "a", number: 2 }, { story_id: "b", number: 3 }]);
  });
  it("are assigned once and never reused: new stories continue after the highest number ever given, even a killed story's", () => {
    const existing = [{ story_id: "a", number: 1 }, { story_id: "killed", number: 2 }];
    const next = assignNumbers([{ id: "a", happened_at: "2026-11-01" }, { id: "new", happened_at: "2026-10-01" }], existing);
    expect(next).toEqual([{ story_id: "new", number: 3 }]);
    expect(assignNumbers([{ id: "a", happened_at: "2026-11-01" }], existing)).toEqual([]);
  });
  it("are shown only while the story is published", () => {
    const rows = withNumbers([{ id: "a", state: "published" }, { id: "k", state: "killed" }, { id: "h", state: "held" }], [{ story_id: "a", number: 1 }, { story_id: "k", number: 2 }]);
    expect(rows.map(r => r.number)).toEqual([1, null, null]);
  });
  it("/stories/no/<n> resolves only to a published story", () => {
    const nums = [{ story_id: "a", number: 47 }, { story_id: "k", number: 48 }], state = (id: string) => (id === "a" ? "published" : "killed");
    expect(storyIdForNumber(47, nums, state)).toBe("a");
    expect(storyIdForNumber(48, nums, state)).toBeNull();
    expect(storyIdForNumber(99, nums, state)).toBeNull();
    expect([numberLabel(47), numberPath(47)]).toEqual(["No. 47", "/stories/no/47"]);
  });
  it("appear in the Morning Line RSS item titles", () => {
    const xml = morningRss([{ day: "2026-11-16", title: "The Morning Line · Monday 16 November", lead: "neon.com changed its hero", leadNumber: 48, count: 3, href: "/morning/2026-11-16", final: true }]);
    expect(xml).toContain("No. 48");
  });
  it("the migration only creates the new insert-only table", () => {
    const sql = readFileSync("drizzle/migrations/0046_create_story_numbers.sql", "utf8").replace(/--.*$/gm, "");
    const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
    for (const s of statements) expect(s).toMatch(/^(CREATE TABLE public\.story_numbers|GRANT [A-Z, ]+ ON public\.story_numbers|ALTER TABLE public\.story_numbers ENABLE ROW LEVEL SECURITY|CREATE POLICY "[^"]+" ON public\.story_numbers FOR SELECT|CREATE TRIGGER story_numbers_\w+ BEFORE (UPDATE OR DELETE|TRUNCATE) ON public\.story_numbers)/);
    expect(sql).not.toMatch(/\b(DROP|UPDATE public|DELETE FROM|ALTER TABLE public\.(?!story_numbers))/);
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*TO (anon|authenticated)/);
  });
});
