import { it, expect } from "vitest";
import { advance, equalField, type Baseline, type Pending } from "./library-diff";
it("tag sets differ only below Jaccard 0.5", () => { expect(equalField("imagery",["a","b"],["a"])).toBe(true); expect(equalField("imagery",["a","b"],["c"])).toBe(false); });
it("requires two consecutive tag captures before emitting imagery_shift", () => {
 let baseline: Baseline | null = null, pending: Pending = {};
 const captures = [["product_ui"],["photography_people"],["photography_people"]];
 const events = captures.map((imagery,i) => { const r = advance(baseline,pending,{ signals:{ai_tags:{imagery}},snapshot_id:i+1,captured_at:`2026-11-${10+i}T00:00:00Z`,context:{page_type:"home",viewport:"desktop"} }); baseline=r.baseline;pending=r.pending;return r.events; });
 expect(events[0]).toEqual([]);expect(events[1]).toEqual([]);expect(events[2]?.[0]?.type).toBe("imagery_shift");
});
it("confirms plan membership changes twice, ignoring ordering", () => { expect(equalField("ai_pricing",{cheapest_paid_monthly:10,plans:["Pro","Free"]},{cheapest_paid_monthly:10,plans:["Free","Pro"]})).toBe(true);expect(equalField("ai_pricing",{cheapest_paid_monthly:10,plans:["Pro"]},{cheapest_paid_monthly:12,plans:["Pro"]})).toBe(false); });
it('emits pricing_change only on the second consecutive extracted price',()=>{
 let baseline:Baseline|null=null,pending:Pending={};
 const events=[10,12,10,12,12].map((price,i)=>{const r=advance(baseline,pending,{signals:{ai_pricing:{cheapest_paid_monthly:price,plans:['Pro']}},snapshot_id:i+1,captured_at:`2026-11-${10+i}T00:00:00Z`,context:{page_type:'pricing',viewport:'desktop'}});baseline=r.baseline;pending=r.pending;return r.events;});
 expect(events.slice(0,4).flat()).toEqual([]);expect(events[4]?.map(e=>e.type)).toEqual(['pricing_change']);
});
it('confirms aesthetic changes for desktop home only',()=>{
 for(const viewport of ['desktop','mobile']){let baseline:Baseline|null=null,pending:Pending={};const events=[['minimal'],['brutalist'],['brutalist']].flatMap((aesthetic,i)=>{const r=advance(baseline,pending,{signals:{ai_tags:{aesthetic}},snapshot_id:i+1,captured_at:`2026-11-${10+i}T00:00:00Z`,context:{page_type:'home',viewport}});baseline=r.baseline;pending=r.pending;return r.events;});expect(events.map(e=>e.type)).toEqual(viewport==='desktop'?['aesthetic_shift']:[]);}
});