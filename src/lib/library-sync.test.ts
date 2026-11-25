import { describe, expect, it } from "vitest";
import { splitSync, type StoredSite, type SyncSite, type SyncStore } from "./library-sync";

type Row = StoredSite & { name: string };
function memory(rows: Row[]) {
  const db = new Map(rows.map(r => [r.domain, { ...r }]));
  const rpcCalls: string[][] = [];
  const store: SyncStore = {
    async read(ds) { expect(ds.length).toBeLessThanOrEqual(200); return ds.flatMap(d => (db.has(d) ? [db.get(d)!] : [])); },
    async onboardingDomains() { return [...db.values()].filter(r => r.onboarding).map(r => r.domain); },
    async insertOnboarding(rs) { for (const r of rs) db.set(r.domain, { ...r }); },
    async updateOnboarding(d, p) { Object.assign(db.get(d)!, p); },
    async clearOnboarding(ds) { for (const d of ds) db.get(d)!.onboarding = false; },
    // The real RPC: listed rows active, every other active row inactive.
    async rpcSync(sites) { rpcCalls.push(sites.map(s => s.domain)); const l = new Set(sites.map(s => s.domain)); for (const r of db.values()) if (r.active && !l.has(r.domain)) r.active = false; for (const s of sites) Object.assign(db.get(s.domain)!, { active: true, sector: s.sector }); },
  };
  return { db, store, rpcCalls };
}
const panelRow = (i: number): Row => ({ domain: `p${i}.com`, sector: "ai", name: `P${i}`, active: true, onboarding: false, panel_since: "2025-01-01T00:00:00Z" });
const panel = Array.from({ length: 300 }, (_, i) => panelRow(i));
const payload: SyncSite[] = [...panel.map(p => ({ domain: p.domain, sector: "ai" })), ...Array.from({ length: 100 }, (_, i) => ({ domain: `n${i}.com`, sector: "fintech", name: `N${i}` }))];
const none = () => null;

describe("R2a-2 sync split", () => {
  it("300 panel rows and 100 new domains leave 300 active and 100 onboarding, inactive", async () => {
    const m = memory(panel);
    expect(await splitSync(m.store, payload, none)).toMatchObject({ ok: true, panel: 300, onboarding_new: 100 });
    const all = [...m.db.values()];
    expect(all.filter(r => r.active).length).toBe(300);
    expect(all.filter(r => r.onboarding && !r.active && r.panel_since === null).length).toBe(100);
  });
  it("a second identical sync changes nothing", async () => {
    const m = memory(panel);
    await splitSync(m.store, payload, none);
    const before = JSON.stringify([...m.db.values()]);
    expect(await splitSync(m.store, payload, none)).toMatchObject({ ok: true, onboarding_new: 0, onboarding_kept: 100, onboarding_cleared: 0 });
    expect(JSON.stringify([...m.db.values()])).toBe(before);
  });
  it("dropping a new domain clears its onboarding flag and it stays inactive", async () => {
    const m = memory(panel);
    await splitSync(m.store, payload, none);
    await splitSync(m.store, payload.filter(s => s.domain !== "n0.com"), none);
    expect(m.db.get("n0.com")).toMatchObject({ onboarding: false, active: false });
  });
  it("an onboarding row is never passed to the RPC", async () => {
    const m = memory(panel);
    await splitSync(m.store, payload, none); await splitSync(m.store, payload, none);
    for (const call of m.rpcCalls) { expect(call.length).toBe(300); expect(call.some(d => d.startsWith("n"))).toBe(false); }
  });
  it("an empty-panel payload is refused and writes nothing", async () => {
    const m = memory(panel);
    expect((await splitSync(m.store, [{ domain: "new.com", sector: "ai" }], none)).ok).toBe(false);
    expect((await splitSync(m.store, [], none)).ok).toBe(false);
    expect(m.rpcCalls.length).toBe(0); expect(m.db.has("new.com")).toBe(false);
    expect([...m.db.values()].filter(r => r.active).length).toBe(300);
  });
  it("a former member listed again goes to the RPC and is reactivated", async () => {
    const m = memory([...panel, { ...panelRow(999), active: false }]);
    await splitSync(m.store, [...payload, { domain: "p999.com", sector: "ai" }], none);
    expect(m.db.get("p999.com")?.active).toBe(true);
  });
  it("new rows take their classification", async () => {
    const m = memory(panel);
    await splitSync(m.store, payload, () => ({ category: "c", subcategory: "s" }));
    expect(m.db.get("n1.com")).toMatchObject({ category: "c", subcategory: "s", name: "N1" });
  });
});
