// U3 · the design system: one object, written out as CSS custom properties and mirrored in TypeScript, so they cannot drift.
import { describe, expect, it } from "vitest";
import { activeCss, activeTheme, SYSTEM } from "./index";
import { COLOR_ROLES, TYPE_STEPS, parseSystemCss, sysColor, sysText, systemCss, systemOf, systemSteps, systemVars, SYSTEM_BREAKPOINTS } from "./system";

const css = systemCss(SYSTEM), parsed = parseSystemCss(css);
const DATA = `:root,[data-mode="dark"]`, READ = `[data-mode="light"]`;

describe("U3 · one source for the design values", () => {
  it("the TypeScript mirror is the object the CSS is written from", () => {
    expect(SYSTEM).toEqual(systemOf(activeTheme));
    expect(activeCss()).toContain(css);
  });
  it("the CSS parsed back equals the TypeScript values, for Read and Data, at every breakpoint", () => {
    expect(parsed.base[DATA]).toEqual(systemVars(SYSTEM, "data"));
    expect(parsed.base[READ]).toEqual(systemVars(SYSTEM, "read"));
    for (const bp of ["md", "lg", "xl"] as const) {
      const m = parsed.media[`min-width:${SYSTEM_BREAKPOINTS[bp]}`] ?? {};
      for (const [sel, v] of [[DATA, "data"], [READ, "read"]] as const) expect(m[sel] ?? {}, `${bp} ${v}`).toEqual(systemSteps(SYSTEM, v, bp));
    }
  });
  it("every colour role has a Read value and a Data value, and both views use the same role names", () => {
    expect(COLOR_ROLES).toEqual(["page", "surface", "ink", "ink-muted", "rule", "highlight", "accent", "link", "focus", "positive", "negative", "measured", "ai-estimate", "warning", "chip"]);
    for (const r of COLOR_ROLES) { expect(SYSTEM.color[r].read, r).toMatch(/\S/); expect(SYSTEM.color[r].data, r).toMatch(/\S/); }
    expect(Object.keys(parsed.base[READ]!).filter(k => k.startsWith("--sys-color-"))).toEqual(Object.keys(parsed.base[DATA]!).filter(k => k.startsWith("--sys-color-")));
    expect(parsed.base[READ]![sysColor("page")]).not.toBe(parsed.base[DATA]![sysColor("page")]);
  });
  it("names the reading step at the size of a story body and a study's opening: 17 px on phones, 18 px from 1440 px design width", () => {
    expect(TYPE_STEPS).toContain("reading");
    const r = SYSTEM.type.reading.read;
    expect(r.family).toBe("text");
    expect(parsed.base[READ]![sysText("reading", "size")]).toBe(r.size);
    expect(SYSTEM.shape.measure).toBe("68ch");
  });
  it("section gaps follow the 48 / 64 px rule and reduced motion zeroes every duration in one place", () => {
    expect(SYSTEM.space.section).toEqual({ base: "3rem", lg: "4rem" });
    const reduced = css.split("\n").find(l => l.startsWith("@media (prefers-reduced-motion:reduce)"))!;
    for (const k of Object.keys(SYSTEM.motion.duration)) expect(reduced).toContain(`--sys-motion-${k}:0ms`);
    expect(css.match(/prefers-reduced-motion/g)).toHaveLength(1);
  });
});
