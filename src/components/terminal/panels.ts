export const PANELS = [
  { key: "F1", id: "overview", label: "OVERVIEW" },
  { key: "F2", id: "type", label: "TYPE" },
  { key: "F3", id: "color", label: "COLOR" },
  { key: "F4", id: "layout", label: "LAYOUT" },
  { key: "F5", id: "composition", label: "COMPOSITION" },
  { key: "F6", id: "lexicon", label: "LEXICON" },
  { key: "F7", id: "vibe", label: "VIBE" },
  { key: "F8", id: "wire", label: "WIRE" },
  { key: "F9", id: "rebrands", label: "REBRANDS" },
  { key: "F10", id: "brief", label: "BRIEF" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];

export const DORMANT: Partial<Record<PanelId, string>> = {
  color: "Hex clusters and palette temperature. Arrives with the crawler.",
  layout: "Hero patterns, grids, nav styles. Arrives with the crawler.",
  composition: "Density, whitespace ratio, balance. Arrives with the crawler.",
  lexicon: "Rising words in hero copy and design discourse. Arrives with the crawler.",
  vibe: "Mood clusters on a 2D map. Arrives with the crawler.",
  rebrands: "New identities, type and color extracted. Phase 2.",
  brief: "Auto-written weekly market report. After 7 days of data.",
};

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((+t - +y) / 86_400_000 + 1) / 7);
}
