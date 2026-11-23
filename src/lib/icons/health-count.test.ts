// W3d-c Part 5 · the health line counts the whole stored week: the data API answers at most 1,000 rows a request, so a week of 1,001
// rows (or the real 1,797 in 18 categories) must not read as 1,000.
import { describe, expect, it } from "vitest";
import { iconHealth, type IconHealthReads } from "./ingest.server";
import { pagedRows } from "../paged";

/** Like the data API: whatever range is asked for, at most 1,000 rows come back. */
function api(rows: { genre_id: number; stored_at: string }[]): IconHealthReads {
  return { newestWeek: async () => "2026-W48", weekPage: async (_w, from, to) => ({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }) };
}
const week = (n: number, cats: number) => Array.from({ length: n }, (_, k) => ({ genre_id: 6000 + (k % cats), stored_at: `2026-11-23T22:${String(k % 60).padStart(2, "0")}:00Z` }));

describe("the icons health count", () => {
  it("counts 1,001 rows as 1,001", async () => {
    expect((await iconHealth(api(week(1001, 18)))).apps).toBe(1001);
  });
  it("counts the real week's shape: 1,797 apps in 18 categories (it read 1,000 and 11)", async () => {
    const rows = [...week(1797, 18)].sort((a, b) => a.genre_id - b.genre_id); // stored order: a category's rows together
    expect(await iconHealth(api(rows))).toMatchObject({ week: "2026-W48", apps: 1797, categories: 18 });
  });
  it("pagedRows stops on a short page and reports an error", async () => {
    let calls = 0;
    expect((await pagedRows(async () => { calls++; return { data: [1, 2, 3], error: null }; })).data).toHaveLength(3);
    expect(calls).toBe(1);
    expect((await pagedRows(async () => ({ data: null, error: new Error("x") }))).error).toBeTruthy();
  });
});
