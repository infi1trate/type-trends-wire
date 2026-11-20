// Phase E2f · the seasonal story counts sale wording only; a carousel flag applies to the page, not only to the captures that carry it.
import { describe, expect, it } from "vitest";
import golden from "./golden/__fixtures__/golden.json";
import type { EventRow } from "../agency/changes";
import { promoWording } from "../promo";
import { carouselEventIds, inheritedCarousel, type FlagCapture } from "../carousel";
import { seasonalStory } from "./editor";
import { storyRules } from "./rules";

const events = (golden as unknown as { events: EventRow[] }).events;
const ev = (id: number) => events.find(e => e.id === id)!;
const PELOTON = 1322, GOPRO = 3678, BROOKLINEN = 3681;

describe("1 · the seasonal story counts promotion wording only", () => {
  it("Peloton's confirmed change carries the sale wording; GoPro's corners and grid and Brooklinen's accent do not", () => {
    expect(ev(PELOTON).after).toEqual({ headline: "Up to $1,300 off Peloton equipment*" });
    expect(promoWording(ev(PELOTON))).toBe("<currency amount> off");
    expect(promoWording(ev(GOPRO))).toBeNull();
    expect(promoWording({ ...ev(BROOKLINEN), after: { accent: "#E8461E" } })).toBeNull();
  });
  it("with Peloton, GoPro and Brooklinen all seasonal, only Peloton is a member, so no seasonal story runs", () => {
    const three = [ev(PELOTON), ev(GOPRO), { ...ev(BROOKLINEN), after: { accent: "#E8461E" }, before: { accent: "#B4985A" } }];
    const s = seasonalStory({ now: "2026-11-20T13:00:00Z" }, three, new Set(three.map(e => e.id)), new Map());
    expect(s).toBeNull();
  });
  it("three brands whose new headlines read as promotions make the story, and only they are named", () => {
    const sale = (id: number, domain: string, h: string): EventRow => ({ ...ev(PELOTON), id, domain, after: { headline: h }, detected_at: "2026-11-19T10:00:00Z" });
    const xs = [ev(PELOTON), sale(9001, "parachutehome.com", "20% Off Everything"), sale(9002, "skims.com", "Black Friday starts now"), ev(GOPRO)];
    const s = seasonalStory({ now: "2026-11-20T13:00:00Z" }, xs, new Set(xs.map(e => e.id)), new Map())!;
    expect(s.domains.sort()).toEqual(["onepeloton.com", "parachutehome.com", "skims.com"]);
    expect(s.sourceIds).not.toContain(`event:${GOPRO}`);
  });
  it("/what-we-show states the member rule", () => expect(storyRules().map(r => r.text).join(" ")).toMatch(/new headline reads as a promotion/));
});

describe("2 · a carousel flag applies to the page", () => {
  const page = "sofi.com|home|desktop";
  const cap = (id: number, at: string, flag: boolean | null, p = page): FlagCapture => ({ id, page: p, at, flag });
  it("a change between two captures without the key, on a page whose later capture says true, is a rotation", () => {
    const before = cap(3694, "2026-11-14T12:00:00Z", null), after = cap(7619, "2026-11-20T10:53:00Z", null), later = cap(7700, "2026-11-20T14:00:00Z", true);
    const snaps = inheritedCarousel([before, after], [later]);
    expect([...snaps].sort()).toEqual([3694, 7619]);
    const imagery = { id: 4784, type: "imagery_shift", before: { imagery: ["photography"] }, after: { imagery: ["illustration_flat"] }, prev_snapshot_id: 3694, snapshot_id: 7619 };
    expect(carouselEventIds([imagery], snaps).has(4784)).toBe(true);
  });
  it("a capture with the key keeps its own value; the nearest later keyed capture decides, on the same page only", () => {
    const keyed = [cap(10, "2026-11-20T08:00:00Z", false), cap(11, "2026-11-20T12:00:00Z", true), cap(12, "2026-11-20T09:00:00Z", true, "sofi.com|home|mobile")];
    const snaps = inheritedCarousel([cap(1, "2026-11-19T00:00:00Z", null), cap(2, "2026-11-20T10:00:00Z", null), cap(3, "2026-11-20T11:00:00Z", false), cap(4, "2026-11-21T00:00:00Z", null)], keyed);
    expect(snaps.has(1)).toBe(false); // nearest later keyed capture (08:00) says false
    expect(snaps.has(2)).toBe(true);  // nearest later keyed capture (12:00) says true
    expect(snaps.has(3)).toBe(false); // has its own key
    expect(snaps.has(4)).toBe(false); // no later keyed capture
  });
});
