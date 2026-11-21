import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_THEME, BRAND_KIT as K, COMPARISON_THEMES, MODES, THEMES, activeTheme, flatten, fontLinks, missingTokens, type Mode } from "./index";
import { legacy } from "./legacy";
import { slug } from "./slug";
import { AA, contrast } from "./contrast";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("the slug theme", () => {
  it("is registered and active everywhere; legacy stays in the folder, unregistered, for before/after comparisons", () => {
    expect(ACTIVE_THEME).toBe("slug");
    expect(activeTheme).toBe(slug);
    expect(Object.keys(THEMES)).not.toContain("legacy");
    expect(COMPARISON_THEMES["legacy"]).toBe(legacy);
    expect(missingTokens(slug, legacy)).toEqual([]);
    expect(missingTokens(legacy, slug)).toEqual([]);
  });
  it("maps every kit token in every mode exactly as the kit gives it", () => {
    const map: Record<string, string> = {
      "surface-page": "--tk-surface-page", "surface-card": "--tk-surface-card", "surface-raised": "--tk-surface-raised", "surface-sunken": "--tk-surface-sunken", "surface-inverse": "--tk-surface-inverse",
      "text-primary": "--tk-text-primary", "text-muted": "--tk-text-muted", "text-inverse": "--tk-text-inverse", rule: "--tk-rule-strong", plate: "--tk-plate-bg", "on-plate": "--tk-plate-fg",
      highlight: "--tk-highlight-bg", positive: "--tk-positive", live: "--tk-live", shadow: "--tk-shadow-ink", "mark-ground": "--tk-mark-ground",
    };
    for (const m of MODES) {
      const v = flatten(slug, m), kit = K.mode[m] as Record<string, string>;
      expect(Object.keys(kit).sort()).toEqual(Object.keys(map).sort());
      for (const [k, tk] of Object.entries(map)) expect(v[tk], `${m}:${k}`).toBe(kit[k]);
      for (const s of ["emerging", "rising", "peaking", "fading", "steady"] as const) { expect(v[`--tk-stage-${s}`]).toBe(K.stage[s].bg); expect(v[`--tk-on-stage-${s}`]).toBe(K.stage[s].fg); }
      for (const g of ["pink", "green", "yellow", "red", "ink"] as const) for (const t of ["light", "base", "dark"] as const) expect(v[`--tk-gumball-${g}-${t}`]).toBe(K.gumball[g][t]);
      expect([v["--tk-slab-bg"], v["--tk-slab-fg"]]).toEqual([K.color.ink, K.color.paper]);
    }
    const sh = flatten(slug, "light");
    expect(Object.values(slug.shared.space)).toEqual(K.space.map(n => `${n}px`));
    expect([sh["--tk-border-hairline"], sh["--tk-border-strong"]]).toEqual([`${K.shape["border-hairline"]}px`, `${K.shape["border-rule"]}px`]);
    expect([sh["--tk-radius-sm"], sh["--tk-radius-sticker"], sh["--tk-radius-icon"]]).toEqual(["0px", "999px", "23%"]);
    expect(sh["--tk-shadow-raised"]).toBe("6px 6px 0 var(--tk-shadow-ink)");
    expect(sh["--tk-shadow-sticker"]).toBe("4px 5px 0 var(--tk-shadow-ink)");
    for (const k of ["tap", "move", "wipe", "arrive", "stagger"] as const) expect(sh[`--tk-motion-${k}`]).toBe(K.motion[k]);
    expect([sh["--tk-motion-ooze"], sh["--tk-motion-cut"], sh["--tk-motion-settle"]]).toEqual([K.motion["ease-ooze"], K.motion["ease-cut"], K.motion["ease-settle"]]);
    for (const d of ["quiet", "steady", "loud"] as const) { expect(sh[`--tk-density-${d}-block`]).toBe(`${K.density[d]["gap-block"]}px`); expect(sh[`--tk-density-${d}-inner`]).toBe(`${K.density[d]["gap-inner"]}px`); }
    expect(sh["--tk-density-quiet-air"]).toBe(`${K.density.quiet["air-above-title"]}px`);
    expect(slug.shared.layout.measure).toBe("62ch");
  });
  it("type roles come from the kit: family, weight, desktop size, leading, case and tracking", () => {
    const fam = { display: "display", text: "text", mono: "mono" } as const;
    const roles = ["display", "h1", "h2", "h3", "kicker", "chip", "deck", "body", "caption", "quote", "figure", "data"] as const;
    for (const m of ["light", "vibes"] as Mode[]) for (const r of roles) {
      const t = slug.modes[m].type[r], k = K.type[r] as { family: keyof typeof fam; weight: number; size: number; leading: number; case?: string; tracking?: string | number; style?: string };
      expect(t.family, r).toBe(fam[k.family]);
      expect(t.weight, r).toBe(String(k.weight));
      expect(t.sizeXl ?? t.sizeMd ?? t.size, r).toBe(`${k.size}px`);
      expect(t.leadingMd ?? t.leading, r).toBe(String(k.leading));
      expect(t.case, r).toBe(k.case === "upper" ? "uppercase" : "none");
      if (k.tracking) expect(t.tracking, r).toBe(String(k.tracking));
      expect(t.style, r).toBe(k.style === "italic" ? "italic" : "normal");
    }
    for (const r of ["display", "h1", "h2", "h3", "h4"] as const) expect(slug.modes.light.type[r].wrap).toBe("balance");
    for (const r of ["deck", "body", "caption", "quote"] as const) expect(slug.modes.light.type[r].wrap).toBe("pretty");
    expect(slug.modes.light.type.figure.numeric).toBe("tabular-nums");
    // The terminal: panel titles Big Shoulders 700 tracked capitals, the headline figure 900, cells and console IBM Plex Mono 13 / 1.5, sentences Newsreader.
    const d = slug.modes.dark.type;
    expect([d.kicker.family, d.kicker.weight, d.kicker.case]).toEqual(["display", "700", "uppercase"]);
    expect([d.display.family, d.display.weight, d.figure.weight]).toEqual(["display", "900", "900"]);
    expect([d.body.family, d.body.size, d.body.leading, d.data.family, d.data.size, d.data.leading]).toEqual(["mono", "13px", "1.5", "mono", "13px", "1.5"]);
    expect([d.deck.family, d.small.family, d.quote.family]).toEqual(["text", "text", "text"]);
    expect(slug.modes.dark.focus.ring).toBe(K.color.yellow);
    expect(slug.modes.dark.selection.bg).toBe(K.color.yellow);
  });
  it("focus is a 3 px ink outline with a yellow offset ring in light mode", () => {
    expect(slug.modes.light.focus).toEqual({ ring: K.color.ink, width: "3px", offset: "3px", halo: K.color.yellow });
    expect(readFileSync("src/styles.css", "utf8")).toMatch(/:focus-visible \{\n\s+outline: var\(--tk-focus-width\) solid var\(--sys-color-focus\);\n\s+outline-offset: var\(--tk-focus-offset\);\n\s+box-shadow: 0 0 0 var\(--tk-focus-offset\) var\(--tk-focus-halo\);/);
  });
});

describe("contrast", () => {
  // Every text-on-surface pair the theme uses, per mode. "large" = display-size type and UI borders (3:1); the rest is text (4.5:1).
  const pairs = (m: Mode) => {
    const t = slug.modes[m], text: [string, string, string][] = [], large: [string, string, string][] = [];
    for (const [sn, s] of Object.entries({ page: t.surface.page, card: t.surface.card, sunken: t.surface.sunken, raised: t.surface.raised })) {
      // Text on the raised surface (yellow in the kit) is the on-accent ink, as .c-raised sets it.
      text.push(sn === "raised" ? [`on-accent on raised`, t.text.onAccent, s] : [`primary on ${sn}`, t.text.primary, s]);
      if (sn !== "raised") { text.push([`muted on ${sn}`, t.text.muted, s]); text.push([`secondary on ${sn}`, t.text.secondary, s]); }
      if (sn !== "raised") large.push([`rule on ${sn}`, t.rule.strong, s]);
    }
    text.push(["inverse on inverse", t.text.inverse, t.surface.inverse], ["on plate", t.plate.fg, t.plate.bg], ["on highlight", t.highlight.fg, t.highlight.bg], ["on slab", t.slab.fg, t.slab.bg], ["selection", t.selection.text, t.selection.bg]);
    for (const i of [1, 2, 3, 4] as const) text.push([`on accent ${i}`, t.onAccent[i], t.accent[i]]);
    for (const s of ["emerging", "rising", "peaking", "fading", "steady"] as const) text.push([`on stage ${s}`, t.onStage[s], t.stage[s]]);
    large.push(["focus ring on page", t.focus.ring, t.surface.page], ["live on slab", t.live, t.slab.bg]);
    // Vibes' pink page cannot carry red (2.0): there the live dot only ever sits on the ink slab, as the shell draws it.
    if (m !== "vibes") large.push(["live on page", t.live, t.surface.page], ["live on card", t.live, t.surface.card]);
    if (m === "dark") {
      // The terminal sets yellow (focus, what moved), green (rising) and red (errors) as text on its ink page and cards.
      text.push(["accent 1 on page", t.accent[1], t.surface.page], ["accent 1 on card", t.accent[1], t.surface.card], ["positive on page", t.positive, t.surface.page], ["positive on card", t.positive, t.surface.card], ["live on page (text)", t.live, t.surface.page]);
    }
    return { text, large };
  };
  for (const m of MODES) it(`${m}: text pairs reach 4.5, large type and borders reach 3`, () => {
    const { text, large } = pairs(m);
    expect(text.filter(([, a, b]) => contrast(a, b) < AA.text).map(([n, a, b]) => `${n} ${contrast(a, b).toFixed(2)}`)).toEqual([]);
    expect(large.filter(([, a, b]) => contrast(a, b) < AA.large).map(([n, a, b]) => `${n} ${contrast(a, b).toFixed(2)}`)).toEqual([]);
  });
  it("red on paper is display-size only: below 4.5, above 3", () => {
    const r = contrast(K.color.red, K.color.paper);
    expect(r).toBeLessThan(AA.text);
    expect(r).toBeGreaterThanOrEqual(AA.large);
  });
});

describe("fonts", () => {
  it("come only from the theme's one font link: Big Shoulders 700/900, Newsreader 400/600/italic, IBM Plex Mono 400/600", () => {
    const f = slug.shared.fonts;
    expect(f.base).toBe(K.font.google);
    expect(f.editorial).toBe(f.base);
    expect(f.base).toContain("family=Big+Shoulders:wght@700;900");
    expect(f.base).toContain("family=IBM+Plex+Mono:wght@400;600");
    expect(f.base).toContain("family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400");
    expect(fontLinks("base")).toEqual(fontLinks("editorial"));
    const hits = walk("src").filter(p => /\.(ts|tsx|css)$/.test(p) && !/\.test\./.test(p) && !p.includes("/theme/") && /fonts\.googleapis\.com\/css2\?family=(Big\+Shoulders|IBM\+Plex|Newsreader|Geist|Bodoni)/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });
  it("no page, component, style or standalone page references the removed faces (Bodoni Moda, Geist Mono)", () => {
    const scope = [...walk("src/components"), ...walk("src/routes"), ...walk("src/lib/theme").filter(p => !p.endsWith("legacy.ts")), "src/styles.css", "src/lib/gate.ts", "src/lib/standalone-page.ts", "src/lib/error-page.ts", "src/lib/embed/embed.ts", "src/lib/data-stories/embed.ts", "src/lib/chart/glyphs.gen.ts", "src/lib/chart/raster.ts"]
      .filter(p => /\.(ts|tsx|css)$/.test(p) && !/\.test\./.test(p));
    expect(scope.filter(p => /Bodoni|Geist/.test(readFileSync(p, "utf8")))).toEqual([]);
  });
  it("the utility face sets only code-like values on Read pages: .ed-code, the data role and the terminal", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const mono = [...css.matchAll(/([^{}]+)\{([^{}]*var\(--sys-font-mono\)[^{}]*)\}/g)].map(m => m[1]!.trim().split("\n").pop()!.trim());
    // Tailwind's font-mono utility, code-like values, and printed addresses (link URLs, the sheet foot and the footnote list).
    expect(mono.sort()).toEqual([".digest .ed-code, .tk-code", ".digest .print-foot", ".digest .print-notes", ".digest a[data-print]::after", "@theme inline"]);
    expect(css).not.toMatch(/\.ed-(h1|h2|h3|h4|cover|mast|kicker|standfirst|navtext)[^{]*\{[^}]*--(tk|sys)-font-mono/);
  });
});
