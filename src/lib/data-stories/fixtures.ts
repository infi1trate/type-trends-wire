// Deterministic stored-data fixtures for data story tests and the /kit examples. Pure.
import type { DataInput, HistRow, SiteInfo, SnapMeta, CaptureStamp, EventRow } from "./series";
import type { CaptureRaw } from "./templates/frames";

export const FX_QUARTERS = ["2021Q1", "2022Q1", "2023Q1", "2024Q1", "2026Q4"] as const;
export const FX_SECTORS = ["dev-tools", "enterprise-saas", "fintech"] as const;
const AT: Record<string, string> = { "2021Q1": "2021-02-10T00:00:00Z", "2022Q1": "2022-02-10T00:00:00Z", "2023Q1": "2023-02-10T00:00:00Z", "2024Q1": "2024-02-10T00:00:00Z", "2026Q4": "2026-11-14T00:00:00Z" };
const PAL = ["#FFFFFF", "#111111", "#2F6BFF", "#F2F2F2", "#FF4F00", "#0A7D4F"];
export type FxOpts = { perSector?: number; quarters?: readonly string[]; sampled?: (i: number, q: string) => boolean; adoptAt?: (i: number) => number; events?: number };
/** `perSector` brands in each of three sectors, one capture per brand per quarter. Brand i adopts Big type at quarter index adoptAt(i) (≥ quarters: never). */
export function fxInput(o: FxOpts = {}): DataInput {
  const per = o.perSector ?? 20, qs = o.quarters ?? FX_QUARTERS, adopt = o.adoptAt ?? ((i: number) => i % 6), sampled = o.sampled ?? (() => true);
  const sites: SiteInfo[] = [], history: HistRow[] = [], snaps: SnapMeta[] = [], captures: CaptureStamp[] = [], events: EventRow[] = [];
  let id = 1, ev = 1;
  FX_SECTORS.forEach((sector, si) => { for (let j = 0; j < per; j++) {
    const i = si * per + j, domain = `b${String(i).padStart(2, "0")}.example`;
    sites.push({ domain, name: `Brand ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ""}`, sector, active: true });
    qs.forEach((q, k) => {
      if (!sampled(i, q)) return;
      const big = k >= adopt(i), live = q === "2026Q4", at = AT[q] ?? `${q.slice(0, 4)}-02-10T00:00:00Z`;
      history.push({ domain, quarter: q, sector, captured_at: at, source: live ? "live" : "wayback", now: live, snapshot_id: id,
        theme: (i + k) % 4 === 0 ? "dark" : "light", h1_size_px: big ? 56 + (i % 5) * 8 : 32 + (i % 4) * 2, h1_tracking: big ? -0.03 : 0, whitespace_ratio: 0.2 + ((i * 7) % 10) / 20,
        css_features: k >= 2 && i % 2 === 0 ? ["scroll_timeline"] : [], hero_media: k === qs.length - 1 && i % 3 === 0 ? "webgl" : null, frameworks: {}, ai_tags: null, h1_family: "Inter", body_family: "Inter" } as HistRow);
      snaps.push({ id, skeleton: true, palette: [{ hex: PAL[(i + k) % 2]!, share: 0.6 }, { hex: PAL[2 + ((i + (k > 2 ? 1 : 0)) % 4)]!, share: 0.25 }] });
      captures.push({ domain, at, source: live ? "live" : "wayback" });
      if (k > 0 && (i + k) % 3 === 0) for (let e = 0; e < (o.events ?? 1); e++) events.push({ id: ev++, domain, type: k % 2 ? "type_change" : "palette_shift", source: live ? "live" : "wayback", at, snapshot_id: id });
      id++;
    });
  } });
  return { now: Date.parse("2026-11-16T12:00:00Z"), sites, history, snaps, captures, events, rebrands: [{ id: "r1", domain: "b00.example", at: "2022-02-10T00:00:00Z", source: "archive" }], headline: [{ key: "theme:dark", name: "Dark mode" }, { key: "hero_media:webgl", name: "WebGL hero" }, { key: "css:scroll_timeline", name: "Scroll-driven animation" }], crops: [], runId: 1 };
}
/** A stored capture as the per-domain loader returns it. */
export function fxCapture(id: number, at: string, o: Partial<CaptureRaw> & { bg?: string; source?: string } = {}): CaptureRaw {
  const bg = o.bg ?? "#FFFFFF";
  return { id, captured_at: at, source: o.source ?? "wayback", page: { w: 1440, h: 4000 },
    color: { page_bg: bg, accent: "#2F6BFF", theme: bg === "#FFFFFF" ? "light" : "dark", palette: [{ hex: bg, share: 0.7 }, { hex: "#111111", share: 0.2 }, { hex: "#2F6BFF", share: 0.1 }] },
    skeleton: [{ kind: "section", x: 0, y: 0, w: 1440, h: 900 }, { kind: "heading", x: 120, y: 200, w: 800, h: 96 }, { kind: "text", x: 120, y: 320, w: 600, h: 64 }, { kind: "control", x: 120, y: 420, w: 180, h: 48 }, { kind: "media", x: 800, y: 160, w: 520, h: 400 }, { kind: "text", x: 0, y: 2500, w: 600, h: 40 }],
    h1: "Inter", body: "Inter", h1_size: 64, whitespace: 0.4, hero: "image", radius: 8, archive_url: null, ...o };
}
