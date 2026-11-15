// Small W46-shaped fixture: stored brief (with a legacy $TICKER), chart card, two forecast runs, alerts, events, sites.
import type { IssueRows } from "../issue";
import type { CardModel } from "../../chart/card";
export const CARD: CardModel = {
  week: "2026-W46", run_id: 13, origin: "call", trait: "css:subgrid", scope: "all", ticker: "$SUBGRID", stage: "accelerating", momentum_pts_q: 4.84, share: 0.26, n: 300,
  call: "$SUBGRID is accelerating with 4.84 momentum points per quarter.", data_through: "2026Q4",
  series: [{ q: "2024Q1", s: 0.01, n: 120 }, { q: "2025Q1", s: 0.12, n: 200 }, { q: "2026Q4", s: 0.26, n: 300 }],
  forecast: [{ q: "2027Q1", mid: 0.3, lo: 0.27, hi: 0.33 }], source_ref: "forecast:css:subgrid:all", forecast_run: 13,
};
export function fixture(): IssueRows {
  return {
    week: "2026-W46",
    brief: {
      headline: "Subgrid Momentum, Dropbox Pivots, and the End of Maximalism",
      caveats: "AI tags are estimates. Data through 2026Q4.",
      refs: { "event:3405": { label: "dropbox.com · message_pivot", domain: "dropbox.com" } },
      sections: [
        { title: "Rising", body: "Subgrid usage is accelerating, gaining 4.84 momentum points per quarter. Variable fonts are also accelerating. $SUBGRID leads the layout desk.", citations: [{ kind: "forecast", id: "css:subgrid:all" }] },
        { title: "Notable redesigns", body: "Dropbox shifted its messaging.", citations: [{ kind: "event", id: "3405" }] },
      ],
      watch: { id: "css:subgrid:all", call: "Subgrid is accelerating." },
    },
    run: { id: 13, computed_at: "2026-11-15T15:33:42Z", data_through: "2026Q4" },
    card: CARD,
    forecasts: [
      { dimension: "css", value: "subgrid", scope: "all", stage: "accelerating", current_share: 0.26, momentum: 4.84, sites: 78, lead_sites: [{ domain: "vercel.com", adopted: "2025Q1", lead: 7 }, { domain: "tailwindcss.com", adopted: "2024Q1", lead: 8 }, { domain: "not-in-library.example", adopted: "2024Q1", lead: 9 }] },
      { dimension: "components", value: "bento_grid", scope: "all", stage: "flat", current_share: 0.18, momentum: 0.4, sites: 60, lead_sites: [{ domain: "linear.app", adopted: "2024Q2", lead: 5 }] },
      { dimension: "components", value: "bento_grid", scope: "fintech", stage: "flat", current_share: 0.21, momentum: 2.3, sites: 20, lead_sites: null },
      { dimension: "aesthetic", value: "maximalist", scope: "all", stage: "declining", current_share: 0.08, momentum: -1.2, sites: 40, lead_sites: null },
      { dimension: "theme", value: "dark", scope: "all", stage: "flat", current_share: 0.3, momentum: 0, sites: 90, lead_sites: null },
    ],
    previous: [
      { dimension: "css", value: "subgrid", stage: "flat", momentum: 4, current_share: 0.24 },
      { dimension: "components", value: "bento_grid", stage: "flat", momentum: 0.3, current_share: 0.18 },
      { dimension: "aesthetic", value: "maximalist", stage: "peaking", momentum: -0.5, current_share: 0.09 },
      { dimension: "theme", value: "dark", stage: "flat", momentum: 0, current_share: 0.3 },
    ],
    alerts: [
      { title: "BREAKOUT $SUBGRID +4.8 pts/q in all", ref: "css:subgrid", url: "https://type-trends-wire.lovable.app/?panel=brief&trait=css%3Asubgrid&sector=all&alert=13-breakout", tags: ["alert", "breakout"], published_at: "2026-11-15T15:40:00Z" },
      { title: "BREAKOUT · Bento grids [LAYOUT] +2.3 pts/q · fintech", ref: "components:bento_grid", url: "https://type-trends-wire.lovable.app/?panel=brief&trait=components%3Abento_grid&sector=fintech&alert=13-breakout", tags: ["alert", "breakout"], published_at: "2026-11-15T15:39:00Z" },
    ],
    fonts: { date: "2026-11-15", since: "2026-11-10", rising: [{ family: "Instrument Serif", category: "serif", change: 40, rank: 210 }, { family: "Libre Barcode 39", category: "display", change: 900, rank: 400 }, { family: "Obscure Sans", category: "sans-serif", change: 1100, rank: 900 }], fading: [{ family: "Roboto Slab", category: "serif", change: -12, rank: 60 }] },
    typeEvents: [
      { domain: "miro.com", sector: "enterprise-saas", before: { h1: "Roobert PRO" }, after: { h1: "Apris" }, detected_at: "2026-11-13T10:00:00Z" },
      { domain: "linear.app", sector: "dev-tools", before: { body: "Inter Display" }, after: { body: "Inter" }, detected_at: "2026-11-12T10:00:00Z" },
    ],
    googleFamilies: ["Inter"],
    colorEvents: [
      { domain: "ragged-edge.com", sector: "studios", before: { accent: "#1C4673" }, after: { accent: "#067D8C" }, detected_at: "2026-11-14T18:20:52Z" },
      { domain: "newyorker.com", sector: "media", before: { palette: ["#FFFFFF", "#050A0A"] }, after: { palette: ["#020201", "#1F1E13"] }, detected_at: "2026-11-14T18:14:52Z" },
    ],
    sites: [{ domain: "vercel.com", sector: "dev-tools", name: "Vercel" }, { domain: "tailwindcss.com", sector: "dev-tools", name: null }, { domain: "linear.app", sector: "dev-tools", name: "Linear" }],
    thumbs: [],
    rebrands: [{ domain: "ragged-edge.com", sector: "studios", name: null, confirmed_at: "2026-11-14T18:20:52Z", read: "adopted $SUBGRID", reasons: ["accent"], before: { h1: null, accent: "#1C4673" }, after: { h1: null, accent: "#067D8C" } }],
    numbers: { library_sites: 300, crawl: { finished_at: "2026-11-10T23:10:28Z", sites: 971 }, wire_stories: 214 },
  };
}
/** The same week with nothing beyond the brief: optional sections must disappear. */
export function quietFixture(): IssueRows {
  return { ...fixture(), card: null, forecasts: [], previous: [], alerts: [], fonts: null, typeEvents: [], googleFamilies: [], colorEvents: [], sites: [], thumbs: [], rebrands: [], numbers: { library_sites: null, crawl: null, wire_stories: 0 } };
}
