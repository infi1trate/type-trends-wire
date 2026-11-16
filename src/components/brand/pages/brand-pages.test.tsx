import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderInRouter } from "@/test/router-harness";
import { BrandColour, BrandMark, BrandMotion, BrandSpace, BrandType, BrandContainers, BrandDownloads, BrandOverview } from "./BrandPages";
import { BRAND_KIT as K, activeTheme } from "@/lib/theme";
import { ratioText } from "@/lib/theme/contrast";
import { BRAND_PAGES, KIT_FILE_RE } from "@/lib/brand-pages";
import { SURFACES, readSectionOf } from "@/lib/ia";
import { kitFile, kitFiles } from "@/lib/brand-files.server";
import { kitFilesQuery, kitQuery } from "@/lib/data";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const text = (el: Element | null) => el?.textContent ?? "";

describe("brand pages: registration", () => {
  it("every brand page is a route file registered under Tools, with its own title", () => {
    for (const p of BRAND_PAGES) {
      const key = p.slug ? `brand.${p.slug}` : "brand.index";
      expect(SURFACES[key], key).toMatchObject({ section: "tools", mode: "read" });
      expect(readSectionOf(p.path)).toBe("tools");
      const src = readFileSync(`src/routes/${key}.tsx`, "utf8");
      expect(src).toContain(`createFileRoute("${p.path === "/brand" ? "/brand/" : p.path}")`);
      expect(src).toContain(`const TITLE = \`${p.title} — the slug brand`);
      expect(src).toContain('"noindex, nofollow"');
    }
    expect(SURFACES["brand.files.$file"]).toMatchObject({ section: "tools" });
    expect(readFileSync("src/components/read/ToolsViews.tsx", "utf8")).toContain('to="/brand"');
    expect(readFileSync("src/components/kit/KitView.tsx", "utf8")).toContain('to="/brand"');
  });
});

describe("brand pages: values equal the tokens", () => {
  it("colour: every role's hex and job, and the contrast figures, come from the kit", async () => {
    const { container } = await renderInRouter(() => <BrandColour />, "/brand/colour");
    const roles = K.role as Record<string, string>, C = K.color as Record<string, string>;
    for (const id of ["paper", "ink", "white", "pink", "green", "yellow", "red", "newsprint", "muted"]) {
      const row = container.querySelector(`[data-role="${id}"]`);
      expect(text(row), id).toContain(C[id]);
      expect(text(row), id).toContain(roles[id]);
    }
    for (const id of ["paper", "white", "pink", "yellow", "green", "red"]) expect(text(container.querySelector(`[data-contrast="${id}"] .ed-figure-num`))).toBe(ratioText(K.color.ink, C[id]!));
    expect(text(container.querySelector('[data-contrast="paper"] .ed-figure-num'))).toBe("16.8");
    for (const s of ["emerging", "rising", "peaking", "fading", "steady"] as const) expect(text(container.querySelector(`[data-stage-swatch="${s}"]`))).toContain(K.stage[s].bg);
    expect(container.querySelectorAll("[data-mode-sample]").length).toBe(3);
  });
  it("type: each role's size, leading and tracking are the kit's", async () => {
    const story = { id: "a", type: "move", kicker: "Move", headline: "Neon changed its hero", deck: "Hero changed from image to video.", at: "2026-11-16T12:00:00Z", signalKeys: [], domains: [], evidence: "/stories/a", basis: "measured" };
    const { container } = await renderInRouter(() => <BrandType />, "/brand/type", qc => qc.setQueryData(kitQuery().queryKey, { stories: [story], signals: [{ key: "combo:big_type", name: "Big type", share: 0.257 }] } as never));
    for (const r of ["display", "h1", "h2", "h3", "kicker", "chip", "deck", "body", "quote", "figure", "caption", "data"] as const) {
      const li = container.querySelector(`[data-role="${r}"]`)!, k = K.type[r] as { size: number; leading: number; tracking?: string | number };
      expect(text(li.querySelector("[data-size]")), r).toBe(String(k.size));
      expect(text(li.querySelector("[data-leading]")), r).toBe(String(k.leading));
      if (k.tracking) expect(text(li.querySelector("[data-tracking]")), r).toBe(String(k.tracking));
    }
    expect(text(container.querySelector('[data-role="h1"]'))).toContain("Neon changed its hero");
  });
  it("mark: the three cuts render at their sizes and the right cut; six not-this cases", async () => {
    const { container } = await renderInRouter(() => <BrandMark />, "/brand/mark");
    for (const cut of ["display", "standard", "micro"]) expect(container.querySelector(`[data-cut-demo="${cut}"] [data-wordmark]`)?.getAttribute("data-cut")).toBe(cut);
    expect(container.querySelectorAll("[data-dont]").length).toBe(6);
    expect(container.querySelectorAll("[data-tile]").length).toBe(4);
  });
  it("space and motion: the scale, the densities and the timings are the kit's", async () => {
    const s = await renderInRouter(() => <BrandSpace />, "/brand/space");
    expect([...s.container.querySelectorAll("[data-scale] .ed-stat")].map(text)).toEqual(K.space.map(String));
    expect(text(s.container.querySelector('[data-density-demo="quiet"]'))).toContain(String(K.density.quiet["air-above-title"]));
    s.unmount();
    const m = await renderInRouter(() => <BrandMotion />, "/brand/motion");
    for (const k of ["tap", "move", "wipe", "arrive", "stagger"] as const) expect(text(m.container.querySelector(`[data-motion="${k}"]`))).toBe(K.motion[k]);
    expect(m.container.querySelectorAll("[data-pattern]").length).toBe(5);
    expect(m.container.querySelectorAll('[data-slot="part-2"]').length).toBe(5);
  });
  it("containers: the eight, and at most one Plate outside specimen frames on the overview", async () => {
    const c = await renderInRouter(() => <BrandContainers />, "/brand/containers");
    expect(c.container.querySelectorAll("[data-container-demo]").length).toBe(8);
    c.unmount();
    const o = await renderInRouter(() => <BrandOverview />, "/brand");
    expect(o.container.querySelectorAll('[data-container="plate"]').length).toBeLessThanOrEqual(1);
  });
});

