// Shared fixtures for agency tests (not imported by the app).
import type { AuditRows, AuditSiteIn } from "./audit";
import type { WatchRows } from "./watch-feed";

const sig = (o: { h1: string; body: string; theme: string; accent: string; palette: string[]; css: string[]; tech: Record<string, boolean>; hero?: string; size?: number; track?: number }) => ({
  type: { rendered: { h1: { family: o.h1, webfont: true }, body: { family: o.body, webfont: true } }, declared: { h1: { size_px: o.size ?? 64, weight: 600, letter_spacing_em: o.track ?? -0.03, transform: "none" } } },
  color: { theme: o.theme, accent: o.accent, page_bg: o.theme === "dark" ? "#08090A" : "#FFFFFF", palette: o.palette.map((hex, i) => ({ hex, share: 0.5 / (i + 1) })) },
  layout: { h1_align: "center", hero_media: o.hero ?? "none", grid_max_cols: 3, cta_radius_px: 6 }, css_features: o.css, tech: o.tech,
});
const site = (domain: string, sector: string, s: ReturnType<typeof sig>, ai: Record<string, unknown> | null, css: string[]): AuditSiteIn => ({
  domain, status: "tracked", site: { sector, name: domain.split(".")[0]!, last_snapshot_at: "2026-11-14T00:00:00Z", last_change_at: null }, signals: s, captured_at: "2026-11-14T00:00:00Z",
  history: { theme: s.color.theme, h1_family: s.type.rendered.h1.family, webfont: true, h1_tracking: s.type.declared.h1.letter_spacing_em, css_features: css, frameworks: s.tech, hero_media: s.layout.hero_media, ai_tags: ai },
});
export const f = (dimension: string, value: string, scope: string, stage: string, share = 0.2, momentum = 1) => ({ dimension, value, scope, stage, current_share: share, momentum });

export function auditFixture(): AuditRows {
  const linear = sig({ h1: "Inter", body: "Inter", theme: "dark", accent: "#5E6AD2", palette: ["#08090A", "#5E6AD2", "#F7F8F8"], css: ["has", "container-queries"], tech: { next: true } });
  const vercel = sig({ h1: "Geist", body: "Geist", theme: "light", accent: "#0070F3", palette: ["#FFFFFF", "#000000"], css: ["has"], tech: { next: true, tailwind: true } });
  const supa = sig({ h1: "Manrope", body: "Inter", theme: "dark", accent: "#3ECF8E", palette: ["#1C1C1C", "#3ECF8E", "#F7F8F8"], css: [], tech: { tailwind: true } });
  return {
    domains: ["linear.app", "newco.io", "supabase.com", "vercel.com"], sector: null, now: "2026-11-15T18:00:00Z",
    sites: [
      site("linear.app", "dev-tools", linear, { components: ["logo_wall", "bento_grid"], aesthetic: ["dark_tech"], tone: ["confident"], hero_layout: "centered", confidence: 0.9 }, ["has", "container-queries"]),
      site("vercel.com", "dev-tools", vercel, { components: ["logo_wall"], aesthetic: ["minimal"], tone: ["technical"], hero_layout: "centered", confidence: 0.8 }, ["has"]),
      site("supabase.com", "dev-tools", supa, null, []),
      { domain: "newco.io", status: "pending", site: null, signals: null, captured_at: null, history: null },
    ],
    events: [{ id: 1, domain: "vercel.com", type: "palette_shift", before: { accent: "#000000" }, after: { accent: "#0070F3" }, detected_at: "2026-10-01T00:00:00Z" }, { id: 2, domain: "vercel.com", type: "theme_flip", before: { theme: "dark" }, after: { theme: "light" }, detected_at: "2026-01-01T00:00:00Z" }],
    rebrands: [], google: ["Inter", "Manrope"], thumbs: [], dataThrough: "2026-11-14",
    forecasts: [
      f("css", "has", "dev-tools", "accelerating", 0.4), f("theme", "dark", "dev-tools", "declining", 0.5), f("css", "container-queries", "dev-tools", "emerging", 0.1),
      f("css", "subgrid", "dev-tools", "accelerating", 0.06, 3), f("headline", "serif", "dev-tools", "emerging", 0.08, 2), f("css", "view-transitions", "dev-tools", "peaking", 0.3, 5),
      f("components", "pricing_table", "dev-tools", "accelerating", 0.2, 4), f("css", "subgrid", "all", "flat", 0.05), f("css", "has", "all", "accelerating", 0.3),
    ],
  };
}

