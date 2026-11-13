import { describe, it, expect } from "vitest";
import { halfYear, archiveVersions } from "./library-history";
import { advance, confirmsOnce, diffLibrarySignals, type LibraryEventType } from "./library-diff";
describe("Wayback confirmation",()=>{
 for(const type of ["type_change","theme_flip","redesign","stack_change","aesthetic_shift","imagery_shift"] as LibraryEventType[])it(`confirms ${type} with one archive capture`,()=>{expect(confirmsOnce("wayback",type)).toBe(true);expect(confirmsOnce("live",type)).toBe(false);});
 for(const type of ["palette_shift","layout_change","nav_change","message_pivot","pricing_change","new_surface"] as LibraryEventType[])it(`skips archive ${type}`,()=>expect(confirmsOnce("wayback",type)).toBe(false));
 it("immediately confirms historical theme with capture effective date, retaining live two-capture confirmation",()=>{
  const context={page_type:"home",viewport:"desktop",source:"wayback"};
  const baseline=advance(null,{}, {signals:{color:{theme:"light"}},snapshot_id:1,captured_at:"2021-01-01T00:00:00Z",context}).baseline;
  const next={signals:{color:{theme:"dark"},layout:{hero_media:"video"},lexicon:{h1:"Different message"}},snapshot_id:2,captured_at:"2021-07-01T00:00:00Z",context};
  const result=advance(baseline,{},next);expect(result.events).toMatchObject([{type:"theme_flip",effective_at:"2021-07-01T00:00:00Z"}]);expect(result.pending).toEqual({});
  expect(advance(baseline,{}, {...next,context:{...context,source:"live"}}).events).toEqual([]);
 });
 it("never emits new_surface for archives",()=>expect(diffLibrarySignals(null,{}, {source:"wayback",page_type:"home",viewport:"desktop",new_surface:true,first_captured_at:"2021-01-01T00:00:00Z",captured_at:"2022-01-01T00:00:00Z"})).toEqual([]));
});
describe("UTC half-year sampling",()=>{
 it("assigns January and July boundaries",()=>{expect(halfYear("2021-06-30T23:59:59Z")).toBe("2021-01-01");expect(halfYear("2021-07-01T00:00:00Z")).toBe("2021-07-01");expect(halfYear("2021-12-31T23:59:59Z")).toBe("2021-07-01");});
 it("uses UTC even with offsets",()=>expect(halfYear("2021-07-01T00:30:00+02:00")).toBe("2021-01-01"));
 it("selects last archive desktop home capture in each half year",()=>{const common={source:"wayback",page_type:"home",viewport:"desktop"};expect(archiveVersions([{...common,captured_at:"2021-01-01T00:00:00Z"},{...common,captured_at:"2021-06-01T00:00:00Z"},{...common,source:"live",captured_at:"2021-06-02T00:00:00Z"},{...common,viewport:"mobile",captured_at:"2021-06-03T00:00:00Z"}]).map(s=>s.captured_at)).toEqual(["2021-06-01T00:00:00Z"]);});
});