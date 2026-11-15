export const PANELS = [
  { key: "T", id: "today", label: "TODAY" },
  { key: "F1", id: "overview", label: "SIGNALS" },
  { key: "F2", id: "type", label: "TYPE" },
  { key: "F3", id: "color", label: "COLOR" },
  { key: "F4", id: "layout", label: "LAYOUT" },
  { key: "F5", id: "composition", label: "COMPOSITION" },
  { key: "F6", id: "lexicon", label: "LEXICON" },
  { key: "F7", id: "vibe", label: "VIBE" },
  { key: "F8", id: "wire", label: "WIRE" },
  { key: "F9", id: "rebrands", label: "REBRANDS" },
  { key: "F10", id: "brief", label: "FORECAST" },
  { key: "F11", id: "library", label: "LIBRARY" },
  { key: "F12", id: "history", label: "HISTORY" },
  { key: "W", id: "watch", label: "WATCH" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];

/** Panels reachable by F-keys and digit keys 1–0 (TODAY and WATCH have their own letter keys). */
export const FKEY_PANELS = PANELS.filter(p => p.key.startsWith("F"));
/** Old and alternative names still open the right panel (muscle memory, shared links). */
export const PANEL_ALIASES: Record<string, PanelId> = { ticker: "overview", signals: "overview", overview: "overview", forecast: "brief" };
export const resolvePanel = (id: string | undefined): PanelId => PANELS.find(p => p.id === id)?.id ?? (id ? PANEL_ALIASES[id.toLowerCase()] : undefined) ?? "today";

export const DORMANT: Partial<Record<PanelId, string>> = {};

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((+t - +y) / 86_400_000 + 1) / 7);
}
