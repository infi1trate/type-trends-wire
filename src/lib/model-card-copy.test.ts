import { describe, it, expect } from "vitest";
import { coverageSentences } from "./model-card-copy";

describe("model card coverage copy", () => {
  it("turns run 13's coverage into sentences without codes", () => {
    const s = coverageSentences({ component_coverage: { gap: 114, rows: 114, scored: 73, supply: 0, curation: 0, momentum: 114, vanguard: 7, discourse: 0, corroboration: 114 }, crawl: { notes: ["no curated index in the latest crawl: curation component missing"], age_days: 4.7 } }, { discourseSince: "2026-11-14T00:17:39Z" });
    expect(s).toEqual([
      "Vanguard is measured for 7 of 114 traits; the others count as average.",
      "Curation is left out this week: the latest crawl had no curated gallery sites, so it joins the score after the next weekly crawl that includes them.",
      "Discourse sampling began 2026-11-14; this fills in after 4 weeks of posts, around 2026-12-12.",
      "Supply only applies to font-category traits, and none qualified this week.",
    ]);
    for (const line of s) expect(line).not.toMatch(/\b(CURA|VANG|DISC|SUPP|CORR)\b/);
  });
  it("explains an empty card", () => expect(coverageSentences(null)[0]).toMatch(/^No forecast has run yet/));
});
