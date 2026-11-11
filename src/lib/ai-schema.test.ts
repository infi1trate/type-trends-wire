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