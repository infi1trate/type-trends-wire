// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HISTORY_VIEWS, historyNote, isHistoryView } from "./history-refresh";
import { refreshHistoryView, type HistoryRpc } from "./history-refresh.server";

const MIN = 60_000;

describe("U2c · ingest only marks brands dirty; it never refreshes history through the API", () => {
  // The database triggers mark the brand; the scheduled library-history-refresh job does the work.
  for (const file of ["crawl-ingest.server.ts", "wire-ingest.server.ts", "library-ingest.server.ts", "ai-store.server.ts"]) {
    it(`${file} calls none of the refresh functions`, () => {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      for (const name of ["library_history_refresh_view", "library_history_refresh_begin", "library_history_refresh_end", "refresh_library_history", "refreshLibraryHistory", "refreshHistoryForJob"])
        expect(src).not.toContain(name);
    });
  }
});

describe("view-name guard (manual per-view refresh)", () => {
  it("accepts exactly the five aggregate views, small first and the share view last", () => {
    expect([...HISTORY_VIEWS]).toEqual(["library_font_series_mat", "library_tag_series_mat", "library_signal_series_mat", "library_css_series_mat", "library_history_share_mat"]);
    expect(HISTORY_VIEWS.every(isHistoryView)).toBe(true);
    for (const bad of ["library_sites", "library_site_history_mat", "public.library_history_share_mat", "library_history_share_live", "LIBRARY_TAG_SERIES_MAT", "", null, 3]) expect(isHistoryView(bad)).toBe(false);
  });
  it("refuses any other name without calling the database", async () => {
    const rpc = vi.fn<HistoryRpc>(async () => ({ data: { ok: true }, error: null }));
    await expect(refreshHistoryView(rpc, "library_sites; drop table x")).rejects.toThrow("unknown history view");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("passes a known name through and reads the timing", async () => {
    const rpc = vi.fn<HistoryRpc>(async () => ({ data: { ok: true, skipped: false, ms: 420 }, error: null }));
    expect(await refreshHistoryView(rpc, "library_tag_series_mat")).toEqual({ ok: true, skipped: false, ms: 420 });
    expect(rpc).toHaveBeenCalledWith("library_history_refresh_view", { p_view: "library_tag_series_mat" });
  });
});

describe("health note", () => {
  const now = Date.parse("2026-11-20T12:00:00Z"), fresh = new Date(now - 59 * MIN).toISOString();
  it("says nothing while the series were refreshed within the hour and no brand is behind", () => expect(historyNote({ refreshed_at: fresh, rows_behind: 0 }, now)).toBeNull());
  it("says when they were last refreshed once that is more than an hour ago", () => expect(historyNote({ refreshed_at: new Date(now - 3 * 60 * MIN).toISOString() }, now)).toBe("history series last refreshed 3h ago (2026-11-20 09:00 UTC)"));
  it("says how many brands' stored rows are more than 30 minutes behind", () => {
    expect(historyNote({ refreshed_at: fresh, rows_behind: 12 }, now)).toBe("history 12 domains behind");
    expect(historyNote({ refreshed_at: fresh, rows_behind: 1 }, now)).toBe("history 1 domain behind");
  });
  it("names both when both are true", () => expect(historyNote({ refreshed_at: new Date(now - 2 * 60 * MIN).toISOString(), rows_behind: 3 }, now)).toBe("history 3 domains behind; history series last refreshed 2h ago (2026-11-20 10:00 UTC)"));
  it("names an aggregate series that no longer fits the job's budget", () => expect(historyNote({ refreshed_at: fresh, views_too_slow: ["library_history_share_mat"] }, now)).toBe("history series too slow for the job's budget: library_history_share_mat"));
  it("unreadable facts leave the note as before", () => expect(historyNote(null, now)).toBeNull());
});