describe("brand downloads", () => {
  it("lists every kit file with its real size, served through the gated file route", async () => {
    const files = walk("brand").filter(p => !p.endsWith(".DS_Store"));
    const list = await kitFiles();
    expect(list.map(f => f.name).sort()).toEqual(files.map(p => p.split("/").pop()!).sort());
    for (const f of list) {
      const path = files.find(p => p.endsWith(`/${f.name}`))!;
      expect(f.bytes, f.name).toBe(statSync(path).size);
      expect(f.href).toBe(`/brand/files/${f.name}`);
      expect(f.what.length).toBeGreaterThan(10);
    }
  });
  it("serves kit files byte for byte and refuses anything else", async () => {
    for (const n of ["README.md", "slug-app-icon-1024.png", "slug-wordmark-display.svg", "slug.tokens.json"]) {
      const path = walk("brand").find(p => p.endsWith(`/${n}`))!;
      const f = await kitFile(n);
      expect(Buffer.from(f!.body).equals(readFileSync(path)), n).toBe(true);
    }
    for (const bad of ["../package.json", "..%2Fsecrets", "nope.svg", "slug.tokens.json/../x", ".env"]) expect(await kitFile(bad), bad).toBeNull();
    expect(KIT_FILE_RE.test("../x.svg")).toBe(false);
  });
  it("the downloads page renders each file as a plain download link with its size", async () => {
    const list = await kitFiles();
    const { container } = await renderInRouter(() => <BrandDownloads />, "/brand/downloads", qc => qc.setQueryData(kitFilesQuery().queryKey, list));
    const links = [...container.querySelectorAll("a.ledger-link")];
    expect(links.length).toBe(list.length);
    expect(links.every(a => a.getAttribute("href")!.startsWith("/brand/files/"))).toBe(true);
  });
  it("nothing from brand/ is copied into public/ except the favicon (the one existing open path)", () => {
    expect(walk("public").map(p => p.replace(/^public\//, "")).sort()).toEqual(["favicon.svg", "site.webmanifest"]);
    expect(activeTheme.name).toBe("slug");
  });
});
