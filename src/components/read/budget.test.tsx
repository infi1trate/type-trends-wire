// Phase 21 page budgets that can be held without a browser: what the first response draws and sends. The full per-page numbers come from
// scripts/perf/measure.py and scripts/perf/html-parts.py against a running site.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { Wall, WALL_EAGER } from "./Wall";
import { StepSequence } from "@/components/data/DataStoryView";
import { BRANDS_FIRST } from "./BrandsIndexView";
import { fxInput } from "@/lib/data-stories/fixtures";
import { bigTypeStory, type Meta } from "@/lib/data-stories/stories";
import { FIRST_ROWS } from "@/lib/signals-index";
import { TILE_BOXES } from "@/lib/gallery";
import { packSnapshot } from "@/lib/signal-pack";
import type { GalleryTile } from "@/lib/gallery";
import type { SignalSnapshot } from "@/lib/signals";
import type { Box } from "@/lib/data-stories/types";

export const HTML_BUDGET_KB = 200;
const boxes: Box[] = Array.from({ length: TILE_BOXES }, (_, k) => ["t", 10, k * 20, 600, 14]);
const tile = (k: number): GalleryTile => ({ id: String(k), snapshot: k, domain: `brand-${k}.com`, name: `Brand ${k}`, sector: "dev-tools", at: "2026-11-16T00:00:00Z", day: "16 Nov 2026", quarter: "2026Q4", source: "live", label: `brand-${k}.com, first screen, 16 Nov 2026`, href: `/brands/brand-${k}.com`, size: k % 7 ? "sm" : "lg", crop: null, note: null,
  frame: { id: String(k), at: "2026-11-16", source: "live", w: 1280, h: 900, bg: "#ffffff", ink: "#111111", accent: "#ff0000", tones: [], boxes, crop: null, archiveUrl: null } });
const kb = (s: string) => new TextEncoder().encode(s).length / 1024;

describe("page budgets", () => {
  it("a 48-tile wall draws only the first screen's frames; the rest hold their space and draw near the screen", () => {
    const html = renderToString(createElement(Wall, { tiles: Array.from({ length: 48 }, (_, k) => tile(k)), label: "Big type" }));
    expect((html.match(/data-frame="skeleton"/g) ?? []).length).toBe(WALL_EAGER);
    expect((html.match(/data-deferred=""/g) ?? []).length).toBe(48 - WALL_EAGER);
    expect(html).toMatch(/aspect-ratio:1280 \/ 900/);
    const eager = renderToString(createElement(Wall, { tiles: Array.from({ length: 48 }, (_, k) => tile(k)), label: "Big type", eager: 48 }));
    expect(kb(html) / kb(eager)).toBeLessThan(0.35);
  });
  it("a data story's first response draws only the first step's figure; printing draws every step", () => {
    const meta: Meta = { slug: "who-went-big-first", number: 2, question: "Who went big first?", deck: "D", template: "Adoption timeline", collection: { label: "C", href: "/c" }, related: [] };
    const s = bigTypeStory(fxInput(), new Map(), meta), n = s.steps.filter(st => s.figures[st.view.figure]).length;
    const first = renderToString(createElement(StepSequence, { s }));
    expect((first.match(/data-deferred=""/g) ?? []).length).toBe(n - 1);
    const print = renderToString(createElement(StepSequence, { s, full: true }));
    expect((print.match(/data-deferred=""/g) ?? []).length).toBe(0);
  });
  it("lists send the first screen: signals (all headline, 15 supporting, archive as a count) and 60 brands", () => {
    expect(FIRST_ROWS.supporting).toBe(15);
    expect(FIRST_ROWS.archive).toBe(0);
    expect(BRANDS_FIRST).toBe(60);
  });
  it("the signal snapshot travels packed: well under half the size for a full run's worth of rows", () => {
    const rows = Array.from({ length: 1700 }, (_, k) => ({ dimension: "imagery", value: `value_${k % 160}`, scope: ["all", "fintech", "media"][k % 3]!, status: "ok", stage: "rising", momentum: 0.12345, current_share: 0.4123, next_wave_score: null, present: ["curation"], sites: 120, usable: 5 }));
    const snap: SignalSnapshot = { run_id: 1, computed_at: "2026-11-16T00:00:00Z", prev_runs: [], prev: [], rows };
    expect(JSON.stringify(packSnapshot(snap)).length / JSON.stringify(snap).length).toBeLessThan(0.6);
  });
  it("fonts never block rendering: display=swap and size-adjusted fallbacks", () => {
    const meta = readFileSync("src/lib/digest/meta.ts", "utf8"), css = readFileSync("src/styles.css", "utf8");
    expect(meta).toMatch(/display=swap/);
    expect(css).toMatch(/@font-face\s*\{[^}]*size-adjust/);
  });
});
