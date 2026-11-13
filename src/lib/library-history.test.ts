import {describe,it,expect} from "vitest";
import {quarter,archiveVersions} from "./library-history";
import {replayLibrary,type ReplaySnapshot} from "./library-replay";
import {archiveFont} from "./library-archive";
const make=(id:number,date:string,theme:string,source="wayback"):ReplaySnapshot=>({id,domain:"example.com",sector:"ai",page_type:"home",viewport:"desktop",source,captured_at:date,signals:{color:{theme},archive:{quarter:quarter(date)}}});
describe("quarterly archive replay",()=>{
 it("confirms only after two captures with first-change effective date",()=>{const rows=[make(1,"2021-01-01T00:00:00Z","light"),make(2,"2021-04-01T00:00:00Z","dark"),make(3,"2021-07-01T00:00:00Z","dark")];expect(replayLibrary(rows.slice(0,2)).events).toEqual([]);expect(replayLibrary(rows).events).toMatchObject([{source:"wayback",type:"theme_flip",effective_at:"2021-04-01T00:00:00Z"}]);});
 it("out of order produces identical history",()=>{const rows=[make(1,"2021-01-01T00:00:00Z","light"),make(2,"2021-04-01T00:00:00Z","dark"),make(3,"2021-07-01T00:00:00Z","dark")];expect(replayLibrary([rows[2] as ReplaySnapshot,rows[0] as ReplaySnapshot,rows[1] as ReplaySnapshot])).toEqual(replayLibrary(rows));});
 it("archive inputs cannot affect live baseline or events",()=>{const live=[make(4,"2026-01-01T00:00:00Z","dark","live"),make(5,"2026-04-01T00:00:00Z","light","live")];const all=replayLibrary([...live,make(1,"2021-01-01T00:00:00Z","light"),make(2,"2021-04-01T00:00:00Z","dark")]);expect(all.baselines.filter(r=>r.source==="live")).toEqual(replayLibrary(live).baselines);expect(all.events.filter(r=>r.source==="live")).toEqual(replayLibrary(live).events);});
 it("font failures use normalized declared first family",()=>expect(archiveFont({archive:{fonts_failed:1},type:{declared:{h1:{stack:['"Canela Webfont"','serif']}},rendered:{h1:{family:"Arial",webfont:false,substituted:true}}}},"h1")["family"]).toBe("canela"));
 it("non-webfont uses declared font even without failure count",()=>expect(archiveFont({type:{declared:{body:{stack:"Inter, sans-serif"}},rendered:{body:{family:"Arial",webfont:false}}}},"body")["family"]).toBe("inter"));
 it.each([['"__Inter_Fallback_aaf875", "__styreneA_403256", serif',"styrenea"],[["__Inter_Fallback_aaf875","__fkGrotesk_716da7","serif"],"fkgrotesk"]])("skips Next.js fallback in declared stack %j",(stack,expected)=>expect(archiveFont({type:{declared:{h1:{stack}},rendered:{h1:{family:"Arial",webfont:false}}}},"h1")["family"]).toBe(expected));
 it("UTC quarter boundaries",()=>{expect(quarter("2021-03-31T23:59:59Z")).toBe("2021Q1");expect(quarter("2021-04-01T00:00:00Z")).toBe("2021Q2");expect(quarter("2021-04-01T00:30:00+02:00")).toBe("2021Q1");});
 it("samples each quarter independently",()=>{const rows=[make(1,"2021-01-01T00:00:00Z","light"),make(2,"2021-04-01T00:00:00Z","dark")];expect(archiveVersions(rows)).toHaveLength(2);});
 it("two captures in one quarter cannot confirm a change",()=>{const rows=[make(1,"2021-01-01T00:00:00Z","light"),make(2,"2021-04-01T00:00:00Z","dark"),make(3,"2021-05-01T00:00:00Z","dark")];expect(replayLibrary(rows).events).toEqual([]);});
});
