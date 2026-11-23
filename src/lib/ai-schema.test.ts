import { it, expect } from "vitest";
import { cleanTags, tagsSchema, reusableTags, normalizeExtraction, pricingSchema, changelogSchema, productSchema } from "./ai-schema";
const tags = { imagery: ["product_ui"], aesthetic: ["minimal"], components: [], hero_layout: "product_first", ai_positioning: "none", tone: ["calm"], color_mood: "monochrome", confidence: 0.8 };
it("cleans out-of-vocabulary arrays and duplicates", () => expect(cleanTags({ ...tags, imagery: ["product_ui","invalid","product_ui"] }).imagery).toEqual(["product_ui"]));
it("rejects invalid scalar vocabularies", () => expect(() => cleanTags({ ...tags, hero_layout: "random" })).toThrow());
it("validates confidence from zero to one", () => expect(tagsSchema.safeParse({ ...tags, confidence: 1.1 }).success).toBe(false));
it("allows empty arrays", () => expect(tagsSchema.safeParse({ ...tags, imagery: [], aesthetic: [], tone: [] }).success).toBe(true));
it("reuses only same domain and signals hash below 60 days", () => {
 const row = { domain: "x.com", signals_hash: "a", created_at: "2026-10-01T00:00:00Z", tags };
 expect(reusableTags(row,"x.com","a",new Date("2026-11-11T00:00:00Z"))).toBe(true);
 expect(reusableTags(row,"x.com","b",new Date("2026-11-11T00:00:00Z"))).toBe(false);
 expect(reusableTags(row,"y.com","a",new Date("2026-11-11T00:00:00Z"))).toBe(false);
 expect(reusableTags(row,"x.com","a",new Date("2026-11-30T00:00:00Z"))).toBe(false);
});
it("rejects overlong pricing limits", () => {
 const base={currency:"USD",plans:[{name:"Pro",price_monthly:10,price_basis:"flat",billing:"monthly",is_free:false,is_enterprise_contact:false,highlighted:false,ai_addon:false,key_limits:["a","b","c"]}],has_free_tier:false,has_trial:false,trial_days:null,has_usage_based:false,has_ai_addon:false,ai_credits_model:false,cheapest_paid_monthly:10};
 expect(pricingSchema.safeParse(base).success).toBe(true);
 expect(pricingSchema.safeParse({...base,plans:[{...base.plans[0],key_limits:["a","b","c","d"]}]}).success).toBe(false);
});
it("bounds changelog to 15 entries and product to 20", () => {
 expect(changelogSchema.safeParse({ entries: Array(16).fill({date:null,title:"a",category:"ai"}),latest_date:null,entries_last_30d:0,ai_share:0 }).success).toBe(false);
 expect(productSchema.safeParse({ features:Array(21).fill({name:"a",theme:"ai_agents"}),primary_theme:"ai_agents",mentions_agents:true,mentions_mcp:false }).success).toBe(false);
});
it("derives cheapest paid price rather than trusting model totals", () => {
 const p = normalizeExtraction("pricing",{currency:"USD",plans:[{name:"Pro",price_monthly:10,price_basis:"flat",billing:"monthly",is_free:false,is_enterprise_contact:false,highlighted:false,ai_addon:false,key_limits:[]}],has_free_tier:true,has_trial:false,trial_days:null,has_usage_based:false,has_ai_addon:false,ai_credits_model:false,cheapest_paid_monthly:999},"2026-11-11T00:00:00Z");
 expect(p).toMatchObject({cheapest_paid_monthly:10,has_free_tier:false});
});
it('clears all visual claims and caps confidence at 0.2 for every blocked reason',()=>{for(const blocked_reason of ['blank','captcha','cookie_wall','login_wall','error_page'])expect(cleanTags({...tags,components:['logo_wall'],confidence:.9,blocked_reason})).toMatchObject({imagery:[],aesthetic:[],components:[],tone:[],hero_layout:null,ai_positioning:null,color_mood:null,confidence:.2,blocked_reason,low_confidence:true});});
it('marks confidence below 0.4 unreliable and forbids reuse at that threshold',()=>{for(const confidence of [.39,.4]){const cleaned=cleanTags({...tags,confidence});expect(cleaned.low_confidence).toBe(confidence<.4);expect(reusableTags({domain:'x.com',signals_hash:'a',created_at:'2026-11-10T00:00:00Z',tags:cleaned},'x.com','a',new Date('2026-11-11T00:00:00Z'))).toBe(confidence>=.4);}});
import { describe } from "vitest";
import { normalizeCurrency } from "./ai-schema";
describe("normalizeCurrency", () => {
 it.each([["$","USD"],["US$","USD"],["usd","USD"],[" USD ","USD"],["€","EUR"],["eur","EUR"],["£","GBP"],["gbp","GBP"],["¥","JPY"],["cad","CAD"],["dollars",null],["",null],[null,null]] as const)("%s -> %s",(input,out)=>expect(normalizeCurrency(input)).toBe(out));
 it("applies when storing pricing", () => { const p = normalizeExtraction("pricing",{currency:"$",plans:[],has_free_tier:false,has_trial:false,trial_days:null,has_usage_based:false,has_ai_addon:false,ai_credits_model:false,cheapest_paid_monthly:null},"2026-11-11T00:00:00Z") as {currency:string|null}; expect(p.currency).toBe("USD"); });
});

