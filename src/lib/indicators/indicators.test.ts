// W2 · leading indicators: ingest, the change rule, number wording, health and cache rules.
import { describe, expect, it } from "vitest";
import { handleSeriesIngest, type SeriesStore } from "./ingest.server";
import { changeOver, fontRisers, indicatorTables, readable, toCsv, type SeriesPoint, type SeriesRow } from "./series";
import { SIGNAL_TOPIC, TOPIC_ORDER, topicHref, topicOfSignal } from "./topics";
import { readCacheKey } from "../edge-cache";
import { indicatorsJob, INDICATORS_NOT_STARTED, buildHealth } from "../health";

const SECRET = "test-only-not-a-real-secret";
function memoryStore() {
  const rows = new Map<string, SeriesPoint & { run_id: string }>();
  const store: SeriesStore = {
    authenticate: async r => r.headers.get("x-crawl-secret") === SECRET,
    async store(points, runId) {
      let inserted = 0, replaced = 0;
      for (const p of points) { const k = `${p.source}|${p.key}|${p.metric}|${p.period_end}`; if (rows.has(k)) replaced++; else inserted++; rows.set(k, { ...p, run_id: runId }); }
      return { inserted, replaced };
    },
  };
  return { store, rows };
}
const point = (o: Partial<SeriesPoint> = {}): SeriesPoint => ({ source: "npm", key: "tailwindcss", metric: "downloads_week", value: 190424610, period_end: "2026-11-18", label: "Tailwind CSS", topic: "styling", ...o });
const body = (points: unknown[]) => ({ run_id: "indicators-2026-11-20T05-37-00-000Z", captured_at: "2026-11-20T05:37:00.000Z", points });
const post = (b: unknown, secret: string | null = SECRET) => new Request("http://localhost/api/public/ingest-series", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-crawl-secret": secret } : {}) }, body: JSON.stringify(b) });

describe("POST /api/public/ingest-series", () => {
  const good = body([point(), point({ source: "github", key: "tailwindlabs/tailwindcss", metric: "stars", value: 90000, period_end: "2026-11-20" })]);
  it("stores a good batch", async () => {
    const m = memoryStore(), r = await handleSeriesIngest(post(good), m.store);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, accepted: 2, inserted: 2, replaced: 0 });
    expect(m.rows.size).toBe(2);
  });
  it("the same batch again reports replacements and does not duplicate", async () => {
    const m = memoryStore();
    await handleSeriesIngest(post(good), m.store);
    const r = await handleSeriesIngest(post(good), m.store);
    expect(await r.json()).toMatchObject({ accepted: 2, inserted: 0, replaced: 2 });
    expect(m.rows.size).toBe(2);
  });
  it("a bad secret is 401 and stores nothing", async () => {
    const m = memoryStore();
    expect((await handleSeriesIngest(post(good, "wrong"), m.store)).status).toBe(401);
    expect((await handleSeriesIngest(post(good, null), m.store)).status).toBe(401);
    expect(m.rows.size).toBe(0);
  });
  it("a negative or fractional value, a bad date and more than 200 points are 400 with one plain sentence", async () => {
    const m = memoryStore();
    for (const b of [body([point({ value: -1 })]), body([point({ value: 1.5 })]), body([point({ period_end: "2026-02-30" })]), body([point({ period_end: "18/11/2026" })]),
      body(Array.from({ length: 201 }, (_, i) => point({ key: `pkg-${i}` })))]) {
      const r = await handleSeriesIngest(post(b), m.store), j = await r.json() as { error: string };
      expect(r.status).toBe(400); expect(typeof j.error).toBe("string"); expect(j.error.length).toBeGreaterThan(5);
    }
    expect(m.rows.size).toBe(0);
  });
  it("stores an unknown source word of valid shape; refuses one of bad shape", async () => {
    const m = memoryStore();
    expect((await handleSeriesIngest(post(body([point({ source: "jsdelivr" })])), m.store)).status).toBe(200);
    expect(m.rows.size).toBe(1);
    expect((await handleSeriesIngest(post(body([point({ source: "JSDelivr" })])), m.store)).status).toBe(400);
  });
});

describe("change against four weeks earlier", () => {
  it("one point shows a dash", () => { expect(changeOver([{ period_end: "2026-11-18", value: 100 }])).toBeNull(); });
  it("two points 10 days apart show a dash", () => { expect(changeOver([{ period_end: "2026-11-08", value: 100 }, { period_end: "2026-11-18", value: 120 }])).toBeNull(); });
  it("two points 28 days apart show the right percentage", () => {
    const c = changeOver([{ period_end: "2026-10-21", value: 200 }, { period_end: "2026-11-18", value: 250 }]);
    expect(c?.pct).toBeCloseTo(25, 6);
  });
  it("a value of zero four weeks ago shows a dash, not infinity", () => {
    expect(changeOver([{ period_end: "2026-10-21", value: 0 }, { period_end: "2026-11-18", value: 250 }])).toBeNull();
  });
});

