// R2c · a change is news only from the moment its brand joined the panel.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sinceJoined } from "./panel";

const since = new Map<string, string | null>([["old.example", "2021-01-18T17:47:00Z"], ["new.example", "2026-11-29T03:00:00Z"], ["odd.example", "not a date"]]);
const ev = (domain: string | null, detected_at?: string | null) => ({ id: `${domain}@${detected_at}`, domain, detected_at });

describe("sinceJoined", () => {
  it("a long-standing panel brand keeps every change", () => {
    expect(sinceJoined([ev("old.example", "2026-11-25T10:00:00Z"), ev("old.example", "2021-06-01T00:00:00Z")], since)).toHaveLength(2);
  });
  it("a brand that joined on the step keeps only what was seen from then on", () => {
    const rows = [ev("new.example", "2026-11-26T15:00:00Z"), ev("new.example", "2026-11-29T02:59:59Z"), ev("new.example", "2026-11-29T03:00:00Z"), ev("new.example", "2026-11-30T09:00:00Z")];
    expect(sinceJoined(rows, since).map(r => r.detected_at)).toEqual(["2026-11-29T03:00:00Z", "2026-11-30T09:00:00Z"]);
  });
  it("a brand outside the panel has no news at all, and a row with no brand is dropped", () => {
    expect(sinceJoined([ev("onboarding.example", "2026-11-30T09:00:00Z"), ev(null, "2026-11-30T09:00:00Z")], since)).toEqual([]);
  });
  it("compares instants, not text (offsets and fractions of a second)", () => {
    expect(sinceJoined([ev("new.example", "2026-11-28T22:30:00-05:00"), ev("new.example", "2026-11-28T21:59:00.123-05:00")], since).map(r => r.detected_at)).toEqual(["2026-11-28T22:30:00-05:00"]);
  });
  it("a row without a date, or a join date that cannot be read, is judged on the brand alone", () => {
    expect(sinceJoined([ev("new.example"), ev("new.example", null), ev("odd.example", "2020-01-01T00:00:00Z")], since)).toHaveLength(3);
  });
});

describe("every reader of changes applies it", () => {
  const src = (p: string) => readFileSync(`src/lib/${p}`, "utf8");
  it("the shared panel filter is date-aware", () => {
    expect(src("active-sites.server.ts")).toMatch(/export async function panelRowsOnly[^]*?sinceJoined\(rows, await panelSince\(\)\)/);
  });
  it("the front tape, the brief, the reading page, the newest-change read and the story build use it", () => {
    expect(src("front/tape.server.ts")).toMatch(/panelRowsOnly\(events\)/);
    expect(src("front/tape.server.ts")).toMatch(/sinceJoined\(\[\{ domain: c\.domain, detected_at: c\.confirmed_at \?\? c\.to\.last_seen_at \}\], joined\)/);
    expect(src("forecast-brief.server.ts")).toMatch(/panelRowsOnly\(ev\.data \?\? \[\]\)/);
    expect(src("read.server.ts")).toMatch(/checkedEvents\(db, await \(await import\("\.\/active-sites\.server"\)\)\.panelRowsOnly\(\(events \?\? \[\]\) as EventRow\[\]\)\)/);
    expect(src("data.ts")).toMatch(/sinceJoined\(cand, inPanel\)\[0\]/);
    expect(src("stories/build.server.ts")).toMatch(/sinceJoined\(historyRows, joinedAt\)/);
  });
  it("no reader of changes filters on a bare set of panel brands any more", () => {
    for (const f of ["front/tape.server.ts", "forecast-brief.server.ts", "read.server.ts"]) expect(src(f)).not.toMatch(/panelDomains\(\)/);
  });
});
