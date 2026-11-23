import { describe, expect, it } from "vitest";
import { earlierBuildRunning, BUILD_ONE_AT_A_TIME_MS } from "./runs";

const at = (ms: number) => new Date(ms).toISOString();
const t = Date.parse("2026-11-23T02:31:01Z");
describe("one story build at a time", () => {
  it("stands down when another instance's build started 36 s earlier (23 Nov, 02:30:25 and 02:31:01)", () => {
    expect(earlierBuildRunning([{ id: 10, at: at(t - 36_000), job: "story-build", phase: "start" }], { id: 11, at: t })).toBe(true);
  });
  it("goes ahead when the earlier build started two minutes or more ago", () => {
    expect(earlierBuildRunning([{ id: 10, at: at(t - BUILD_ONE_AT_A_TIME_MS), job: "story-build", phase: "start" }], { id: 11, at: t })).toBe(false);
  });
  it("of two builds started in the same second, only the lower row goes ahead", () => {
    const rows = [{ id: 10, at: at(t), job: "story-build", phase: "start" as const }, { id: 11, at: at(t), job: "story-build", phase: "start" as const }];
    expect(earlierBuildRunning(rows, { id: 10, at: t })).toBe(false);
    expect(earlierBuildRunning(rows, { id: 11, at: t })).toBe(true);
  });
  it("ignores other jobs and finish rows", () => {
    expect(earlierBuildRunning([{ id: 9, at: at(t - 1000), job: "crawl-ingest", phase: "start" }, { id: 8, at: at(t - 1000), job: "story-build", phase: "finish" }], { id: 11, at: t })).toBe(false);
  });
});
