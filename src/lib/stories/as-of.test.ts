// L2 · a Numbers line says when it was true, and one dated update line when a later run changes a cited signal's stage (No. 45, run 16).
import { describe, expect, it } from "vitest";
import { asOfText, datedFacts, stageUpdate, statesNumber } from "./as-of";
import type { SignalRow } from "../signals";

const RUN13 = { id: 13, at: "2026-11-15T15:33:42.991Z" }, RUN16 = { id: 16, at: "2026-11-22T09:30:41.153Z" };
const row = (scope: string, stage: string, share: number, momentum: number): SignalRow => ({ dimension: "imagery", value: "photography_lifestyle", scope, status: "ok", stage, momentum, current_share: share, next_wave_score: null });
// Stored values for "imagery:photography_lifestyle" in runs 13 and 16.
const r13 = new Map([["all", row("all", "accelerating", 0.469750889679715, 0.638)], ["dev-tools", row("dev-tools", "declining", 0.0333, -0.065)]]);
const r16 = new Map([["all", row("all", "flat", 0.44055944055944, 0.367)], ["dev-tools", row("dev-tools", "declining", 0, -0.175)]]);
const of = (m: Map<string, SignalRow>) => (k: string, scope: string) => (k === "imagery:photography_lifestyle" ? m.get(scope) : undefined);
const no45 = { publishedAt: "2026-11-16T02:59:14.109Z", storyRun: RUN13, newest: RUN16, keys: ["imagery:photography_lifestyle"], sector: "dev-tools", then: of(r13), latest: of(r16) };
const NOW = Date.parse("2026-11-22T11:23:00Z");

describe("dated Numbers lines", () => {
  it("dates No. 45's share, stage and momentum lines with run 13's day", () => {
    expect(asOfText(RUN13.at)).toBe("as of 15 Nov");
    const facts = datedFacts([
      { text: "52% of homepages in other sectors show it", href: null, basis: "measured" },
      { text: "Lifestyle photography is rising across all sectors", href: null, basis: "measured", kind: "stage" },
      { text: "Using it elsewhere: Lucid, Allbirds and BASIC/DEPT", href: null, basis: "measured" },
      { text: "Lifestyle photography: 132 of 281 tracked homepages with an AI read (47.0%), rising, momentum 0.6 points a quarter", href: null, basis: "ai" },
    ], RUN13.at);
    expect(facts.map(f => f.asOf ?? null)).toEqual(["as of 15 Nov", "as of 15 Nov", null, "as of 15 Nov"]);
  });
  it("leaves lines that state no share, stage or momentum undated", () => {
    expect(statesNumber({ text: "Using it elsewhere: Lucid, Allbirds and BASIC/DEPT" })).toBe(false);
    expect(statesNumber({ text: "Seen on 5 tracked fintech brands, including Adyen", kind: "count" })).toBe(false);
    expect(statesNumber({ text: "Netlify", kind: "brand" })).toBe(false);
  });
});

describe("the update line", () => {
  it("No. 45 under run 16: rising became steady", () => {
    expect(stageUpdate({ ...no45, now: NOW })).toBe("Update 22 Nov: now 44.1% of homepages, steady");
  });
  it("only for a story published in the last 14 days", () => {
    expect(stageUpdate({ ...no45, now: Date.parse("2026-11-30T03:00:00Z") })).toBeNull();
    expect(stageUpdate({ ...no45, now: Date.parse("2026-11-30T02:00:00Z") })).not.toBeNull();
  });
  it("none when the newest run is the story's own, or the stage did not change", () => {
    expect(stageUpdate({ ...no45, newest: RUN13, now: NOW })).toBeNull();
    expect(stageUpdate({ ...no45, latest: of(r13), now: NOW })).toBeNull();
  });
  it("names the signal when the story cites more than one", () => {
    const line = stageUpdate({ ...no45, keys: ["imagery:photography_lifestyle", "font:serif"], now: NOW });
    expect(line).toBe("Update 22 Nov: lifestyle photography now 44.1% of homepages, steady");
  });
});
