// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { byTier, clearSignalIndex, setSignalIndex, signalFields } from "./signal-index";
import { json } from "./tools/shared";
import { tiersFrom, buildSignals, type SignalRow } from "../signals";

const rows: SignalRow[] = [
  { dimension: "theme", value: "dark", scope: "all", status: "ok", stage: "accelerating", momentum: 2, current_share: 0.3, next_wave_score: 1, present: ["gap", "momentum", "corroboration"], sites: 120, usable: 6 },
  { dimension: "css", value: "subgrid", scope: "all", status: "ok", stage: "accelerating", momentum: 3, current_share: 0.2, next_wave_score: 2, present: ["gap"], sites: 80, usable: 6 },
];
const prime = () => { const t = tiersFrom(rows, new Map()); setSignalIndex(buildSignals(rows, t), t); };
afterEach(clearSignalIndex);

describe("MCP signal fields", () => {
  it("json() adds tier, basis, momentum_index and confidence beside label", () => {
    prime();
    const out = JSON.parse(json({ rows: [{ trait: "theme:dark" }, { trait: "css:subgrid" }] }).content[0]!.text);
    expect(out.rows[0]).toMatchObject({ label: "Dark mode", basis: "measured", tier: "headline", momentum_index: 50, confidence: "High" });
    expect(out.rows[0].confidence_reason).toMatch(/^High: 3 of 7 components/);
    expect(out.rows[1]).toMatchObject({ basis: "measured", tier: "archive", momentum_index: null });
  });
  it("keys the forecast doesn't stage still get their static tier", () => {
    prime();
    expect(signalFields("framework:webflow")!.tier).toBe("archive");
  });
  it("the tier filter is additive: unset returns rows unchanged", () => {
    prime();
    const r = [{ trait: "theme:dark" }, { trait: "css:subgrid" }];
    expect(byTier(r, undefined, x => x.trait)).toBe(r);
    expect(byTier(r, "headline", x => x.trait)).toEqual([{ trait: "theme:dark" }]);
    expect(byTier(r, "archive", x => x.trait)).toEqual([{ trait: "css:subgrid" }]);
  });
});
