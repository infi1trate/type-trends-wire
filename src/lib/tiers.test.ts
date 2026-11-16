import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/trait-keys.json";
import { CATEGORY_JUDGMENT, KEY_OVERRIDES, MOVES_DEADBAND_PTS, COVERAGE_MIN_SITES, classifyAll, classifyTrait, headlineKeys, judgment, restrictToHeadline, tierCounts, tierFor, type TierStats } from "./tiers";
import { COMPOSITES } from "./composites";
import { canonical } from "./labels";

const KEYS = (fixture as { keys: string[] }).keys;
const moving: TierStats = { status: "ok", stage: "accelerating", momentum: 2, sites: 120, prevStages: ["accelerating", "accelerating"] };
const still: TierStats = { status: "ok", stage: "flat", momentum: 0.2, sites: 120, prevStages: ["flat", "flat"] };

describe("tiers: fixture coverage", () => {
  it("every fixture key gets a tier and at least one reason; none unclassified", () => {
    const all = classifyAll(KEYS.map(key => ({ key, stats: null })));
    for (const raw of KEYS) {
      const r = all.get(canonical(raw));
      expect(r, raw).toBeTruthy();
      expect(["headline", "supporting", "archive"]).toContain(r!.tier);
      expect(r!.reasons.length, raw).toBeGreaterThan(0);
      expect(judgment(raw).source, raw).not.toBe("unknown");
    }
  });
  it("every override and category judgment carries a one-line reason", () => {
    for (const [k, j] of Object.entries({ ...KEY_OVERRIDES, ...CATEGORY_JUDGMENT })) { expect(j.why.length, k).toBeGreaterThan(10); expect(j.why).not.toMatch(/\n/); }
  });
});

describe("tiers: the four questions", () => {
  it("headline needs visible, decision, coverage and moves", () => {
    expect(classifyTrait("theme:dark", moving)).toMatchObject({ tier: "headline", checks: { visible: true, decision: true, coverage: true, moves: true } });
  });
  it("visible + decision but not moving → supporting", () => {
    expect(classifyTrait("theme:dark", still)).toMatchObject({ tier: "supporting", checks: { moves: false } });
  });
  it("coverage fails below the forecast's own site minimum or without a fitted curve", () => {
    expect(classifyTrait("theme:dark", { ...moving, sites: COVERAGE_MIN_SITES - 1 }).tier).toBe("supporting");
    expect(classifyTrait("theme:dark", { ...moving, status: "insufficient_data" }).tier).toBe("supporting");
    expect(classifyTrait("theme:dark", null).tier).toBe("supporting");
  });
  it("moves: momentum beyond the flat dead-band, or a stage change within two runs, counts as moving", () => {
    expect(classifyTrait("theme:dark", { ...still, momentum: MOVES_DEADBAND_PTS + 0.1 }).tier).toBe("headline");
    expect(classifyTrait("theme:dark", { ...still, momentum: MOVES_DEADBAND_PTS }).tier).toBe("supporting");
    expect(classifyTrait("theme:dark", { ...still, prevStages: ["flat", "emerging"] }).tier).toBe("headline");
  });
  it("build plumbing is archive however much it moves", () => {
    for (const k of ["css:subgrid", "css:cascade_layers", "framework:webflow", "tech:react"]) expect(classifyTrait(k, moving).tier, k).toBe("archive");
  });
  it("fine measurement buckets and Google Fonts ranks are supporting at most", () => {
    for (const k of ["h1_size:64–95", "grid_cols:3", "cta_shape:pill", "whitespace:median", "family:Inter"]) expect(classifyTrait(k, moving).tier, k).toBe("supporting");
  });
});

describe("tiers: overrides", () => {
  it("visitor-visible CSS and tech effects are promoted", () => {
    for (const k of ["css:scroll_timeline", "css:view_transitions", "css:backdrop_filter", "css:variable_fonts", "tech:gsap", "tech:three"]) expect(classifyTrait(k, moving).tier, k).toBe("headline");
  });
  it("residual values and page furniture are not headlines", () => {
    expect(classifyTrait("ai_positioning:none", moving).tier).toBe("archive");
    expect(classifyTrait("components:cookie_banner", moving).tier).toBe("archive");
    expect(classifyTrait("components:faq_accordion", moving).tier).toBe("supporting");
  });
});

describe("tiers: composites demote their members", () => {
  it("a headline composite drops its headline members to supporting with a reason", () => {
    const out = classifyAll([{ key: "combo:dark_tech", stats: moving }, { key: "theme:dark", stats: moving }, { key: "aesthetic:dark_tech", stats: moving }, { key: "theme:light", stats: moving }]);
    expect(out.get("combo:dark_tech")!.tier).toBe("headline");
    for (const m of ["theme:dark", "aesthetic:dark_tech"]) { expect(out.get(m)!.tier, m).toBe("supporting"); expect(out.get(m)!.demotedBy).toEqual(["combo:dark_tech"]); expect(out.get(m)!.reasons.at(-1)).toMatch(/Dark tech look/); }
    expect(out.get("theme:light")!.tier).toBe("headline");
  });
  it("a composite that fails the tier rules leaves its members alone", () => {
    const out = classifyAll([{ key: "combo:dark_tech", stats: still }, { key: "theme:dark", stats: moving }]);
    expect(out.get("combo:dark_tech")!.tier).toBe("supporting");
    expect(out.get("theme:dark")!.tier).toBe("headline");
  });
  it("every composite is classified even without a forecast row", () => {
    const out = classifyAll([]);
    for (const c of COMPOSITES) expect(out.get(c.key), c.key).toBeTruthy();
  });
});

describe("tiers: helpers", () => {
  it("alert candidates are restricted to headline signals", () => {
    const head = headlineKeys([{ key: "theme:dark", stats: moving }, { key: "css:subgrid", stats: moving }]);
    expect(restrictToHeadline([{ trait: "theme:dark" }, { trait: "css:subgrid" }, { trait: "theme:light" }], head)).toEqual([{ trait: "theme:dark" }]);
  });
  it("counts and tierFor fall back to the static judgment", () => {
    const m = classifyAll([{ key: "theme:dark", stats: moving }]);
    expect(tierCounts(m).headline).toBeGreaterThanOrEqual(1);
    expect(tierFor(m, "theme:dark")).toBe("headline");
    expect(tierFor(m, "framework:webflow")).toBe("archive");
  });
});
