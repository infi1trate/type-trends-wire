import { describe, expect, it } from "vitest";
import { claimAbout, longerNameOf, newsCandidates, newsMatcher, newsMatches, nameUses } from "./candidates";

const NOW = "2026-11-21T12:00:00Z";
const sites = [{ domain: "motherlondon.com", name: "Mother" }, { domain: "stripe.com", name: "Stripe" }, { domain: "figma.com", name: "Figma" }, { domain: "linear.app", name: "Linear" }];
const m = newsMatcher(sites, []);
const rss = (id: number, title: string, excerpt: string | null) => ({ id, title, url: "https://www.itsnicethat.com/x", source: "It's Nice That", source_kind: "rss", published_at: NOW, excerpt });

describe("I3 · 0.2 news names the right brand", () => {
  it("No. 77: 'Mother Design' is not the tracked brand Mother (an ordinary word needs its domain or an alias)", () => {
    const item = rss(45715, "Mother Design bats Major League Baseball into the future with five bespoke typefaces", "Mother Design has created a new identity and five typefaces for MLB.");
    expect(newsMatches(m, item.title, item.excerpt).domains).toEqual([]);
    expect(newsCandidates(m, [item]).candidates).toEqual([]);
    expect(longerNameOf(m, "motherlondon.com", item.title, item.excerpt, "Mother")).toBe("Mother Design");
  });
  it("an ordinary-word brand matches through its domain or an alias", () => {
    expect(newsMatches(m, "Mother London unveils a new logo", null).domains).toEqual(["motherlondon.com"]);
    expect(newsMatches(m, "A new logo for the agency", "See motherlondon.com for the new identity.").domains).toEqual(["motherlondon.com"]);
    expect(newsMatches(m, "linear.app gets a new logo", null).domains).toEqual(["linear.app"]);
    expect(newsMatches(m, "Linear gradients are back", null).domains).toEqual([]);
  });
  it("a whole name inside a longer capitalised name is a different name", () => {
    expect(newsMatches(m, "the Stripe Press typeface is out", null).domains).toEqual([]);
    expect(newsMatches(m, "Stripe redraws its logo", null).domains).toEqual(["stripe.com"]);
    expect(newsMatches(m, "Why Stripe redrew its logo", null).domains).toEqual(["stripe.com"]);
    expect(nameUses(/stripe/giu, "the Stripe Press typeface")[0]?.longer).toBe("Stripe Press");
  });
  it("a title-case title is read through its excerpt", () => {
    expect(newsMatches(m, "Stripe Press Launches A New Typeface Family", "Stripe Press, the publishing imprint, has a new typeface.").domains).toEqual([]);
    expect(newsMatches(m, "Figma Unveils A Brand New Identity Today", "Figma has a new logo and typeface.").domains).toEqual(["figma.com"]);
    expect(longerNameOf(m, "stripe.com", "Stripe Press Launches A New Typeface Family", "Stripe Press, the publishing imprint, has a new typeface.")).toBe("Stripe Press");
  });
  it("the item must make a design claim about the named brand, not just mention it", () => {
    expect(claimAbout(m, ["figma.com"], "Figma raises a new round", "Separately, a studio released a new typeface.")).toBe(false);
    expect(claimAbout(m, ["figma.com"], "Figma raises a new round", "Figma also showed a new logo.")).toBe(true);
    expect(newsCandidates(m, [rss(1, "Figma raises a new round", "Separately, a studio released a new typeface.")]).candidates).toEqual([]);
    // No. 134's item: Figma is the tool, not the subject.
    expect(claimAbout(m, ["figma.com"], "AI UI/UX designer: assign a ticket, get senior-reviewed Figma designs in 24-48h", null)).toBe(false);
  });
  it("the writer gets the item's own title and excerpt, verbatim, as lines the Read lists never show", () => {
    const c = newsCandidates(m, [rss(2, "Figma redraws its logo", "Figma has a new logo, drawn in house.")]).candidates[0]!;
    expect(c.facts.filter(f => f.kind === "line").map(f => f.text)).toEqual(["Item title: “Figma redraws its logo”", "Item excerpt: “Figma has a new logo, drawn in house.”"]);
  });
});
