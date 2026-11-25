import { expect, it } from "vitest";
import { archiveEntry, liveEntry, withOnboarding } from "./onboarding-state";
import { crawlPayload } from "./crawl-payload";
const s = { domain: "b.com", sector: "ai", pages: {} };
it("onboarding entries keep the RPC shape and say onboarding: true", () => {
  const e = liveEntry(s, [{ page_type: "home", viewport: "desktop", html_hash: "1", content_hash: null, signals_hash: null, captured_at: "2026-01-01" }, { page_type: "home", viewport: "desktop", html_hash: "2", content_hash: null, signals_hash: null, captured_at: "2026-02-01" }], [{ captured_at: "2021-08-01", quarter: "2021Q3" }]);
  expect(e).toEqual({ domain: "b.com", sector: "ai", active: false, pages: {}, latest: { "home:desktop": { html_hash: "2", content_hash: null, signals_hash: null, captured_at: "2026-02-01" } }, wayback: ["2021-08-01"], onboarding: true });
  expect(archiveEntry(s, [{ captured_at: "2021-08-01", quarter: "2021Q3" }])).toEqual({ domain: "b.com", wayback: [{ captured_at: "2021-08-01", quarter: "2021Q3" }], onboarding: true });
  expect(withOnboarding({ sites: [{ domain: "a.com" }, { domain: "c.com" }], vanguard: [] }, [e])).toEqual({ sites: [{ domain: "a.com" }, e, { domain: "c.com" }], vanguard: [] });
});
it("archive gaps: quarter format, two reasons, at most 2,000", () => {
  const g = (n: number, q = "2021Q3", reason = "no_capture") => ({ kind: "library_archive_gaps", run_id: "r1", gaps: Array.from({ length: n }, (_, i) => ({ domain: `d${i}.com`, quarter: q, reason })) });
  expect(crawlPayload.safeParse(g(2000)).success).toBe(true);
  expect(crawlPayload.safeParse(g(2001)).success).toBe(false);
  expect(crawlPayload.safeParse(g(1, "2021-Q3")).success).toBe(false);
  expect(crawlPayload.safeParse(g(1, "2021Q3", "blocked")).success).toBe(false);
});
