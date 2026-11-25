// L1 · the living design: the register's bounds, the edition sequence, the never-moves guard, the gate, the dry run, and the
// approve and roll-back actions. Values come from the brief: three to five moves, one step per edition, WCAG AA in both views.
import { describe, expect, it } from "vitest";
import { themeCss } from "../theme/css";
import { slug, slugThemeOf } from "../theme/slug";
import { contrast } from "../theme/contrast";
import { SECTIONS } from "../ia";
import { MARK_INK } from "../../components/brand/mark";
import { slugBrand as K } from "../../../brand/tokens/slug.theme";
import { BASELINE, NEVER_MOVES, SETTINGS, SETTING_IDS, inRange, sectionGap, stepsBetween, type LivingValues } from "./settings";
import { EDITION_0, LIVE_VALUES, SHIPPED, rollbackDecision, sequenceProblems, type EditionRecord, type Move } from "./editions";
import { COMPARE_PAGES, COMPARE_WIDTHS, approveDecision, contrastPairs, gate } from "./gate";
import { dryRun, type LeadingRow } from "./rules";
import { handleDesk, type DeskDeps } from "../stories/desk.server";
// N1 · every desk call names its actor; the owner-level actions carry the confirmation phrase.
const withActor = (b: unknown) => ({ actor: "owner", confirm: `owner confirms ${(b as { action?: string }).action ?? ""}`, ...(b as object) });


const tok = (css: string, name: string) => [...new Set([...css.matchAll(new RegExp(`${name}:([^;}]+)`, "g"))].map(m => m[1]!.trim()))];
const mv = (setting: string, from: unknown, to: unknown): Move => ({ setting, from: from as Move["from"], to: to as Move["to"], signal: null, share: null, count: null, base: null, rule: null });
const comparison = { made_at: "2026-12-01T00:00:00Z", pages: COMPARE_PAGES.flatMap(p => COMPARE_WIDTHS.map(width => ({ page: p.id, width, share: 0.01, before: `b/${p.id}-${width}.png`, after: `a/${p.id}-${width}.png` }))) };
const THREE = [mv("radius", 0, 2), mv("density", 4, 4.25), mv("motion", 240, 260)];
const rec = (number: number, values: LivingValues, moves: Move[], statuses: EditionRecord["statuses"], cmp: unknown = comparison): EditionRecord =>
  ({ number, dated: "2026-12-01", values, moves, statuses, comparison: cmp as EditionRecord["comparison"] });
const base0 = rec(0, BASELINE, [], [{ status: "baseline", at: "2026-11-21T00:00:00Z" }], null);
const next1: LivingValues = { ...BASELINE, radius: 2, density: 4.25, motion: 260 };

describe("settings register", () => {
  it("Edition 0 is today's values: square corners, no heading tracking, 4 rem sections, 240 ms, pink, today's chart weights", () => {
    expect(BASELINE).toMatchObject({ radius: 0, tracking: 0, density: 4, motion: 240, accent: "pink", chart: 1 });
    expect(EDITION_0.status).toBe("baseline"); expect(EDITION_0.moves).toHaveLength(0);
  });
  it("every range is proposed until the owner confirms it", () => { for (const id of SETTING_IDS) expect(SETTINGS[id].range, id).toBe("proposed"); });
  it("every shipped edition is inside its ranges and moves at most one step from the one before", () => { expect(sequenceProblems(SHIPPED)).toEqual([]); });
  it("a value outside its floor or ceiling fails", () => {
    expect(sequenceProblems([{ number: 1, values: { ...BASELINE, radius: 6 } }])).toEqual(["Edition 1: Corner radius is outside its range"]);
    expect(inRange("accent", "teal" as never)).toBe(false);
    expect(inRange("covers", ["card"])).toBe(false); // the chart cover is the floor
  });
  it("a move of more than one step between two editions fails", () => {
    expect(sequenceProblems([{ number: 0, values: BASELINE }, { number: 1, values: { ...BASELINE, radius: 4 } }])).toEqual(["Edition 1: Corner radius moved more than one step"]);
    expect(stepsBetween("radius", 0, 2)).toBe(1);
  });
  it("the tokens the live site writes are the live values, and each is inside its range", () => {
    const css = themeCss(slug);
    expect(tok(css, "--tk-radius-sm")).toEqual([`${LIVE_VALUES.radius}px`]);
    expect(tok(css, "--sys-gap-section")).toEqual([sectionGap(LIVE_VALUES.density).base, sectionGap(4.25).base, sectionGap(LIVE_VALUES.density).lg, sectionGap(4.25).lg]);
    expect(tok(css, "--tk-motion-move")).toContain(`${LIVE_VALUES.motion}ms`);
    expect(tok(css, "--sys-chart-grid")).toEqual([String(1.5 * LIVE_VALUES.chart)]);
    expect(tok(css, "--sys-color-accent")).toContain(K.color[LIVE_VALUES.accent]);
    for (const id of SETTING_IDS) expect(inRange(id, LIVE_VALUES[id]), id).toBe(true);
  });
  it("a moved value reaches its tokens", () => {
    const css = themeCss(slugThemeOf({ ...BASELINE, radius: 2, tracking: -0.005 }));
    expect(tok(css, "--tk-radius-sm")).toEqual(["2px"]);
    expect(tok(css, "--tk-type-display-tracking")).toContain("-0.005em");
  });
});

