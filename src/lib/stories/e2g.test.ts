// Phase E2g · dates from the captures, style reads on a carousel page, and the census as a weekly piece.
import { describe, expect, it } from "vitest";
import data from "../__fixtures__/integrity-captures.json";
import { checkEvent, confirmedPart, type Capture } from "../integrity";
import { betweenDates, changeWhen, tapeLine } from "../tape";
import { carouselEventIds, withoutRotation } from "../carousel";
import { howWeKnowOf } from "./texts";
import { isWeekly, leadAllowed } from "./score";

type E = { id: number; domain: string; type: string; before: unknown; after: unknown; detected_at: string; page_type?: string | null; snapshot_id?: number | null; prev_snapshot_id?: number | null };
const fx = data as unknown as Record<string, { captures: Capture[]; events: E[] }>;

describe("1 · a change is dated by its captures", () => {
  const cb = fx["coinbase.com"]!, pivot = cb.events.find(e => e.type === "message_pivot")!;
  it("Coinbase's headline: old value last seen 11 Nov, new value first seen 14 Nov, confirmed 20 Nov", () => {
    expect(pivot.detected_at.slice(0, 10)).toBe("2026-11-20");
    const f = checkEvent(pivot, cb.captures).fields["headline"]!;
    expect(f.verdict).toBe("pass");
    expect(f.lastBefore!.slice(0, 10)).toBe("2026-11-11"); expect(f.firstAfter!.slice(0, 10)).toBe("2026-11-14");
    const e = confirmedPart(pivot, checkEvent(pivot, cb.captures))!;
    expect(changeWhen(e)).toBe("between 11 and 14 Nov");
    expect(tapeLine(e)).toBe("Coinbase · headline, “Trusted by millions worldwide” to “The trusted financial account for you and your agents” · between 11 and 14 Nov");
  });
  it("a same-day change shows one date; months differ in full", () => {
    expect(betweenDates("2026-11-14T02:00:00Z", "2026-11-14T20:00:00Z")).toBe("14 Nov");
    expect(betweenDates("2026-10-30T02:00:00Z", "2026-11-02T20:00:00Z")).toBe("between 30 Oct and 2 Nov");
    expect(changeWhen({ detected_at: "2026-11-20T10:00:00Z" })).toBe("20 Nov");
  });
  it("How we know names the capture dates, never the confirmation date", () => {
    const facts = [{ text: "Headline, “a” to “b” · between 11 and 14 Nov", kind: "member", basis: "measured" }, { text: "Confirmed on a second capture, 20 Nov", kind: "date", basis: "measured" }];
    expect(howWeKnowOf({ type: "move", basis: "measured", kicker: "Positioning", happened_at: "2026-11-20T13:40:00Z", facts })).toBe("Measured from captures on 11 and 14 November.");
    expect(howWeKnowOf({ type: "move", basis: "measured", kicker: "Identity", happened_at: "2026-11-20T09:29:00Z", facts: [{ text: "Hero, none to still · between 14 and 20 Nov", kind: "member" }] })).toBe("Measured from captures on 14 and 20 November.");
  });
});

describe("2 · a style read on a carousel page is a rotation", () => {
  it("SoFi's “playful” style read (20 Nov) on a carousel page: tape line marked Carousel, never part of a story", () => {
    const sofi = { id: 4785, type: "aesthetic_shift", before: { aesthetic: ["editorial", "swiss_grid"] }, after: { aesthetic: ["corporate", "playful"] }, prev_snapshot_id: 3694, snapshot_id: 7619 };
    expect(carouselEventIds([sofi], new Set([3694, 7619])).has(4785)).toBe(true);
    expect(withoutRotation(sofi)).toBeNull();
    expect(carouselEventIds([sofi], new Set()).size).toBe(0);
  });
});

describe("3 · the census is a weekly piece", () => {
  const row = (id: string, type: string, basis: string, domains: string[]) => ({ id, type, basis, happened_at: "2026-11-20T15:00:00Z", domains, score: 80 });
  const census = row("census:agents:2026-W47", "roundup", "measured", ["coinbase.com", "linear.app", "fly.io"]);
  it("outside the daily five", () => expect(isWeekly(census)).toBe(true));
  it("never the lead on a day with a measured single-brand story; may lead on a day without one", () => {
    expect(leadAllowed(census, [census, row("brand:coinbase.com:2026-11-20", "move", "measured", ["coinbase.com"])])).toBe(false);
    expect(leadAllowed(census, [census, row("roundup:x", "roundup", "measured", ["a.com", "b.com", "c.com"])])).toBe(true);
  });
});

describe("numbering reads stories without their lists", () => {
  it("a correction that narrows domains does not break a reader that loaded only id, status and dates", async () => {
    const { applyEdits } = await import("./edits");
    const row = { id: "against:2026-W47:measured", status: "published", happened_at: "2026-11-20T14:00:00Z", created_at: "2026-11-20T14:00:00Z" } as unknown as import("./edits").StoredStory;
    const edit = { id: 1, story_id: "against:2026-W47:measured", action: "correct" as const, payload: { domains: ["netlify.com"], source_ids: ["story:x"] }, note: null, at: "2026-11-20T15:00:00Z" };
    expect(applyEdits(row, [edit], Date.parse("2026-11-20T16:00:00Z")).state).toBe("published");
  });
});
