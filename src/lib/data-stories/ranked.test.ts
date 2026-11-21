// I3b · the study check accepts highest, lowest, most, least, first and last about the ends of a ranked list the sheet states.
import { describe, expect, it } from "vitest";
import { checkStudyText, rankedEndClaim, type FactsSheet } from "./writer";

const ranked = [{ label: "ranked sectors by measured changes per hundred compared archive captures", order: ["AI", "Fintech", "Hardware"] }];
describe("rankedEndClaim", () => {
  it("accepts the bottom words about the last entry and the top words about the first", () => {
    expect(rankedEndClaim("Hardware has the lowest rate, 39.8 per hundred.", "lowest", ranked)).toBe(true);
    expect(rankedEndClaim("AI has the highest rate.", "highest", ranked)).toBe(true);
    expect(rankedEndClaim("Hardware comes last.", "last", ranked)).toBe(true);
  });
  it("refuses the word about any other entry, the wrong end, or with no ranked list", () => {
    expect(rankedEndClaim("Fintech has the lowest rate.", "lowest", ranked)).toBe(false);
    expect(rankedEndClaim("AI has the lowest rate.", "lowest", ranked)).toBe(false);
    expect(rankedEndClaim("Hardware has the lowest rate.", "lowest", undefined)).toBe(false);
    expect(rankedEndClaim("Hardware is the biggest.", "biggest", ranked)).toBe(false);
  });
  it("refuses when one of several sentences using the word is not about the end", () => {
    expect(rankedEndClaim("Hardware has the lowest rate. Fintech has the lowest churn.", "lowest", ranked)).toBe(false);
  });
});

describe("checkStudyText with a ranked list", () => {
  const sheet = (withRanked: boolean): FactsSheet => ({
    slug: "s", number: 4, series: "x", question: "Which sector changes its mind?", key: { n: "84.3", label: "changes per hundred captures in AI" }, templates: "",
    scenes: [{ id: "ends", lead: "The busiest and the steadiest", facts: ["Of the three ranked sectors, the AI sector changes its mind most: 84.3 measured changes per hundred compared archive captures.", "The Hardware sector changes least: 39.8 per hundred."], numbers: [{ text: "84.3", value: 84.3, href: "/sectors/ai" }, { text: "39.8", value: 39.8, href: "/sectors/hardware" }], names: [{ name: "AI", kind: "sector", href: "/sectors/ai" }, { name: "Hardware", kind: "sector", href: "/sectors/hardware" }] }],
    limits: [], rankings: ["most", "least"], links: [], phrasings: [], ...(withRanked ? { ranked } : {}),
  });
  const text = (body: string) => ({ headline: "The AI sector changes its mind most often", deck: "A short deck.", opening: Array(100).fill("word").join(" "), scenes: [{ lead: "The busiest and the steadiest", body }], use: Array(40).fill("word").join(" ") });
  const sup = (fails: string[]) => fails.filter(f => f.startsWith("a superlative"));
  it("passes 'lowest' about the last entry when the sheet ranks, and refuses it without the list", () => {
    const body = `${Array(40).fill("word").join(" ")}. The Hardware sector has the lowest rate at 39.8 per hundred.`;
    expect(sup(checkStudyText(text(body), sheet(true), { names: [] }))).toEqual([]);
    expect(sup(checkStudyText(text(body), sheet(false), { names: [] }))).toEqual(["a superlative the sheet does not carry: lowest"]);
  });
  it("still refuses 'lowest' about a middle entry and 'biggest' at all", () => {
    const body = `${Array(40).fill("word").join(" ")}. The Fintech sector has the lowest churn. The AI sector is the biggest mover.`;
    expect(sup(checkStudyText(text(body), sheet(true), { names: [] })).sort()).toEqual(["a superlative the sheet does not carry: biggest", "a superlative the sheet does not carry: lowest"]);
  });
  it("names on the ranked list count as on the sheet (a sector the list ranks may be named)", () => {
    const sheet3: FactsSheet = { ...sheet(true), ranked: [{ label: "ranked sectors", order: ["AI", "Fintech", "Hardware"] }] };
    const body = `${Array(40).fill("word").join(" ")}. Fintech sits between them.`;
    expect(checkStudyText(text(body), sheet3, { names: [] }).filter(f => f.startsWith("sector not on the sheet"))).toEqual([]);
    expect(checkStudyText(text(body), sheet(false), { names: [] }).filter(f => f.startsWith("sector not on the sheet"))).toEqual(["sector not on the sheet: Fintech"]);
  });
});