describe("never moves", () => {
  it("an edition naming the name, the wordmark, the type families or the navigation is refused", () => {
    for (const id of ["name", "wordmark", "families", "navigation"]) {
      const g = gate(BASELINE, [mv(id, "a", "b"), ...THREE], comparison);
      expect(g.checks.find(c => c.id === "never")?.ok, id).toBe(false);
      expect(g.ok).toBe(false);
    }
  });
  it("no setting is bound to a type family, the wordmark or the navigation, and no in-range value changes them", () => {
    for (const id of SETTING_IDS) for (const t of SETTINGS[id].tokens) expect(t, id).not.toMatch(/family|wordmark|nav/);
    const a = slugThemeOf(BASELINE), b = slugThemeOf({ ...BASELINE, radius: 4, tracking: -0.02, motion: 280, chart: 1.25 });
    expect(b.shared.fonts).toEqual(a.shared.fonts);
    for (const m of ["light", "dark", "vibes"] as const) for (const r of Object.keys(a.modes[m].type) as (keyof typeof a.modes.light.type)[]) expect(b.modes[m].type[r].family).toBe(a.modes[m].type[r].family);
    expect(b.name).toBe("slug");
    expect(MARK_INK).toBe(K.color.ink);
    expect(SECTIONS.map(s => s.label)).toEqual(["Today", "Signals", "Brands", "Patterns", "Studies", "Digest", "Tools"]);
    expect(NEVER_MOVES.map(n => n.id)).toEqual(["name", "wordmark", "direction", "families", "navigation", "structures"]);
  });
});

