// Explainer fixture for css:subgrid (all scope + two sectors, peers across dimensions).
import type { TraitRows, TRow } from "../trait";
const q = (q: string, s: number, n = 120, c = 0.5) => ({ q, s, n, c });
const base: Omit<TRow, "scope" | "current_share" | "stage"> = { dimension: "css", value: "subgrid", status: "ok", momentum: 4.84, next_wave_score: 1.3, quarters: [q("2024Q1", 0.01), q("2025Q1", 0.12), q("2026Q4", 0.26, 300)],
  proj_q1: 0.3, proj_q1_lo: 0.27, proj_q1_hi: 0.33, proj_q2: null, proj_q2_lo: null, proj_q2_hi: null, proj_q4: null, proj_q4_lo: null, proj_q4_hi: null, run_id: 13, computed_at: "2026-11-15T15:33:42Z",
  components: { sites: 78, raw: { gap: -14.07, momentum: 4.84, corroboration: 0 }, curation: { reason: "no curated index in the latest crawl" } }, lead_sites: [{ domain: "vercel.com", adopted: "2025Q1", lead: 7 }, { domain: "gone.example", adopted: "2024Q1", lead: 9 }] };
export const traitFixture = (): TraitRows => ({
  key: "css:subgrid",
  rows: [{ ...base, scope: "all", stage: "accelerating", current_share: 0.26 }, { ...base, scope: "dev-tools", stage: "peaking", current_share: 0.567 }, { ...base, scope: "health", stage: "flat", current_share: 0.1 }],
  peers: [{ dimension: "css", value: "subgrid", stage: "accelerating", current_share: 0.26, momentum: 4.8 }, { dimension: "css", value: "clamp", stage: "peaking", current_share: 0.6, momentum: 1 }, { dimension: "components", value: "bento_grid", stage: "flat", current_share: 0.2, momentum: 0 }, { dimension: "css", value: "variable_fonts", stage: "accelerating", current_share: 0.65, momentum: 2 }, { dimension: "aesthetic", value: "minimal", stage: "declining", current_share: 0.4, momentum: -1 }],
  sites: [{ domain: "vercel.com", sector: "dev-tools", name: "Vercel" }], thumbs: [], data_through: "2026Q4",
});

