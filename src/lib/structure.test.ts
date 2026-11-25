import { describe, expect, it } from "vitest";
import { nearestRead, undouble, buildSeries, deriveRecord, desktopPhone, flagsOf, normLabel, pickRows, quarterBack, shareOf, STRUCTURE_FLOOR, STRUCTURE_SIGNALS, structureSummary, toRow, topLabels, type StructureInput } from "./structure";

const nav = (labels: string[], deep = false) => [...labels.map(label => ({ label, href: "/", depth: 1, visible: true })), ...(deep ? [{ label: "Sub", href: "/s", depth: 2, visible: false }] : [])];
const base: StructureInput = { id: 1, domain: "acme.com", viewport: "desktop", source: "live", captured_at: "2026-11-20T00:00:00Z" };
const structure = { v: 1, vw: 1440, vh: 900, screens: 7.6, sections: [{ r: "hero", y: 0, h: 600 }, { r: "logos", y: 600, h: 200 }, { r: "pricing", y: 800, h: 400 }, { r: "footer", y: 1200, h: 300 }], asks: [{ l: "Book a demo", k: "demo", p: 1, n: 0 }, { l: "Start for free", k: "start", p: 0, n: 0 }, { l: "Docs", k: "learn", p: 0, n: 1 }], furniture: { search: 1, chat: "intercom", login: "Log in", bar: "New today" } };

describe("navigation (history fields)", () => {
  it("normalises labels: lowercase, & → and, doubled labels once", () => {
    expect(normLabel("  Tools & APIs ")).toBe("tools and apis");
    expect(normLabel("Sign in Sign in")).toBe("sign in");
    expect(undouble("Sign in Sign in")).toBe("Sign in");
  });
  it("reads top-level visible depth-1 items, drops logo links", () => {
    expect(topLabels(nav(["Acme homepage", "Solutions", "Pricing"]))).toEqual(["solutions", "pricing"]);
  });
  it("fewer than two top-level items is not read (null), never zero", () => {
    const r = deriveRecord({ ...base, nav: nav(["Navigate to home"]) });
    expect(r.nav_items).toBeNull();
    expect(flagsOf(r, "desktop")["nav:says_solutions"]).toBeNull();
  });
  it("lead words, depth, long and sign-in wording", () => {
    const r = deriveRecord({ ...base, nav: nav(["Solutions", "Products", "AI agents", "Pricing", "Docs", "Customers", "Blog", "Log in"], true) });
    const f = flagsOf(r, "desktop");
    expect(f["nav:says_solutions"]).toBe(true); expect(f["nav:says_products"]).toBe(true); expect(f["nav:has_ai"]).toBe(true);
    expect(f["nav:deep"]).toBe(true); expect(f["nav:long"]).toBe(true); expect(f["nav:signin_wording_login"]).toBe(true); expect(f["nav:signin_wording_signin"]).toBe(false);
    expect(f["navword:pricing"]).toBe(true); expect(f["navword:about"]).toBe(false);
  });
  it("page length in screens from page.h / 900, buttons on the first screen", () => {
    const r = deriveRecord({ ...base, page: { w: 1440, h: 9000 }, skeleton: [{ kind: "control", y: 100 }, { kind: "control", y: 1200 }, { kind: "section", y: 0 }] });
    expect(r.screens).toBe(10); expect(r.first_buttons).toBe(1); expect(r.bands).toBe(1);
    expect(flagsOf(r, "desktop")["page:long"]).toBe(true);
  });
});

describe("structure key", () => {
  it("a missing structure key leaves every new reading null, not false", () => {
    const f = flagsOf(deriveRecord({ ...base, page: { w: 1440, h: 3000 } }), "desktop");
    for (const s of STRUCTURE_SIGNALS.filter(s => s.source === "new" && s.viewports.includes("desktop"))) expect(f[s.key]).toBeNull();
  });
  it("roles, positions, primary ask and furniture", () => {
    const r = deriveRecord({ ...base, structure });
    expect(r.roles).toEqual(["hero", "logos", "pricing", "footer"]);
    expect(r.positions?.pricing).toBe(0.53);
    expect(r.primary_ask).toBe("demo"); expect(r.asks_n).toBe(3); expect(r.start_and_demo).toBe(true);
    const f = flagsOf(r, "desktop");
    expect(f["ask:demo"]).toBe(true); expect(f["ask:start"]).toBe(false); expect(f["ask:three_plus"]).toBe(true);
    expect(f["furn:search"]).toBe(true); expect(f["furn:cmdk"]).toBe(false); expect(f["furn:announcement_bar"]).toBe(true);
    expect(f["page:has_logos"]).toBe(true); expect(f["page:has_faq"]).toBe(false);
    expect(r.signin).toBe("log in");
  });
  it("phone fields only on phone captures", () => {
    const m = { ...structure, mobile: { nav: "drawer+bar", tap_small: 45, body_px: 15, sticky: "Start", store_first: 1, overflow_x: 0 } };
    const p = flagsOf(deriveRecord({ ...base, viewport: "mobile", structure: m }), "mobile");
    expect(p["phone:drawer"]).toBe(true); expect(p["phone:bottom_bar"]).toBe(true); expect(p["phone:small_taps"]).toBe(true);
    expect(p["phone:small_text"]).toBe(true); expect(p["phone:app_push"]).toBe(true); expect(p["phone:sideways_scroll"]).toBe(false);
    expect(flagsOf(deriveRecord({ ...base, structure: m }), "desktop")["phone:drawer"]).toBeUndefined();
  });
  it("summary for JSON and MCP", () => {
    expect(structureSummary(deriveRecord({ ...base, structure }))).toMatchObject({ read: true, primary_ask: "demo", furniture: ["search", "chat", "login", "bar"], phone_nav: null });
  });
});

