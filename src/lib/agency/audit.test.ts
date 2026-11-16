// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AUDIT_MAX, auditModel, auditPath, parseAuditSites } from "./audit";
import { auditFixture, f } from "./test-fixtures";

describe("audit sites parsing", () => {
  it("needs 2–6 domains, normalizes and sorts them", () => {
    expect(parseAuditSites("https://www.vercel.com/, linear.app")).toEqual({ ok: true, domains: ["linear.app", "vercel.com"] });
    expect(parseAuditSites("linear.app")).toMatchObject({ ok: false, error: "An audit needs at least 2 sites." });
    expect(parseAuditSites(Array.from({ length: 7 }, (_, i) => `s${i}.com`))).toMatchObject({ ok: false, error: `An audit compares at most ${AUDIT_MAX} sites.` });
    expect(parseAuditSites("a.com,not a domain")).toMatchObject({ ok: false });
    expect(auditPath(["a.com", "b.com"], "fintech")).toBe("/audit?sites=a.com,b.com&sector=fintech");
  });
});

describe("auditModel", () => {
  const a = auditModel(auditFixture());
  it("picks the set's most common sector and lists every section with data", () => {
    expect(a.sector).toBe("dev-tools");
    expect(a.sectorSource).toBe("majority");
    expect(a.sections).toEqual(["glance", "type", "color", "layout", "vibe", "market", "moves", "whitespace", "method"]);
    expect(a.url).toBe("https://slug.global/audit?sites=linear.app,newco.io,supabase.com,vercel.com");
  });
  it("flags untracked domains as pending and leaves them out of comparisons", () => {
    expect(a.pending).toEqual(["newco.io"]);
    expect(a.glance.find(g => g.domain === "newco.io")!.status).toBe("pending");
    expect(a.type!.sites.map(s => s.domain)).not.toContain("newco.io");
  });
  it("type: Google faces flagged, shared faces found", () => {
    const l = a.type!.sites.find(s => s.domain === "linear.app")!;
    expect(l.h1).toMatchObject({ family: "Inter", google: true, size: 64, style: "sans", case: "as written" });
    expect(a.type!.sites.find(s => s.domain === "vercel.com")!.h1!.google).toBe(false);
    expect(a.type!.shared).toEqual([{ family: "Inter", google: true, domains: ["linear.app", "supabase.com"] }]);
  });
  it("color: readable names, themes and overlap", () => {
    expect(a.color!.themes).toBe("2 dark, 1 light");
    expect(a.color!.sites[0]!.accent!.hex).toBe("#5E6AD2");
    expect(a.color!.sites[0]!.accent!.name).not.toMatch(/^#/);
    expect(a.color!.overlap.some(o => o.domains.includes("linear.app") && o.domains.includes("supabase.com"))).toBe(true);
  });
  it("component matrix: sites × components, null where no confident AI read", () => {
    const m = a.layout!.components!;
    expect(m.domains).toEqual(["linear.app", "newco.io", "supabase.com", "vercel.com"]);
    expect(m.rows.map(r => [r.trait, r.cells, r.count])).toEqual([
      ["components:logo_wall", [true, null, null, true], 2],
      ["components:bento_grid", [true, null, null, false], 1],
    ]);
    expect(a.layout!.css!.rows.find(r => r.trait === "css:has")!.cells).toEqual([true, null, false, true]);
  });
  it("versus the market: ahead = Rising/Emerging in own sector, behind = Fading still used", () => {
    const l = a.market!.sites.find(s => s.domain === "linear.app")!;
    expect(l.ahead.map(t => t.trait)).toEqual(["css:has", "css:container-queries"]);
    expect(l.behind.map(t => t.trait)).toEqual(["theme:dark"]);
    expect(l.sentence).toBe("linear.app already shows 2 signals that are rising or emerging in dev-tools: Has, Container queries. It still uses 1 fading signal: Dark mode.");
    for (const t of l.ahead) expect(t.explainer).toMatch(/^\/signals\//);
  });
  it("white space: rising in the main sector, used by none, strongest momentum first", () => {
    expect(a.whitespace!.traits.map(t => t.trait)).toEqual(["components:pricing_table", "css:subgrid", "headline:serif"]);
    expect(a.whitespace!.scope).toBe("dev-tools");
  });
  it("recent moves: last 90 days only", () => {
    expect(a.moves!.sites).toEqual([{ domain: "vercel.com", items: [expect.objectContaining({ at: "2026-10-01T00:00:00Z" })] }]);
  });
  it("omits sections without data", () => {
    const r = auditFixture();
    const bare = auditModel({ ...r, sites: r.sites.map(s => ({ ...s, status: "pending" as const, site: null, signals: null, history: null })), events: [] });
    expect(bare.sections).toEqual(["glance", "method"]);
    expect([bare.type, bare.color, bare.layout, bare.vibe, bare.market, bare.moves, bare.whitespace]).toEqual([null, null, null, null, null, null, null]);
    const noAi = auditModel({ ...r, sites: r.sites.map(s => ({ ...s, history: s.history ? { ...s.history, ai_tags: null } : null })) });
    expect(noAi.vibe).toBeNull();
    expect(noAi.layout!.components).toBeNull();
    expect(noAi.whitespace!.traits.map(t => t.trait)).not.toContain("components:pricing_table");
  });
  it("a chosen sector overrides the majority", () => {
    expect(auditModel({ ...auditFixture(), sector: "fintech", forecasts: [...auditFixture().forecasts, f("css", "subgrid", "fintech", "accelerating")] })).toMatchObject({ sector: "fintech", sectorSource: "chosen" });
  });
  it("no $ tickers anywhere", () => {
    expect(JSON.stringify(a)).not.toMatch(/\$[A-Z]/);
  });
});