describe("the gate", () => {
  it("passes three in-range one-step moves with a comparison of the five pages at 1440 and 390", () => {
    const g = gate(BASELINE, THREE, comparison);
    expect(g.checks.map(c => [c.id, c.ok])).toEqual([["never", true], ["range", true], ["count", true], ["contrast", true], ["drawable", true], ["comparison", true]]);
  });
  it("refuses two moves and six moves", () => {
    expect(gate(BASELINE, THREE.slice(0, 2), comparison).checks.find(c => c.id === "count")?.ok).toBe(false);
    const six = [...THREE, mv("tracking", 0, -0.005), mv("chart", 1, 1.125), mv("covers", ["card", "chart"], ["card", "chart", "mosaic"])];
    expect(gate(BASELINE, six, comparison).checks.find(c => c.id === "count")?.problems).toEqual(["This edition has 6 moves."]);
  });
  it("refuses a two-step move and a move past the ceiling", () => {
    expect(gate(BASELINE, [mv("radius", 0, 4), ...THREE.slice(1)], comparison).checks.find(c => c.id === "range")?.ok).toBe(false);
    expect(gate(BASELINE, [mv("motion", 240, 300), ...THREE.slice(0, 2)], comparison).checks.find(c => c.id === "range")?.ok).toBe(false);
  });
  it("refuses an edition without the screenshot comparison", () => {
    const g = gate(BASELINE, THREE, { made_at: "x", pages: comparison.pages.filter(p => p.page !== "terminal") });
    expect(g.checks.find(c => c.id === "comparison")?.problems).toEqual(["The terminal at 1440 px is missing.", "The terminal at 390 px is missing."]);
  });
  it("every text and background pair meets WCAG AA in both views at today's values", () => {
    const pairs = contrastPairs(BASELINE);
    expect(new Set(pairs.map(p => p.view))).toEqual(new Set(["read", "data"]));
    for (const p of pairs) expect(contrast(p.fg, p.bg), `${p.view} ${p.what}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dry run", () => {
  const row = (i: number, o: Partial<LeadingRow>): LeadingRow => ({ domain: `b${i}.com`, rank: i, captured_at: "2026-11-20", cta_radius_bucket: null, h1_tracking: null, whitespace_ratio: null, ...o });
  it("pill buttons on 12 of 18 measured leading brands propose corners one step rounder, and nothing is written", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(i, i < 18 ? { cta_radius_bucket: i < 12 ? "pill" : "square" } : {}));
    const r = dryRun(BASELINE, rows).rows.find(x => x.setting === "radius")!;
    expect(r.signalText).toBe("Pill buttons on 12 of 18 leading brands whose main button we measured (67%)");
    expect(r.proposed).toBe(2);
  });
  it("a share between 20% and 60% is no move; fewer than 15 measured is not read", () => {
    const mid = Array.from({ length: 20 }, (_, i) => row(i, { cta_radius_bucket: i < 8 ? "pill" : "square" }));
    expect(dryRun(BASELINE, mid).rows.find(x => x.setting === "radius")?.proposedText).toBe("No move");
    const few = Array.from({ length: 14 }, (_, i) => row(i, { cta_radius_bucket: "pill" }));
    expect(dryRun(BASELINE, few).rows.find(x => x.setting === "radius")?.proposed).toBeNull();
  });
  it("settings with no measured signal are set by hand", () => {
    const hand = dryRun(BASELINE, []).rows.filter(r => r.proposedText === "Set by hand").map(r => r.setting);
    expect(hand).toEqual(["motion", "accent", "chart", "covers", "motifs"]);
  });
});

describe("approve and roll back", () => {
  const proposed = rec(1, next1, THREE, [{ status: "proposed", at: "2026-12-01T00:00:00Z" }]);
  it("approves a proposed edition that passes the gate; never one that is not proposed", () => {
    expect(approveDecision([base0, proposed], 1)).toMatchObject({ ok: true, status: "approved" });
    expect(approveDecision([base0], 0).ok).toBe(false);
    expect(approveDecision([base0, { ...proposed, values: { ...next1, radius: 4 } }], 1).ok).toBe(false);
  });
  it("rolling back restores the previous edition's values exactly", () => {
    const live1 = rec(1, next1, THREE, [{ status: "proposed", at: "a" }, { status: "approved", at: "b" }, { status: "live", at: "c" }]);
    const live2 = rec(2, { ...next1, radius: 4, density: 4.5, motion: 280 }, [mv("radius", 2, 4), mv("density", 4.25, 4.5), mv("motion", 260, 280)], [{ status: "live", at: "d" }]);
    expect(rollbackDecision([base0, live1, live2], 2)).toEqual({ ok: true, status: "rolled back", restores: next1 });
    expect(rollbackDecision([base0, live1], 1)).toEqual({ ok: true, status: "rolled back", restores: BASELINE });
    expect(rollbackDecision([base0], 0).ok).toBe(false);
  });
  it("the desk writes one status row only behind the editor key, and refuses what the gate refuses", async () => {
    const rows: unknown[] = [];
    const d: DeskDeps = { authorize: async r => r.headers.get("authorization") === "Bearer good", allow: () => true, now: () => 0,
      store: { exists: async () => false, insertEdit: async () => { throw new Error("no"); }, queue: async () => [], living: { records: async () => [base0, proposed], insertStatus: async r => { rows.push(r); } } } };
    const post = (body: unknown, auth = "Bearer good") => new Request("https://site.test/api/public/desk", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(withActor(body)) });
    expect((await handleDesk(post({ action: "living_approve", edition: 1 }, "Bearer bad"), d)).status).toBe(401);
    expect(rows).toHaveLength(0);
    expect((await handleDesk(post({ action: "living_rollback", edition: 1 }), d)).status).toBe(409);
    expect((await handleDesk(post({ action: "living_approve", edition: 1 }), d)).status).toBe(201);
    expect(rows).toEqual([{ edition: 1, status: "approved", note: null }]);
  });
});
