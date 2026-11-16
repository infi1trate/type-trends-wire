import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LEGACY_PANELS, KEY_MAP, SECTIONS, SURFACES, TABS, keyView, legacyTerminalSearch, resolveKey, resolveView, sectionOf, stepTab, surfaceOf, toggleHref, whereThingsLive } from "./ia";

const ROUTES = join(__dirname, "..", "routes");
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const routeKeys = walk(ROUTES).filter(p => /\.(tsx?)$/.test(p) && !p.endsWith("__root.tsx")).map(p => relative(ROUTES, p).replace(/\.(tsx?)$/, ""));

describe("IA registry", () => {
  it("has exactly six sections with F1–F6", () => {
    expect(SECTIONS.map(s => [s.label, s.key, s.read])).toEqual([["Live", "F1", "/"], ["Signals", "F2", "/signals"], ["Brands", "F3", "/brands"], ["Patterns", "F4", "/patterns"], ["Digest", "F5", "/digest"], ["Tools", "F6", "/tools"]]);
  });
  it("every route file is in SURFACES (no orphans)", () => {
    expect(routeKeys.length).toBeGreaterThan(40);
    expect(routeKeys.filter(k => !surfaceOf(k))).toEqual([]);
  });
  it("every old panel id and every terminal tab is in SURFACES", () => {
    expect(LEGACY_PANELS.map(p => `panel:${p.id}`).filter(k => !SURFACES[k])).toEqual([]);
    expect(TABS.map(t => `panel:${t.id}`).filter(k => !SURFACES[k])).toEqual([]);
  });
  it("every surface points at a section that exists", () => {
    const ids = new Set(SECTIONS.map(s => s.id));
    expect(Object.entries(SURFACES).filter(([, v]) => !ids.has(v.section)).map(([k]) => k)).toEqual([]);
  });
  it("status and model card are quiet; Where things live lists them under Tools", () => {
    expect(SURFACES["status"]).toMatchObject({ section: "tools", status: "quiet" });
    expect(whereThingsLive().find(s => s.id === "tools")!.quiet.map(q => q.key)).toContain("status");
  });
});

describe("keys and aliases", () => {
  it("F1–F6 (and 1–6) open the six sections", () => {
    expect(["F1", "F2", "F3", "F4", "F5", "F6"].map(k => keyView(resolveKey(k)))).toEqual(["today", "overview", "library", "patterns", "digest", "watch"]);
    expect(["1", "2", "3", "4", "5", "6"].map(k => keyView(resolveKey(k)))).toEqual(["today", "overview", "library", "patterns", "digest", "watch"]);
  });
  it("old keys alias to where their panel now lives", () => {
    const m = Object.fromEntries(["T", "F7", "F8", "F9", "F10", "F11", "F12", "W", "D"].map(k => [k, keyView(resolveKey(k))]));
    expect(m).toEqual({ T: "today", F7: "vibe", F8: "wire", F9: "rebrands", F10: "brief", F11: "library", F12: "history", W: "watch", D: "digest" });
    expect(resolveKey("t")?.key).toBe("T");
  });
  it("every old panel id resolves to a view in the section it now belongs to", () => {
    const where: Record<string, string> = { today: "live", overview: "signals", type: "signals", color: "signals", layout: "signals", composition: "signals", lexicon: "signals", vibe: "signals", wire: "live", rebrands: "brands", brief: "signals", library: "brands", history: "brands", watch: "tools" };
    for (const p of LEGACY_PANELS) expect([p.id, sectionOf(resolveView(p.id))]).toEqual([p.id, where[p.id]]);
    expect(resolveView("ticker")).toBe("overview");
    expect(resolveView("nonsense")).toBe("today");
  });
  it("actions: backtick, ?, /, [ ], arrows", () => {
    expect(["`", "?", "/", "[", "]", "ArrowLeft", "ArrowRight", "Escape"].map(k => { const t = resolveKey(k)?.target; return t && "action" in t ? t.action : null; }))
      .toEqual(["mode", "glossary", "console", "prev-tab", "next-tab", "prev-tab", "next-tab", "close"]);
    expect(KEY_MAP.filter(k => k.alias).length).toBe(9);
  });
  it("tabs step within a section and wrap", () => {
    expect(stepTab("overview", 1)).toBe("type");
    expect(stepTab("overview", -1)).toBe("brief");
    expect(stepTab("composition", 1)).toBe("lexicon");
    expect(stepTab("wire", 1)).toBe("today");
  });
});

describe("old terminal URLs → /terminal", () => {
  it("panel links keep every param and resolve aliases", () => {
    expect(legacyTerminalSearch({ panel: "brief", trait: "css:subgrid", sector: "fintech", alert: "13-breakout" })).toEqual({ panel: "brief", trait: "css:subgrid", sector: "fintech" });
    expect(legacyTerminalSearch({ panel: "ticker" })).toEqual({ panel: "overview" });
    expect(legacyTerminalSearch({ panel: "library", q: "linear", sort: "sector", desc: true, page: 2 })).toEqual({ panel: "library", q: "linear", sort: "sector", desc: true, page: 2 });
    expect(legacyTerminalSearch({ trait: "css:has" })).toEqual({ panel: "today", trait: "css:has" });
  });
  it("plain / and the Live-only params stay on Live", () => {
    expect(legacyTerminalSearch({})).toBeNull();
    expect(legacyTerminalSearch({ sector: "fintech", page: 1 })).toBeNull();
  });
});

describe("mode toggle maps object ↔ object", () => {
  it("Read → Terminal", () => {
    expect(toggleHref("/")).toBe("/terminal?panel=today");
    expect(toggleHref("/signals/css%3Asubgrid")).toBe("/terminal?panel=brief&trait=css%3Asubgrid");
    expect(toggleHref("/brands/linear.app", { sector: "dev-tools" })).toBe("/library/linear.app");
    expect(toggleHref("/brands", { tab: "moves" })).toBe("/terminal?panel=rebrands");
    expect(toggleHref("/patterns/css%3Asubgrid")).toBe("/terminal?panel=patterns&trait=css%3Asubgrid");
    expect(toggleHref("/signals", { sector: "fintech" })).toBe("/terminal?panel=overview&sector=fintech");
    expect(toggleHref("/tools")).toBe("/terminal?panel=watch");
  });
  it("Terminal → Read", () => {
    expect(toggleHref("/terminal", { panel: "brief", trait: "css:subgrid" })).toBe("/signals/css%3Asubgrid");
    expect(toggleHref("/library/linear.app")).toBe("/brands/linear.app");
    expect(toggleHref("/terminal", { panel: "type", sector: "fintech" })).toBe("/signals?sector=fintech");
    expect(toggleHref("/terminal", { panel: "rebrands" })).toBe("/brands?tab=moves");
    expect(toggleHref("/terminal", { panel: "today", sector: "all" })).toBe("/");
  });
  it("round trip lands on the same object", () => {
    const sig = toggleHref("/signals/css%3Asubgrid"), u = new URL(sig, "http://x");
    expect(toggleHref(u.pathname, Object.fromEntries(u.searchParams))).toBe("/signals/css%3Asubgrid");
  });
});