describe("quarters and counts", () => {
  it("a capture with the structure key beats a newer one without; live beats archived", () => {
    const a = toRow({ ...base, id: 1, structure, captured_at: "2026-10-02T00:00:00Z" }), b = toRow({ ...base, id: 2, captured_at: "2026-11-02T00:00:00Z" });
    expect(pickRows([a, b])[0]!.snapshot_id).toBe(1);
    const w = toRow({ ...base, id: 3, source: "wayback", captured_at: "2026-11-03T00:00:00Z" });
    expect(pickRows([b, w])[0]!.snapshot_id).toBe(2);
  });
  it(`a share needs ${STRUCTURE_FLOOR} brands read`, () => {
    expect(shareOf({ n_read: 14, n_yes: 14 })).toBeNull();
    expect(shareOf({ n_read: 15, n_yes: 3 })).toBe(0.2);
    expect(desktopPhone({ n_read: 20, n_yes: 10 }, { n_read: 3, n_yes: 1 }).line).toBe("Desktop 50% · Phone too few read");
  });
  it("not-read rows are not counted", () => {
    const rows = [toRow({ ...base, structure }), toRow({ ...base, domain: "b.com" })];
    const s = buildSeries(rows, new Map([["acme.com", { sector: "ai", category: "x" }]]), "2026Q4");
    const faq = s.find(x => x.signal === "page:has_faq" && x.scope === "all");
    expect(faq).toMatchObject({ n_read: 1, n_yes: 0 });
    expect(s.some(x => x.scope === "ai")).toBe(true);
  });
  it("quarter arithmetic", () => { expect(quarterBack("2026Q4", 20)).toBe("2021Q4"); expect(quarterBack("2026Q1", 1)).toBe("2025Q4"); });
});

describe("then quarters", () => {
  it("uses the nearest well-read quarter within two of the target", () => {
    const row = (quarter: string, n_read: number) => ({ signal: "navword:pricing", viewport: "desktop" as const, scope: "all", quarter, n_read, n_yes: 1 });
    const rows = [row("2021Q3", 147), row("2021Q4", 11), row("2022Q1", 152)];
    expect(nearestRead(rows, "navword:pricing", "desktop", "2021Q4")?.quarter).toBe("2021Q3");
    expect(nearestRead([row("2021Q4", 11)], "navword:pricing", "desktop", "2021Q4")).toBeNull();
  });
});

describe("desk and health lines", () => {
  it("the data desk's weekly structure line", async () => {
    const { structureDeskLine } = await import("./structure");
    expect(structureDeskLine({ desktop: 283, phone: 279, fresh_desktop: 280, fresh_phone: 270, passing: 30, total: 36, changes: [{ signal: "page:long", from: 0.29, to: 0.37 }] }))
      .toBe("Structure: 283 brands read on desktop, 279 on a phone; 30 of 36 structure signals pass the 15-brand floor; changed most over four quarters: A long homepage 29% → 37%.");
  });
  it("the health line counts brands read in the last 14 days", async () => {
    const { structureHealthLine } = await import("./structure");
    expect(structureHealthLine({ fresh_desktop: 283, fresh_phone: 0 })).toBe("structure read in the last 14 days: 283 brands on desktop, 0 on a phone");
  });
  it("biggest changes need both ends past the floor", async () => {
    const { biggestChanges } = await import("./structure");
    const row = (signal: string, quarter: string, n_read: number, n_yes: number) => ({ signal, viewport: "desktop" as const, scope: "all", quarter, n_read, n_yes });
    const out = biggestChanges([row("page:long", "2025Q4", 20, 4), row("page:long", "2026Q4", 20, 10), row("nav:deep", "2025Q4", 10, 1), row("nav:deep", "2026Q4", 20, 20)], "2026Q4");
    expect(out.map(x => x.signal)).toEqual(["page:long"]);
  });
});
