import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LEGACY_PANELS, KEY_MAP, READ_BAR, MORE_MENU, readKeyHref, SECTIONS, SURFACES, TABS, keyView, legacyTerminalSearch, resolveKey, resolveView, sectionOf, stepTab, surfaceOf, toggleHref, whereThingsLive } from "./ia";

const ROUTES = join(__dirname, "..", "routes");
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const routeKeys = walk(ROUTES).filter(p => /\.(tsx?)$/.test(p) && !p.endsWith("__root.tsx")).map(p => relative(ROUTES, p).replace(/\.(tsx?)$/, ""));

describe("IA registry", () => {
  it("has exactly seven sections with F1–F7 (U3: Studies joins, Tools moves to F7)", () => {
    expect(SECTIONS.map(s => [s.label, s.key, s.read])).toEqual([["Today", "F1", "/"], ["Signals", "F2", "/signals"], ["Brands", "F3", "/brands"], ["Patterns", "F4", "/patterns"], ["Studies", "F5", "/data"], ["Digest", "F6", "/digest"], ["Tools", "F7", "/tools"]]);
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
  it("F1–F7 (and 1–7) open the seven sections", () => {
    expect(["F1", "F2", "F3", "F4", "F5", "F6", "F7"].map(k => keyView(resolveKey(k)))).toEqual(["today", "overview", "library", "patterns", "studies", "digest", "watch"]);
    expect(["1", "2", "3", "4", "5", "6", "7"].map(k => keyView(resolveKey(k)))).toEqual(["today", "overview", "library", "patterns", "studies", "digest", "watch"]);
  });
  it("old keys alias to where their panel now lives", () => {
    // U3: F7 is Tools now, so the old F7 (Vibe map) alias gave way; the rest keep working.
    const m = Object.fromEntries(["T", "F8", "F9", "F10", "F11", "F12", "W", "D"].map(k => [k, keyView(resolveKey(k))]));
    expect(m).toEqual({ T: "today", F8: "wire", F9: "rebrands", F10: "brief", F11: "library", F12: "history", W: "watch", D: "digest" });
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
    expect(KEY_MAP.filter(k => k.alias).length).toBe(8);
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
    expect(toggleHref("/signals/css%3Asubgrid")).toBe("/signals/css%3Asubgrid?view=data");
    expect(toggleHref("/brands/linear.app", { sector: "dev-tools" })).toBe("/brands/linear.app?sector=dev-tools&view=data");
    expect(toggleHref("/brands", { tab: "moves" })).toBe("/terminal?panel=rebrands");
    expect(toggleHref("/patterns/css%3Asubgrid")).toBe("/patterns/css%3Asubgrid?view=data");
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

describe("U3 · one navigation in both modes", () => {
  const ORDER = ["Today", "Signals", "Brands", "Patterns", "Studies", "Digest", "Tools"];
  it("the Read bar and the terminal list the same seven sections in the same order", () => {
    expect(READ_BAR.map(b => b.label)).toEqual(ORDER);
    expect(SECTIONS.map(s => s.label)).toEqual(ORDER);
    expect(KEY_MAP.filter(k => /^F[1-7]$/.test(k.key)).map(k => k.label)).toEqual(ORDER);
  });
  it("Tools sits in the bar from 1024 px and under More below that", () => {
    expect(READ_BAR.find(b => b.id === "tools")).toMatchObject({ wide: true });
    expect(MORE_MENU.find(m => m.id === "tools")).toMatchObject({ narrow: true, href: "/tools" });
  });
  it("Studies has a terminal tab whose Data-side home is the studies list", () => {
    expect(TABS.filter(t => t.section === "studies").map(t => t.id)).toEqual(["studies"]);
    expect(keyView(resolveKey("F5"))).toBe("studies");
  });
  it("Read keys: 1–7 open the seven Read addresses; / goes to the page's search, else the brand directory; others do nothing", () => {
    expect(["1", "2", "3", "4", "5", "6", "7"].map(k => readKeyHref(k, false))).toEqual(["/", "/signals", "/brands", "/patterns", "/data", "/digest", "/tools"]);
    expect(readKeyHref("/", true)).toBe("focus-search");
    expect(readKeyHref("/", false)).toBe("/brands");
    expect(readKeyHref("8", false)).toBeNull();
    expect(readKeyHref("x", false)).toBeNull();
  });
});