// T2 · B: the changelog reading repairs what the code recomputes or can clip, and gives every stored good answer back unchanged.
import golden from "./fixtures/changelog-golden.json";
describe("T2 changelog reading", () => {
  it("gives the ten stored good answers back unchanged", () => {
    expect(golden.cases).toHaveLength(10);
    // entries_last_30d depends on the capture date the answer was counted against (a reused answer was counted for a later capture), so
    // it is recounted; everything else must come back exactly as stored.
    const but30 = (x: unknown) => ({ ...(x as object), entries_last_30d: 0 });
    for (const c of golden.cases) expect(but30(normalizeExtraction("changelog", c.data, c.captured_at))).toEqual(but30(c.data));
  });
  it("ignores the model's own count and share, clips long titles, reads partial dates as unknown, keeps the 15 newest", () => {
    const entries = Array.from({ length: 18 }, (_, i) => ({ date: i === 0 ? "2026-11" : `2026-10-${String(10 + i).padStart(2, "0")}`, title: i === 1 ? `${"word ".repeat(40)}end` : `Entry ${i}`, category: i % 2 ? "ai" : "feature" }));
    const out = normalizeExtraction("changelog", { entries, latest_date: "Nov 2026", entries_last_30d: 40, ai_share: 50 }, "2026-11-01T00:00:00Z") as { entries: { date: string | null; title: string }[]; entries_last_30d: number; ai_share: number; latest_date: string | null };
    expect(changelogSchema.safeParse(out).success).toBe(true);
    expect(out.entries).toHaveLength(15);
    expect(out.entries[0]!.date).toBe("2026-10-27");
    expect(out.entries.some(e => e.date === null)).toBe(false); // the undated entry sorts last and falls outside the newest 15
    expect(out.latest_date).toBe("2026-10-27");
    expect(out.entries_last_30d).toBe(15);
    expect(out.ai_share).toBeLessThanOrEqual(1);
    const long = normalizeExtraction("changelog", { entries: [{ date: null, title: `${"word ".repeat(40)}end`, category: "fix" }], latest_date: null, entries_last_30d: 0, ai_share: 0 }, "2026-11-01T00:00:00Z") as { entries: { title: string }[] };
    expect(long.entries[0]!.title.length).toBeLessThanOrEqual(120);
    expect(long.entries[0]!.title.endsWith("…")).toBe(true);
  });
  it("still refuses an unknown category", () => {
    expect(() => normalizeExtraction("changelog", { entries: [{ date: null, title: "x", category: "marketing" }] }, "2026-11-01T00:00:00Z")).toThrow();
  });
});
