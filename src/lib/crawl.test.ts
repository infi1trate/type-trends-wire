import { describe, expect, it } from "vitest";
import { compare, percent, readScope, saveScope, spreadText } from "./crawl";
describe("crawler comparisons", () => {
  it("formats shares as percentages", () => expect(percent(.31)).toBe("31.0%"));
  it("formats positive spreads in points", () => expect(spreadText(33)).toBe("+33 PTS"));
  it("formats negative spreads in points", () => expect(spreadText(-12)).toBe("-12 PTS"));
  it("keeps prior-run gaps unknown", () => expect(spreadText(null)).toBe("—"));
  it("orders comparisons by vanguard share", () => expect(compare([{index_name:"mainstream",share:.9,k:"a"},{index_name:"vanguard",share:.2,k:"a"},{index_name:"vanguard",share:.8,k:"b"}], r=>r.k)).toEqual([{label:"b",v:.8,m:0},{label:"a",v:.2,m:.9}]));
});
describe("language scope persistence", () => {
  it("defaults to English", () => expect(readScope({getItem:()=>null})).toBe("en"));
  it("persists ALL using the specified key", () => {
    const values = new Map<string,string>();
    saveScope({setItem:(k,v)=>{values.set(k,v);}},"all");
    expect(values.get("dsgn.scope")).toBe("all");
    expect(readScope({getItem:k=>values.get(k)??null})).toBe("all");
  });
  it("survives blocked storage", () => expect(readScope({getItem:()=>{throw Error();}})).toBe("en"));
});