// E4b · Study No. 4 shows studios but never ranks them, and the studies' studio rule agrees with the story engine's.
import { describe, expect, it } from "vitest";
import { fxInput } from "./fixtures";
import { sectorMindsStory, sectorRates, rankedRates, mindsBrand, mindsReversal, UNRANKED_SECTORS, UNRANKED_LIMIT, UNRANKED_NOTE, MINDS, type Meta } from "./stories";
import { factsSheet } from "./writer";
import { capText } from "./text";
import { truthEvents, type RawEvent } from "./truth";
import { withoutShowcase, isShowcaseSector } from "../carousel";
import { changeOf } from "../stories/editor";
import type { EventRow as StoryEvent } from "../agency/changes";
import type { DataInput } from "./series";
import type { MultiplesFig } from "./types";

const meta: Meta = { slug: "which-sector-changes-its-mind", number: 4, question: "Which sector changes its mind most?", deck: "D", template: "T", collection: { label: "C", href: "/c" }, related: [] };
const YEARS = ["2021", "2022", "2023", "2024"];
/** fxInput's three sectors plus 20 studios with the same archive captures; `perCapture(year)` changes on every studios capture after the first. */
function withStudios(perCapture: (year: string) => number): DataInput {
  const i = fxInput();
  let ev = 100_000;
  for (let j = 0; j < 20; j++) {
    const domain = `studio${j}.example`;
    i.sites.push({ domain, name: `Studio ${j}`, sector: "studios", active: true });
    YEARS.forEach((y, k) => {
      const at = `${y}-02-10T00:00:00Z`;
      i.captures.push({ domain, at, source: "wayback" });
      if (k > 0) for (let n = 0; n < perCapture(y); n++) i.events.push({ id: ev++, domain, type: "type_change", source: "wayback", at, snapshot_id: null });
    });
  }
  return i;
}
const textOf = (s: ReturnType<typeof sectorMindsStory>, id: string) => { const st = s.steps.find(x => x.id === id); return st ? { text: capText(st.caption), hl: st.view.highlight } : null; };

describe("study 4: studios are shown, not ranked", () => {
  it("the rule lives in one constant", () => expect(UNRANKED_SECTORS).toEqual(["studios"]));
  for (const [name, per] of [["highest", () => 9], ["lowest", () => 0], ["reversing", (y: string) => (y === "2022" ? 0 : 9)]] as const) {
    const i = withStudios(per as (y: string) => number), s = sectorMindsStory(i, new Map(), meta);
    const all = sectorRates(i).filter(r => r.pairs).sort((x, y) => y.rate - x.rate);
    it(`${name}: the fixture really puts studios at an end`, () => {
      if (name === "highest") expect(all[0]!.s).toBe("studios");
      if (name === "lowest") expect(all.at(-1)!.s).toBe("studios");
      if (name === "reversing") { const st = all.find(r => r.s === "studios")!; expect(st.early.p).toBeGreaterThanOrEqual(MINDS.minPairs); expect(st.late.e / st.late.p - st.early.e / st.early.p).toBeGreaterThan(1); }
    });
    it(`${name}: studios are never leader, lagger or reversal, nor the source of the brand`, () => {
      for (const id of ["leader", "lagger", "reversed"]) { const t = textOf(s, id); if (!t) continue; expect(t.hl, id).not.toContain("studios"); expect(t.text, id).not.toMatch(/Studios/); }
      expect(rankedRates(i).map(r => r.s)).not.toContain("studios");
      expect(mindsReversal(sectorRates(i))?.r.s).not.toBe("studios");
      expect(i.sites.find(x => x.domain === mindsBrand(i))?.sector).not.toBe("studios");
      expect(s.key.label).not.toMatch(/Studios/);
    });
    it(`${name}: the Studios panel stays, marked Not ranked`, () => {
      const p = (s.figures["multiples"] as MultiplesFig).panels.find(x => x.id === "studios")!;
      expect(p).toBeDefined(); expect(p.note).toBe(UNRANKED_NOTE);
      expect((s.figures["multiples"] as MultiplesFig).panels.filter(x => x.id !== "studios").every(x => !x.note)).toBe(true);
    });
  }
  it("the limit sentence is present, word for word, on the page and the facts sheet", () => {
    const s = sectorMindsStory(withStudios(() => 1), new Map(), meta);
    expect(UNRANKED_LIMIT).toBe("Studios are shown but not ranked: their homepages are showcases, so palette, accent, hero and imagery changes there are not counted as a change of mind.");
    expect(s.limits).toContain(UNRANKED_LIMIT);
    expect(factsSheet(s).limits).toContain(UNRANKED_LIMIT);
  });
  it("the sheet's most / least come from captions over the ranked sectors", () => {
    const s = sectorMindsStory(withStudios(() => 0), new Map(), meta), f = factsSheet(s);
    expect(f.rankings).toEqual(expect.arrayContaining(["most", "least"]));
    expect(textOf(s, "lagger")!.text).toMatch(/changes least/);
    expect(textOf(s, "leader")!.text).toMatch(/^Of the three ranked sectors, /);
  });
});

describe("studio rule: studies and story engine agree", () => {
  const base = { source: "wayback", detected_at: "2024-03-01T00:00:00Z", at: "2024-03-01T00:00:00Z", snapshot_id: null, prev_snapshot_id: null };
  const sectors: Record<string, string> = { "studio.example": "studios", "acme.example": "fintech" };
  const fixture: (RawEvent & StoryEvent)[] = [
    { ...base, id: 1, domain: "studio.example", type: "palette_shift", before: { palette: ["#111111"] }, after: { palette: ["#333333"] } },
    { ...base, id: 2, domain: "studio.example", type: "palette_shift", before: { accent: "#2F6BFF" }, after: { accent: "#FF4F00" } },
    { ...base, id: 3, domain: "studio.example", type: "layout_change", before: { hero_media: "image" }, after: { hero_media: "video" } },
    { ...base, id: 4, domain: "studio.example", type: "type_change", before: { h1: "Inter" }, after: { h1: "GT America" } },
    { ...base, id: 5, domain: "acme.example", type: "palette_shift", before: { palette: ["#111111"] }, after: { palette: ["#333333"] } },
  ];
  const expected = { 1: false, 2: false, 3: false, 4: true, 5: true } as Record<number, boolean>;
  const story = (e: StoryEvent) => { const c = changeOf(e, "standard", null, { showcase: isShowcaseSector(sectors[e.domain]) }); return c.dims.length > 0 || c.typeface; };
  const studied = new Set(truthEvents(fixture, { carousel: new Set(), checks: new Map(), sectorOf: d => sectors[d] ?? null }).map(e => e.id));
  for (const e of fixture) it(`change ${e.id} (${e.domain}, ${Object.keys(e.after as object)[0]}): both ${expected[e.id] ? "count" : "leave out"} it`, () => {
    expect(story(e)).toBe(expected[e.id]);
    expect(studied.has(e.id)).toBe(expected[e.id]);
    if (isShowcaseSector(sectors[e.domain])) expect(withoutShowcase(e) !== null).toBe(expected[e.id]);
  });
});
