// CAPTURES REDRAWN: a stored snapshot becomes a Frame — its skeleton boxes (no screenshot is stored) in the capture's own colours, and
// the section crop when one exists. Shared by BEFORE AND AFTER and THE STRIP. Pure.
import type { BeforeAfterFig, Box, BoxKind, Diff, Frame, StripFig, StripMark } from "../types";
import { obj, num, str, hex, radiusBucket } from "../../library";
import { toCrop, utcDay, type CropRow } from "../../crops";
import { brandHref, dayText } from "../text";

/** The part of the page a frame redraws (page pixels) and how many boxes it keeps, so a strip of a dozen captures stays light. */
export const FOLD = { w: 1440, h: 1800 } as const;
export const MAX_BOXES = 160;
/** A crop upgrades a frame only when it was captured within this many days of the snapshot. */
export const CROP_MATCH_DAYS = 2;

export type CaptureRaw = {
  id: number; captured_at: string; source: string; page: unknown; color: unknown; skeleton: unknown;
  h1: string | null; body: string | null; h1_size: number | null; whitespace: number | null; hero: string | null; radius: number | null; archive_url: string | null;
};
const KIND: Record<string, BoxKind> = { heading: "h", text: "t", control: "c", media: "m", video: "m", canvas: "m", section: "s" };
const lum = (h: string) => { const n = parseInt(h.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

export function boxesOf(skeleton: unknown, width: number): Box[] {
  const raw = (Array.isArray(skeleton) ? skeleton : []).map(b => { const r = obj(b); return [KIND[str(r["kind"]) ?? ""] ?? "o", num(r["x"]) ?? 0, num(r["y"]) ?? 0, num(r["w"]) ?? 0, num(r["h"]) ?? 0] as Box; })
    .filter(b => b[3] > 0 && b[4] > 0 && b[2] < FOLD.h && b[1] < width && b[1] + b[3] > 0);
  const kept = [...raw].sort((a, b) => Number(b[0] === "s") - Number(a[0] === "s") || b[3] * b[4] - a[3] * a[4]).slice(0, MAX_BOXES);
  return kept.sort((a, b) => a[2] - b[2] || a[1] - b[1]).map(b => [b[0], Math.round(b[1]), Math.round(b[2]), Math.round(b[3]), Math.round(Math.min(b[4], FOLD.h - b[2]))] as Box);
}
export function cropFor(crops: CropRow[], domain: string, at: string) {
  const t = Date.parse(at);
  const c = crops.filter(r => r.domain === domain && r.section === "hero" && r.viewport === "desktop" && Math.abs(Date.parse(r.captured_at) - t) <= CROP_MATCH_DAYS * 864e5)
    .sort((a, b) => Math.abs(Date.parse(a.captured_at) - t) - Math.abs(Date.parse(b.captured_at) - t))[0];
  if (!c) return null;
  const v = toCrop(c);
  return { src: v.src, width: v.width, height: v.height, alt: v.alt };
}
export function toFrame(domain: string, c: CaptureRaw, crops: CropRow[]): Frame {
  const page = obj(c.page), color = obj(c.color), w = Math.max(1, num(page["w"]) ?? FOLD.w), h = Math.min(FOLD.h, Math.max(1, num(page["h"]) ?? FOLD.h));
  const palette = (Array.isArray(color["palette"]) ? color["palette"] : []).map(p => ({ hex: hex(obj(p)["hex"]), share: num(obj(p)["share"]) ?? 0 })).filter((p): p is { hex: string; share: number } => !!p.hex).sort((a, b) => b.share - a.share);
  const bg = hex(color["page_bg"]) ?? palette[0]?.hex ?? null;
  const ink = bg ? [...palette.map(p => p.hex), "#000000", "#FFFFFF"].sort((a, b) => contrast(b, bg) - contrast(a, bg))[0]! : null;
  const accent = hex(color["accent"]) ?? palette.find(p => p.hex !== bg && p.hex !== ink)?.hex ?? null;
  return { id: String(c.id), at: c.captured_at, source: c.source === "live" ? "live" : "wayback", w, h, bg, ink, accent, tones: palette.slice(0, 5).map(p => p.hex), boxes: boxesOf(c.skeleton, w), crop: cropFor(crops, domain, c.captured_at), archiveUrl: c.archive_url };
}
/** Every archive capture in time order plus the latest live one: the strip's frames. */
export function stripCaptures(cs: CaptureRaw[]): CaptureRaw[] {
  const sorted = [...cs].sort((a, b) => a.captured_at.localeCompare(b.captured_at) || a.id - b.id);
  const live = sorted.filter(c => c.source === "live").at(-1);
  return [...sorted.filter(c => c.source !== "live"), ...(live ? [live] : [])];
}

const theme = (c: CaptureRaw) => str(obj(c.color)["theme"]);
const px = (v: number | null) => (v == null ? null : `${Math.round(v)}px`);
const pc = (v: number | null) => (v == null ? null : `${Math.round(v * 100)}%`);
/** Measured differences between two captures, field by field; only fields measured on both sides and different. */
export function diffs(a: CaptureRaw, b: CaptureRaw): Diff[] {
  const rows: [string, string | null, string | null][] = [
    ["Headline font", a.h1, b.h1], ["Body font", a.body, b.body], ["Theme", theme(a), theme(b)],
    ["Page background", hex(obj(a.color)["page_bg"]), hex(obj(b.color)["page_bg"])], ["Accent colour", hex(obj(a.color)["accent"]), hex(obj(b.color)["accent"])],
    ["Headline size", px(a.h1_size), px(b.h1_size)], ["White space", pc(a.whitespace), pc(b.whitespace)], ["Hero media", a.hero, b.hero], ["Button corners", radiusBucket(a.radius), radiusBucket(b.radius)],
  ];
  return rows.filter((r): r is [string, string, string] => r[1] != null && r[2] != null && r[1].toLowerCase() !== r[2].toLowerCase()).map(([field, before, after]) => ({ field, before, after }));
}
export function beforeAfter(o: { title: string; note: string; domain: string; name: string; a: CaptureRaw; b: CaptureRaw; crops: CropRow[] }): BeforeAfterFig {
  return { kind: "before-after", title: o.title, note: o.note, domain: o.domain, name: o.name, href: brandHref(o.domain), before: toFrame(o.domain, o.a, o.crops), after: toFrame(o.domain, o.b, o.crops), diffs: diffs(o.a, o.b) };
}
export type MarkIn = { id: number; at: string; type: string };
const TYPE_WORD: Record<string, string> = { type_change: "Type change", palette_shift: "Palette shift", theme_flip: "Theme flip", redesign: "Redesign", layout_change: "Layout change", stack_change: "Stack change", nav_change: "Navigation change" };
export const typeWord = (t: string) => TYPE_WORD[t] ?? t.replace(/_/g, " ");
export function strip(o: { title: string; note: string; domain: string; name: string; captures: CaptureRaw[]; events: MarkIn[]; crops: CropRow[] }): StripFig {
  const frames = stripCaptures(o.captures).map(c => toFrame(o.domain, c, o.crops));
  const marks: StripMark[] = [...o.events].sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id).map(e => ({ id: String(e.id), at: e.at, type: e.type, label: `${typeWord(e.type)} · ${dayText(e.at)}`, after: frames.find(f => utcDay(f.at) >= utcDay(e.at))?.id ?? null }));
  return { kind: "strip", title: o.title, note: o.note, domain: o.domain, name: o.name, href: brandHref(o.domain), frames, marks };
}
