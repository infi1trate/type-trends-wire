// Terminal views now come from the one IA registry (src/lib/ia.ts); these names stay for older imports.
import { LEGACY_PANELS, resolveView, type ViewId } from "@/lib/ia";
export const PANELS = LEGACY_PANELS;
export type PanelId = ViewId;
export const resolvePanel = resolveView;

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((+t - +y) / 86_400_000 + 1) / 7);
}
