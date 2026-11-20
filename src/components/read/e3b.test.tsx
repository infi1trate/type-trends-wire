// Phase E3b · speed back, and four touches on the new front page. Concrete values come from the owner's brief.
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderInRouter } from "@/test/router-harness";
import { readTapeShows, tapeWhat, tapeRows, READ_TAPE, TERMINAL_TAPE } from "@/lib/tape";
import { frontTape } from "@/lib/front/tape-block";
import { pickAlsoPictures } from "@/lib/front/also-pictures";
import { writePriority } from "@/lib/stories/writer";
import { censusCandidate, SALE_KEY } from "@/lib/census";
import { frontModel } from "@/lib/front/front";
import type { Check } from "@/lib/integrity";
import type { Crop } from "@/lib/crops";
import { D, H, NOW, input, iso, st } from "@/lib/front/fixtures";
import { FrontView } from "./FrontView";

// Meta's accent: two violets with one plain name ("Vivid violet"), and one that is a different colour.
const accent = (id: number, b: string, a: string, h = 30) => ({ id, domain: "meta.com", type: "palette_shift", before: { accent: b }, after: { accent: a }, page_type: "home", summary: null, detected_at: iso(NOW - h * H), seen: null, source: "live" });
const pass = (f: string): Check => ({ verdict: "pass", pass: [f], fields: { [f]: { verdict: "pass", failed: [], before: 2, after: 2, beforeHours: 12, afterHours: 12, transitions: 1, lastBefore: iso(NOW - 3 * D), firstAfter: iso(NOW - 2 * D) } } });

describe("E3b · a colour change needs two names", () => {
  const same = accent(1, "#4F46E5", "#4338CA"), other = accent(2, "#4F46E5", "#0A2540", 20);
  it("same plain name: no line on the Read side's tape (front page, brand page)", () => {
    expect(readTapeShows(same)).toBe(false);
    expect(tapeWhat(same, READ_TAPE)).toBe("");
    const t = frontTape([same, other], new Map([[1, pass("accent")], [2, pass("accent")]]), { now: NOW });
    expect(t.lines.map(l => l.id)).toEqual([2]);
    expect(t.lines[0]!.what).toBe("accent, Vivid violet to Muted dark blue");
  });
  it("the terminal keeps it with both hex values, and two such changes stay two lines", () => {
    expect(tapeWhat(same, TERMINAL_TAPE)).toBe("accent, Vivid violet (#4F46E5) to Vivid violet (#4338CA)");
    expect(tapeRows([same, accent(3, "#4F46E5", "#3730A3")], () => ({}), undefined, TERMINAL_TAPE)).toHaveLength(2);
  });
  it("a different colour reads the same everywhere", () => {
    expect(readTapeShows(other)).toBe(true);
    expect(tapeWhat(other, TERMINAL_TAPE)).toBe("accent, Vivid violet to Muted dark blue");
  });
});

const crop = (domain: string, section = "hero"): Crop => ({ domain, section } as Crop);
describe("E3b · no twin pictures", () => {
  it("No. 85 (Netlify) keeps Netlify; No. 87 (Netlify, Venmo, Cohere, On) takes Venmo's crop", () => {
    const p = pickAlsoPictures([{ id: "no87", gathered: true }, { id: "no85", gathered: false }], { no87: [crop("netlify.com"), crop("venmo.com"), crop("cohere.com")], no85: [crop("netlify.com", "headline")] });
    expect(p["no85"]!.domain).toBe("netlify.com");
    expect(p["no87"]!.domain).toBe("venmo.com");
  });
  it("two gathered cards never share a brand, and a card with every crop taken has none", () => {
    const p = pickAlsoPictures([{ id: "a", gathered: false }, { id: "g1", gathered: true }, { id: "g2", gathered: true }], { a: [crop("x.com")], g1: [crop("x.com"), crop("y.com")], g2: [crop("y.com"), crop("x.com")] });
    expect([p["a"]?.domain, p["g1"]?.domain, p["g2"]]).toEqual(["x.com", "y.com", null]);
  });
});

describe("E3b · one heading for Earlier this week", () => {
  it("the large heading carries the count; no second small heading", async () => {
    const stories = [st("lead", { happened_at: iso(NOW - H) }), ...[50, 51, 52, 53, 54, 55].map(k => st(`w${k}`, { happened_at: iso(NOW - k * H) }))];
    const r = await renderInRouter(() => createElement(FrontView, { m: frontModel(input({ stories })) }), "/");
    const all = [...r.container.querySelectorAll("h2, h3")].filter(h => h.textContent!.startsWith("Earlier this week"));
    expect(all.map(h => [h.tagName, h.textContent])).toEqual([["H2", "Earlier this week · 6"]]);
  });
});

describe("E3b · No. 90's deck matches its How we know", () => {
  it("“…show a sale in two captures at least six hours apart: …”", () => {
    const c = censusCandidate({ key: SALE_KEY, title: "Sale mode", now: "2026-11-20T17:09:11Z", base: 229, members: [{ domain: "allbirds.com", line: "Up to 50% off" } as never], earlier: null, sites: new Map(), rank: new Map() });
    expect(c.deck).toBe("1 of 229 tracked homepages whose headline or buttons we can read show a sale in two captures at least six hours apart: Allbirds.");
  });
});

describe("E3b · when the writer's calls reset", () => {
  it("the front-page lead first, then the two census pieces, then the rest by rank", () => {
    const s = (id: string, score: number) => ({ id, score, happened_at: "2026-11-20T12:00:00Z" });
    const owed = [s("no44", 90), s("census:sale:2026-W47", 30), s("no87", 70), s("no85", 50), s("census:agents:2026-W47", 40), s("no88", 60)];
    expect(writePriority(owed, { leadId: "no88" }).map(x => x.id)).toEqual(["no88", "census:agents:2026-W47", "census:sale:2026-W47", "no44", "no87", "no85"]);
    // Rank is the front page's rank when given (an AI-read roundup ranks below the day's measured stories).
    expect(writePriority(owed, { leadId: "no88", rank: new Map([["no44", 10]]) }).slice(3).map(x => x.id)).toEqual(["no87", "no85", "no44"]);
  });
});
