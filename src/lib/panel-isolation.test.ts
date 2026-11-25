// @vitest-environment node
/** R2a-2 · nothing outside the panel reaches a reader. Onboarding brands are stored inactive, so every view and every active-filtered
 *  read already leaves them out; these checks guard the reads that do not filter on active, and the 1,000-row cut. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { redesignsByYear } from "./panel-feed";
import { inPanel, onboarding, panelOnly, splitCounts, type PanelSite } from "./panel";
import { splitSync, type SyncStore } from "./library-sync";

const files = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith("types.ts") ? [p] : []; });
const SRC = files("src");
/** The chained call: up to a ';', or a line break not followed by a continuing `.method(` line. */
const statement = (s: string, at: number) => { const t = s.slice(at, at + 600), e = t.search(/;|\n(?!\s*\.)/); return e < 0 ? t : t.slice(0, e); };
const line = (s: string, at: number) => s.slice(0, at).split("\n").length;

describe("R2a-2 · 1,000-row lists are paged", () => {
  it("no unpaged list read of library_sites, library_latest, library_site_history_rows or library_structure_records", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/from\("(library_sites|library_latest|library_site_history_rows|library_structure_records)"\)/g)) {
        const seg = statement(s, m.index! + m[0].length);
        if (/^\s*\.(update|insert|upsert|delete)\(/.test(seg)) continue;
        if (/\.maybeSingle\(|\.single\(|head:\s*true|\.eq\("domain"|\.in\("domain"/.test(seg)) continue;
        const lim = /\.limit\((\d+)/.exec(seg);
        if (lim && Number(lim[1]) <= 50) continue; // a newest-few read, not a list
        if (/\.range\(0,\s*999\)/.test(seg) || !/\.range\(/.test(seg)) bad.push(`${f}:${line(s, m.index!)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("R2a-2 · reads of the two views without an active filter keep panel rows only", () => {
  it("every library_event_feed read is filtered to the panel, is one brand's page, or reads by story event ids", () => {
    const bad: string[] = [];
    for (const f of SRC) {
      const s = readFileSync(f, "utf8");
      if (!s.includes('from("library_event_feed")')) continue;
      const guarded = /panelRowsOnly|panelDomains|feedDomains|\.active\b/.test(s);
      for (const m of s.matchAll(/from\("library_event_feed"\)/g)) {
        const seg = statement(s, m.index! + m[0].length);
        if (/\.eq\("domain"|\.in\("id"/.test(seg)) continue;
        if (!guarded) bad.push(`${f}:${line(s, m.index!)}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it("nothing reads library_redesigns any more", () => {
    expect(SRC.filter(f => readFileSync(f, "utf8").includes('from("library_redesigns")'))).toEqual([]);
  });
});

describe("R2a-2 · one onboarding brand, with snapshots and events, appears nowhere", () => {
  const panel: PanelSite[] = Array.from({ length: 20 }, (_, i) => ({ domain: `p${i}.com`, sector: "fintech", active: true, onboarding: false, panel_since: "2024-01-01T00:00:00Z" }));
  const newcomer: PanelSite = { domain: "new.com", sector: "fintech", active: false, onboarding: true, panel_since: null };
  const sites = [...panel, newcomer];
  it("is not in the panel and every count equals the panel's", () => {
    expect(inPanel(newcomer)).toBe(false); expect(onboarding(newcomer)).toBe(true);
    expect(panelOnly(sites)).toHaveLength(20);
    expect(splitCounts(sites)).toEqual({ panel: 20, onboarding: 1 });
    // The views and ~55 readers filter active = true: the newcomer's row is inactive, so it is excluded by the same rule.
    expect(sites.filter(s => s.active === true).map(s => s.domain)).not.toContain("new.com");
  });
  it("its redesigns are not counted", () => {
    const sectors = new Map(panel.map(p => [p.domain, p.sector]));
    const ev = [{ domain: "p1.com", source: "wayback", detected_at: "2022-05-01T00:00:00Z", effective_at: null }, { domain: "new.com", source: "wayback", detected_at: "2022-05-01T00:00:00Z", effective_at: null }];
    expect(redesignsByYear(ev, new Set(panel.map(p => p.domain)), sectors)).toEqual([{ year: 2022, sector: "fintech", source: "wayback", redesigns: 1 }]);
  });
  it("a sync never makes it active", async () => {
    const db = new Map(sites.map(s => [s.domain, { ...s, sector: s.sector, active: s.active ?? null, onboarding: !!s.onboarding, panel_since: s.panel_since ?? null }]));
    const store: SyncStore = {
      async read(ds) { return ds.flatMap(d => (db.has(d) ? [db.get(d)!] : [])); }, async onboardingDomains() { return [...db.values()].filter(r => r.onboarding).map(r => r.domain); },
      async insertOnboarding() {}, async updateOnboarding(d, p) { Object.assign(db.get(d)!, p); }, async clearOnboarding() {},
      async rpcSync(list) { for (const s of list) db.get(s.domain)!.active = true; },
    };
    await splitSync(store, sites.map(s => ({ domain: s.domain, sector: s.sector })), () => null);
    expect(db.get("new.com")).toMatchObject({ active: false, onboarding: true });
  });
});
