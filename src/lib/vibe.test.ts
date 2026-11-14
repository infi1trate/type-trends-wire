import { describe, expect, it } from "vitest";
import { fitVibe, siteTokens, signNormalize, clusterName, clusterMomentum, tagPhrase, VIBE_K_RANGE, type VibeSite } from "./vibe";

// Deterministic fixture: 6 archetypes × 12 sites with a rotating extra tag.
const ARCH = [
  ["aesthetic:neo_brutalist", "tone:playful", "color_mood:vivid"],
  ["aesthetic:editorial", "tone:premium", "headline:serif"],
  ["aesthetic:dark_tech", "tone:technical", "theme:dark"],
  ["aesthetic:minimal", "imagery:product_ui", "components:logo_wall"],
  ["imagery:photography_lifestyle", "tone:friendly", "color_mood:earthy"],
  ["imagery:abstract_shapes", "hero_layout:centered_stack", "type:mono"],
];
const EXTRA = ["components:faq", "components:pricing_table", "hero_layout:split_left_text", "color_mood:muted"];
const SECTORS = ["ai", "fintech", "studios"];
const sites = (): VibeSite[] => ARCH.flatMap((a, i) => Array.from({ length: 12 }, (_, j) => ({ domain: `s${i}-${j}.com`, sector: SECTORS[(i + j) % 3]!, quarter: "2026Q4", tokens: [...a, EXTRA[(i + j) % 4]!, ...(j % 3 === 0 ? ["components:testimonial_quote"] : [])].sort() })));

describe("vibe map", () => {
  it("is deterministic: same input gives identical coordinates and clusters", () => {
    const a = fitVibe(sites()), b = fitVibe(sites());
    expect(b.points).toEqual(a.points);
    expect(b.clusters).toEqual(a.clusters);
  });
  it("does not depend on input order", () => {
    const a = fitVibe(sites()), b = fitVibe([...sites()].reverse());
    expect(b.points).toEqual(a.points);
    expect(b.clusters.map(c => c.name)).toEqual(a.clusters.map(c => c.name));
  });
  it("sign-normalizes components so the largest loading is positive", () => {
    expect(signNormalize([0.1, -0.9, 0.3])).toEqual([-0.1, 0.9, -0.3]);
    const m = fitVibe(sites());
    for (const c of m.components) { const big = c.reduce((x, y) => (Math.abs(y) > Math.abs(x) ? y : x), 0); expect(big).toBeGreaterThan(0); }
  });
  it("chooses k within 6..8 by the best silhouette (ties → smaller k)", () => {
    const m = fitVibe(sites());
    expect(VIBE_K_RANGE).toContain(m.k as 6 | 7 | 8);
    expect(Object.keys(m.silhouettes).sort()).toEqual(["6", "7", "8"]);
    const best = Math.max(...Object.values(m.silhouettes));
    expect(m.silhouettes[String(m.k)]).toBe(best);
    expect(Object.entries(m.silhouettes).filter(([k, v]) => v === best && Number(k) < m.k)).toEqual([]);
    expect(new Set(m.points.map(p => p.cluster)).size).toBe(m.k);
  });
  it("names clusters from their two most distinguishing tags", () => {
    const m = fitVibe(sites()), names = m.clusters.map(c => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of m.clusters) expect(c.name.startsWith(tagPhrase(c.top_tags[0]!.tag)) || c.name.includes(tagPhrase(c.top_tags[1]!.tag))).toBe(true);
    expect(clusterName(["aesthetic:neo_brutalist", "tone:playful"], new Set(), 0)).toBe("soft brutalism · playful");
    expect(clusterName(["aesthetic:editorial", "color_mood:earthy"], new Set(), 0)).toBe("editorial · warm");
    expect(clusterName(["aesthetic:editorial", "tone:premium", "headline:serif"], new Set(["editorial · premium"]), 3)).toBe("editorial · serif");
    expect(tagPhrase("color_mood:earthy")).toBe("warm");
  });
  it("skips blocked, low-confidence and <0.4 tags", () => {
    const base = { aesthetic: ["minimal"], tone: ["calm"], imagery: [], components: [], hero_layout: "text_only", color_mood: "muted", confidence: 0.9 };
    expect(siteTokens({ theme: "dark", ai_tags: base })).toEqual(["aesthetic:minimal", "color_mood:muted", "hero_layout:text_only", "theme:dark", "tone:calm"]);
    expect(siteTokens({ ai_tags: { ...base, confidence: 0.3 } })).toBeNull();
    expect(siteTokens({ ai_tags: { ...base, low_confidence: true } })).toBeNull();
    expect(siteTokens({ ai_tags: { ...base, blocked_reason: "captcha" } })).toBeNull();
  });
  it("measures cluster momentum against the earliest quarter with ≥30 sites", () => {
    const m = fitVibe(sites());
    const old = sites().filter(s => !s.domain.startsWith("s0-")).map(s => ({ ...s, quarter: "2021Q1" }));
    const { base_quarter, momentum } = clusterMomentum(m, old);
    expect(base_quarter).toBe("2021Q1");
    const brutal = m.clusters.find(c => c.name.startsWith("soft brutalism"))!;
    expect(momentum.get(brutal.id)!.from_share).toBe(0);
    expect(momentum.get(brutal.id)!.delta_pts).toBeCloseTo(100 / 6, 0);
  });
});