const ID = "A".repeat(22), FEED = "F".repeat(22);
export function feedRows(extraEvents = 0): WatchRows {
  const events = [
    { id: 1, domain: "linear.app", type: "palette_shift", before: { accent: "#5E6AD2" }, after: { accent: "#0055FF" }, detected_at: "2026-11-14T09:00:00Z" },
    { id: 2, domain: "vercel.com", type: "message_pivot", before: { headline: "Ship faster" }, after: { headline: "Build & ship <AI>" }, detected_at: "2026-11-02T09:00:00Z" },
    { id: 3, domain: "other.com", type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" }, detected_at: "2026-11-14T09:00:00Z" },
    ...Array.from({ length: extraEvents }, (_, i) => ({ id: 100 + i, domain: "vercel.com", type: "theme_flip", before: { theme: "light" }, after: { theme: "dark" }, detected_at: new Date(Date.parse("2026-11-13T00:00:00Z") - i * 3600e3).toISOString() })),
  ];
  return {
    watch: { id: ID, name: "Acme & co", sites: ["linear.app", "vercel.com"], pending_sites: [], traits: ["css:subgrid"], sectors: ["dev-tools"], feed_token: FEED, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
    now: "2026-11-15T18:00:00Z",
    events, rebrands: [{ domain: "linear.app", sector: "dev-tools", name: "Linear", confirmed_at: "2026-11-10T00:00:00Z", read: "Moved to a serif.", reasons: ["font"] }],
    runs: [{ id: 7, computed_at: "2026-10-12T15:00:00Z", week: "2026-W41" }, { id: 8, computed_at: "2026-11-08T15:00:00Z", week: "2026-W45" }, { id: 9, computed_at: "2026-11-15T15:00:00Z", week: "2026-W46" }],
    stages: [
      { run_id: 8, dimension: "css", value: "subgrid", scope: "all", stage: "emerging", current_share: 0.04 },
      { run_id: 9, dimension: "css", value: "subgrid", scope: "all", stage: "accelerating", current_share: 0.061 },
      { run_id: 8, dimension: "css", value: "subgrid", scope: "dev-tools", stage: "emerging", current_share: 0.1 },
      { run_id: 9, dimension: "css", value: "subgrid", scope: "dev-tools", stage: "emerging", current_share: 0.12 },
      { run_id: 8, dimension: "theme", value: "dark", scope: "all", stage: "flat", current_share: 0.3 },
      { run_id: 9, dimension: "theme", value: "dark", scope: "all", stage: "declining", current_share: 0.28 },
      { run_id: 8, dimension: "theme", value: "dark", scope: "fintech", stage: "flat", current_share: 0.3 },
      { run_id: 9, dimension: "theme", value: "dark", scope: "fintech", stage: "declining", current_share: 0.28 },
      { run_id: 8, dimension: "css", value: "has", scope: "all", stage: "flat", current_share: 0.3 },
      { run_id: 9, dimension: "css", value: "has", scope: "all", stage: "accelerating", current_share: 0.4 },
    ],
    alerts: [{ id: 55, title: "Breakout: $SUBGRID", ref: "css:subgrid", url: "https://type-trends-wire.lovable.app/?panel=wire", published_at: "2026-11-15T15:05:00Z" }, { id: 56, title: "Unrelated", ref: "css:has", url: "x", published_at: "2026-11-15T15:05:00Z" }],
    siteTraits: { "linear.app": ["theme:dark"], "vercel.com": [] },
    sites: [{ domain: "linear.app", sector: "dev-tools", name: "Linear", last_change_at: "2026-11-14T09:00:00Z" }, { domain: "vercel.com", sector: "dev-tools", name: "Vercel", last_change_at: null }],
    thumbs: [], traitsNow: [{ dimension: "css", value: "subgrid", stage: "accelerating", current_share: 0.061 }], lastEvent: null,
  };
}

