import { describe, expect, it } from "vitest";
import { SECTOR_KEY, lensSignals, resolveSector, sectorFirst, sectorStore, showingText } from "./sector-lens";
import type { SignalRow } from "./signals";
import type { TierResult } from "./tiers";

const row = (k: string, scope: string): SignalRow => { const i = k.indexOf(":"); return { dimension: k.slice(0, i), value: k.slice(i + 1), scope, status: "ok", stage: scope === "all" ? "accelerating" : "declining", momentum: 1, current_share: 0.2, next_wave_score: 0.5, sites: 100, usable: 6 }; };
const tier = (key: string): TierResult => ({ key, tier: "headline", reasons: [], checks: {} as never, evidence: false });
const KEYS = ["css:subgrid", "css:has", "theme:dark", "css:clamp"];
const tiers = new Map(KEYS.map(k => [k, tier(k)]));

describe("sector lens", () => {
  it("unknown or missing sectors read as All", () => {
    expect(resolveSector("fintech")).toBe("fintech");
    expect(resolveSector("nope")).toBe("all");
    expect(resolveSector(undefined)).toBe("all");
    expect(showingText("fintech")).toBe("Showing: Fintech");
    expect(showingText("all")).toBe("Showing: All sectors");
  });
  it("storage failure falls back to All and never throws", () => {
    const broken = sectorStore(() => ({ getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } }));
    expect(broken.read()).toBe("all");
    expect(() => broken.write("fintech")).not.toThrow();
    expect(sectorStore(() => null).read()).toBe("all");
  });
  it("remembers a valid sector per device", () => {
    const m = new Map<string, string>(), st = sectorStore(() => ({ getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }));
    st.write("fintech");
    expect(m.get(SECTOR_KEY)).toBe("fintech");
    expect(st.read()).toBe("fintech");
  });
  it("uses the sector's own numbers when covered", () => {
    const rows = [...KEYS.map(k => row(k, "all")), ...KEYS.map(k => row(k, "fintech"))];
    const r = lensSignals(rows, tiers, "fintech");
    expect(r).toMatchObject({ sector: "fintech", scope: "fintech", note: null });
    expect(r.signals.find(s => s.key === "css:subgrid")?.stage).toBe("Fading");
  });
  it("falls back to All with a visible note when the sector lacks coverage", () => {
    const rows = [...KEYS.map(k => row(k, "all")), row("css:subgrid", "media")];
    const r = lensSignals(rows, tiers, "media");
    expect(r.scope).toBe("all");
    expect(r.note).toBe("Media doesn't have enough forecast coverage yet (1 of 4 headline signals measured there), so these are all-sector numbers.");
    expect(r.signals.find(s => s.key === "css:subgrid")?.stage).toBe("Rising");
  });
  it("ranks the chosen sector first, keeping order", () => {
    const items = [{ id: 1, s: "a" }, { id: 2, s: "fintech" }, { id: 3, s: null }, { id: 4, s: "fintech" }];
    expect(sectorFirst(items, "fintech", i => i.s).map(i => i.id)).toEqual([2, 4, 1, 3]);
    expect(sectorFirst(items, "all", i => i.s).map(i => i.id)).toEqual([1, 2, 3, 4]);
  });
});
