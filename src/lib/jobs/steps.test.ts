// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const buildStories = vi.hoisted(() => vi.fn(async (_o: unknown) => ({ ok: true, inserted: 2, timed_out: false })));
vi.mock("../stories/build.server", () => ({ buildStories, BUILD_BUDGET_MS: 20_000 }));
import { FOLLOW_UP_START_MS, FORECAST_FOLLOW_UPS, STEP_LEASE_MS, STEP_MAX_ATTEMPTS, nextStep, progress, queueRows, type StepRow } from "./steps";
import { advanceFollowUps, forecastRunners, queueFollowUps, type StepStore } from "./steps.server";

const T0 = Date.parse("2026-11-22T09:31:00Z");
function memStore(rows: StepRow[] = []): StepStore & { rows: StepRow[] } {
  const key = (r: StepRow) => `${r.job}|${r.run_key}|${r.step}`;
  return {
    rows,
    async open() { return rows.map(r => ({ ...r })); },
    async insert(rs) { for (const r of rs) if (!rows.some(x => key(x) === key(r))) rows.push({ ...r }); },
    async claim(r, now, lease) { const x = rows.find(y => key(y) === key(r))!; const free = x.status === "pending" || (x.status === "running" && (!x.lease_until || x.lease_until < now)); if (!free || x.attempts !== r.attempts) return false; Object.assign(x, { status: "running", started_at: now, lease_until: lease, attempts: x.attempts + 1 }); return true; },
    async finish(r, status, now, detail) { Object.assign(rows.find(y => key(y) === key(r))!, { status, finished_at: now, lease_until: null, detail }); },
  };
}

describe("follow-up steps", () => {
  it("queues the forecast's derived outputs in the original order", async () => {
    expect(FORECAST_FOLLOW_UPS).toEqual(["structure", "taste", "brief", "vibe", "chart", "ledger", "stories"]);
    const s = memStore();
    await queueFollowUps("forecast", "16", FORECAST_FOLLOW_UPS, s);
    await queueFollowUps("forecast", "16", FORECAST_FOLLOW_UPS, s); // idempotent
    expect(s.rows.map(r => [r.step, r.position, r.status])).toEqual(FORECAST_FOLLOW_UPS.map((x, i) => [x, i, "pending"]));
  });
  it("runs one step per call, strictly in order, and records honest progress", async () => {
    const s = memStore(queueRows("forecast", "16", ["taste", "brief"], new Date(T0).toISOString()));
    const ran: string[] = [];
    const runners = { forecast: { taste: async () => { ran.push("taste"); return { ok: true }; }, brief: async () => { ran.push("brief"); return { ok: false, code: "provider_error" }; } } };
    let t = T0;
    expect(await advanceFollowUps(t, runners, s, () => t)).toEqual({ step: "taste", run_key: "16", status: "done" });
    expect(await advanceFollowUps(t, runners, s, () => t)).toEqual({ step: "brief", run_key: "16", status: "error" });
    expect(await advanceFollowUps(t, runners, s, () => t)).toEqual({ idle: true, reason: "no_open_steps" });
    expect(ran).toEqual(["taste", "brief"]);
    expect(progress(s.rows)[0]).toMatchObject({ total: 2, done: 1, failed: ["brief"], open: [] });
    t += 1;
  });
  it("does not start a step late in the carrier call", async () => {
    const s = memStore(queueRows("forecast", "16", ["taste"], new Date(T0).toISOString()));
    expect(await advanceFollowUps(T0, { forecast: { taste: async () => ({ ok: true }) } }, s, () => T0 + FOLLOW_UP_START_MS)).toEqual({ idle: true, reason: "late_start" });
    expect(s.rows[0]!.status).toBe("pending");
  });
  it("a step cut off mid-run waits for its lease, is retried, then given up after the last attempt", () => {
    const [row] = queueRows("forecast", "16", ["brief"], new Date(T0).toISOString());
    const running = { ...row!, status: "running" as const, attempts: 1, lease_until: new Date(T0 + STEP_LEASE_MS).toISOString() };
    expect(nextStep([running], T0 + 60_000)).toBeNull();
    expect(nextStep([running], T0 + STEP_LEASE_MS + 1)).toMatchObject({ action: "run" });
    expect(nextStep([{ ...running, attempts: STEP_MAX_ATTEMPTS }], T0 + STEP_LEASE_MS + 1)).toMatchObject({ action: "give_up" });
  });
  it("a thrown step is recorded as an error with a short detail, never thrown to the carrier", async () => {
    const s = memStore(queueRows("forecast", "16", ["chart"], new Date(T0).toISOString()));
    expect(await advanceFollowUps(T0, { forecast: { chart: async () => { throw new Error("boom"); } } }, s, () => T0)).toEqual({ step: "chart", run_key: "16", status: "error" });
    expect(s.rows[0]).toMatchObject({ status: "error", detail: "Error: boom" });
  });
  it("the story-build step marks the forecast run real, like the old single call did", async () => {
    expect(await forecastRunners["stories"]!("77")).toEqual({ ok: true, inserted: 2, timed_out: false });
    expect(buildStories).toHaveBeenCalledWith({ realRunIds: [77], budgetMs: 20_000 });
  });
});
