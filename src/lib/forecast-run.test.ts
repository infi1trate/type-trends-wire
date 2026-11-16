import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseForecastRunBody, runErrorText, crawlCoverage, FORECAST_BODY_LIMIT, RUN_ERROR_MAX, CRAWL_STALE_DAYS } from "./forecast-run";
import { traitCuration } from "./curation";
import { emptyComponents, nextWaveScores, presentComponents } from "./forecast-signals";

const auth = vi.hoisted(() => vi.fn(async (_r: Request): Promise<Response | null> => null));
const run = vi.hoisted(() => vi.fn(async () => ({ ok: true, run_id: 1 })));
vi.mock("@/integrations/supabase/cron-auth", () => ({ authenticateCronRequest: auth }));
// The story build runs after the job; stub it so job tests stay offline (its own tests live in stories/).
const afterJob = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./stories/build.server", () => ({ afterJob }));
vi.mock("./forecast.server", () => ({ runForecast: run }));
const { handleForecastRun } = await import("./forecast-run.server");
const post = (body: string, headers: Record<string, string> = {}) => new Request("https://x.test/api/public/forecast-run", { method: "POST", body, headers });

describe("forecast-run body", () => {
  for (const body of ["{}", '{"kind":"weekly"}', '{"kind": "weekly"}', ' { "kind" :\n "weekly" } ', "{ }"]) it(`accepts ${JSON.stringify(body)}`, () => expect(parseForecastRunBody(body).ok).toBe(true));
  for (const body of ["", "null", "[]", '{"kind":"daily"}', '{"kind":"weekly","x":1}', '{"extra":true}', "{kind:weekly}"]) it(`rejects ${JSON.stringify(body)}`, () => expect(parseForecastRunBody(body).ok).toBe(false));
});

describe("forecast-run handler", () => {
  beforeEach(() => { auth.mockReset().mockResolvedValue(null); run.mockClear(); });
  it("runs for the pg_net-serialized weekly body (space after colon)", async () => { const r = await handleForecastRun(post('{"kind": "weekly"}')); expect(r.status).toBe(200); expect(run).toHaveBeenCalledOnce(); });
  it("builds stories after a stored run, marking that run real (DEV runs call runForecast directly and never get here)", async () => {
    run.mockResolvedValueOnce({ ok: true, run_id: 77 } as never); afterJob.mockClear();
    expect((await handleForecastRun(post("{}"))).status).toBe(200);
    expect(afterJob).toHaveBeenCalledWith("forecast", expect.any(Number), { realRunIds: [77] });
  });
  it("authenticates before reading the body", async () => { auth.mockResolvedValue(new Response("no", { status: 401 })); const r = await handleForecastRun(post("not json")); expect(r.status).toBe(401); expect(run).not.toHaveBeenCalled(); });
  it("400 invalid_input for a bad body", async () => { const r = await handleForecastRun(post('{"kind":"daily"}')); expect(r.status).toBe(400); expect(await r.json()).toEqual({ ok: false, code: "invalid_input" }); expect(run).not.toHaveBeenCalled(); });
  it("413 above 64 KB, streamed or declared", async () => {
    expect((await handleForecastRun(post(" ".repeat(FORECAST_BODY_LIMIT + 1)))).status).toBe(413);
    expect((await handleForecastRun(post("{}", { "content-length": String(FORECAST_BODY_LIMIT + 1) }))).status).toBe(413);
    expect(run).not.toHaveBeenCalled();
  });
  it("500 forecast_failed with no detail when the run throws", async () => { run.mockRejectedValueOnce(new Error("boom at https://secret.example/?apikey=abc")); const r = await handleForecastRun(post("{}")); expect(r.status).toBe(500); expect(await r.json()).toEqual({ ok: false, code: "forecast_failed" }); });
});

describe("run error text", () => {
  it("formats a database error as stage + code + message", () => expect(runErrorText("taste", { code: "57014", message: "canceling statement due to statement timeout" })).toBe("taste: 57014 canceling statement due to statement timeout"));
  it("keeps the first line only, never a stack", () => { const e = new TypeError("x is undefined\n    at compute (forecast.server.ts:1:1)"); expect(runErrorText("compute", e)).toBe("compute: TypeError x is undefined"); });
  it("redacts URLs and credentials and caps at 300 chars", () => {
    const s = runErrorText("compute", new Error(`fetch https://abc.supabase.co/rest/v1/x?apikey=sb_secret_123 failed bearer eyJa.b.c token=xyz ${"y".repeat(400)}`));
    expect(s).not.toMatch(/https?:|sb_secret|eyJ|xyz/); expect(s.length).toBeLessThanOrEqual(RUN_ERROR_MAX);
  });
});

describe("stale crawl / absent curated index", () => {
  const now = Date.parse("2026-11-15T15:00:00Z");
  it("fresh crawl without curated sites is used, curation noted missing", () => {
    const c = crawlCoverage({ run: "2026-11-10-tufy", finished_at: "2026-11-10T12:00:00Z", curated_sites: 0 }, now);
    expect(c).toMatchObject({ use: true, stale: false, age_days: 5.1 }); expect(c.notes).toEqual(["no curated index in the latest crawl: curation component missing"]);
  });
  it(`crawl older than ${CRAWL_STALE_DAYS} days is not used and is noted`, () => {
    const c = crawlCoverage({ run: "2026-10-27-abcd", finished_at: "2026-10-31T00:00:00Z", curated_sites: 40 }, now);
    expect(c.use).toBe(false); expect(c.stale).toBe(true); expect(c.curated_sites).toBe(0); expect(c.notes[0]).toMatch(/15\.6 days old .*vanguard and curation components missing/);
  });
  it("no finished crawl run is noted", () => expect(crawlCoverage({ run: null, finished_at: null, curated_sites: 0 }, now)).toMatchObject({ use: false, notes: ["no finished crawl run: vanguard and curation components missing"] }));
  it("missing crawl components still score the trait (cohort mean), not fail it", () => {
    expect(traitCuration([]).size).toBe(0);
    const rows = [emptyComponents({ gap: 2, momentum: 0.5, vanguard: null, curation: null }), emptyComponents({ gap: -1, momentum: 0.1, vanguard: null, curation: null }), emptyComponents({ gap: 0, momentum: 0.3 })];
    const s = nextWaveScores(rows);
    expect(s.every(x => Number.isFinite(x.score))).toBe(true); expect(s[0]!.score).toBeGreaterThan(s[1]!.score);
    expect(presentComponents(rows[0]!)).not.toContain("curation"); expect(presentComponents(rows[0]!)).not.toContain("vanguard");
  });
});