describe("number wording", () => {
  it("reads 190424610 as 190 million, 858908 as 859 thousand, 950 as 950", () => {
    expect(readable(190424610)).toBe("190 million");
    expect(readable(858908)).toBe("859 thousand");
    expect(readable(950)).toBe("950");
    expect(readable(1234567)).toBe("1.2 million");
    expect(readable(999999)).toBe("1 million");
  });
});

describe("page model", () => {
  const rows: SeriesRow[] = [
    { source: "npm", key: "tailwindcss", metric: "downloads_week", period_end: "2026-11-18", value: 190424610, label: "Tailwind CSS", topic: "styling" },
    { source: "github", key: "tailwindlabs/tailwindcss", metric: "stars", period_end: "2026-11-20", value: 90000, label: "Tailwind CSS", topic: "styling" },
    { source: "npm", key: "styled-components", metric: "downloads_week", period_end: "2026-11-18", value: 858908, label: "styled-components", topic: "styling" },
    { source: "jsdelivr", key: "x", metric: "hits", period_end: "2026-11-18", value: 5, label: "Unknown source", topic: "styling" },
  ];
  it("joins npm and GitHub by label, drops unknown sources, sorts by installs, shows a dash on day one", () => {
    const [t] = indicatorTables(rows);
    expect(t!.rows.map(r => r.label)).toEqual(["Tailwind CSS", "styled-components"]);
    expect(t!.rows[0]!.github?.stars?.value).toBe(90000);
    expect(t!.rows[0]!.npm?.change).toBeNull();
    expect(t!.rows[0]!.npm?.weekly).toEqual([]);
  });
  it("the CSV holds exactly the rows shown, exact values", () => {
    const csv = toCsv(indicatorTables(rows)[0]!.rows).trim().split("\n");
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain("190424610");
  });
  it("Google Fonts: the current top ten until four weeks of ranks exist, then risers", () => {
    const now = Array.from({ length: 20 }, (_, i) => ({ family: `F${i}`, rank: i + 1 }));
    const top = fontRisers("2026-11-20", now, "2026-11-10", now, "2026-11-10");
    expect(top.mode).toBe("top");
    const then = now.map(r => ({ ...r, rank: r.family === "F15" ? 90 : r.rank }));
    const r = fontRisers("2026-11-20", now, "2026-10-23", then, "2026-10-01");
    expect(r.mode).toBe("risers");
    if (r.mode === "risers") expect(r.items[0]).toEqual({ family: "F15", now: 16, then: 90 });
  });
});

describe("signal → topic mapping", () => {
  it("every mapped signal points to a known topic table", () => {
    for (const t of Object.values(SIGNAL_TOPIC)) expect(TOPIC_ORDER).toContain(t);
    expect(topicOfSignal("css:scroll_timeline")).toBe("motion");
    expect(topicOfSignal("imagery:3d_render")).toBe("3d");
    expect(topicOfSignal("tone:calm")).toBeNull();
    expect(topicHref("motion")).toBe("/signals/leading#lead-motion");
  });
});

describe("health and cache", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  it("before the first run the job says collection has not started and is not a failure", () => {
    const j = indicatorsJob(null, now);
    expect(j.stale).toBe(false); expect(j.note).toBe(INDICATORS_NOT_STARTED);
    expect(buildHealth({}, new Date(now)).jobs.find(x => x.job === "indicators")?.last_status).toBe("not_started");
  });
  it("reports points in the last run and turns late after 36 hours", () => {
    expect(indicatorsJob({ last_run_at: "2026-11-20T05:37:00Z", points: 160 }, now)).toMatchObject({ stale: false, note: "160 points in the last run" });
    const late = indicatorsJob({ last_run_at: "2026-11-18T05:37:00Z", points: 160 }, now);
    expect(late.stale).toBe(true); expect(late.note).toContain("more than 36 hours");
  });
  it("the page is served through the page cache; the ingest is not", () => {
    const req = (u: string) => ({ method: "GET", url: u, headers: new Headers() });
    expect(readCacheKey(req("https://slug.global/signals/leading"), false)).toBe("https://slug.global/signals/leading");
    expect(readCacheKey(req("https://slug.global/signals/leading?view=data&utm_source=x"), false)).toBe("https://slug.global/signals/leading?view=data");
    expect(readCacheKey(req("https://slug.global/api/public/ingest-series"), false)).toBeNull();
    expect(readCacheKey({ method: "POST", url: "https://slug.global/api/public/ingest-series", headers: new Headers() }, false)).toBeNull();
  });
});

describe("status page freshness row", async () => {
  const { freshness } = await import("../freshness");
  const now = Date.parse("2026-11-20T12:00:00Z");
  const row = (f: Parameters<typeof freshness>[0]) => freshness(f, now).find(r => r.id === "indicators")!;
  it("not started is never late", () => { expect(row({ indicators: { ran: null, dormant: "Collection has not started" } })).toMatchObject({ state: "dormant", note: "Collection has not started" }); });
  it("late after 36 hours, with the points line", () => {
    expect(row({ indicators: { ran: "2026-11-19T05:37:00Z", note: "160 points in the last run" } })).toMatchObject({ state: "on_time", note: "160 points in the last run" });
    expect(row({ indicators: { ran: "2026-11-18T23:00:00Z" } }).state).toBe("late");
  });
});
