// N2 · THE COPY DESK'S WEEKLY SWEEP (no model, fixes nothing). Collects the reader-facing lines of a story or study page that are not
// written text (kickers, the Numbers list, picture captions and credits, chart titles and notes, labels) and runs the copy lints over
// them. The sweep records the failing lines in the desk log under `copy desk`, one row per page. Pure.
import { lintLines, type LineKind, type Lint } from "./copy";

export type SweepLine = { text: string; kind: LineKind; where: string };
export type PageLints = { page: string; kind: "story" | "study"; fails: (Lint & { where: string })[] };

type StoryShown = { kicker?: string | null; typeName?: string | null; sectorName?: string | null; facts?: { text: string }[];
  census?: { lines: { name: string; line: string }[]; sectors?: string | null } | null; lead?: { caption: string | null; items: { credit: string; alt?: string }[]; words?: { line: string }[] } | null };

/** The non-written lines a story page shows a reader. */
export function storyLines(p: StoryShown): SweepLine[] {
  const out: SweepLine[] = [];
  const add = (text: string | null | undefined, kind: LineKind, where: string) => { if (text && text.trim()) out.push({ text: text.trim(), kind, where }); };
  add(p.kicker, "kicker", "kicker"); add(p.typeName, "label", "type"); add(p.sectorName, "label", "sector");
  for (const f of p.facts ?? []) add(f.text, "number", "the changes");
  for (const l of p.census?.lines ?? []) add(l.line, "number", "census lines");
  add(p.census?.sectors ?? null, "number", "census by sector");
  add(p.lead?.caption, "caption", "lead caption");
  for (const x of p.lead?.items ?? []) add(x.credit, "caption", "picture credit");
  for (const w of p.lead?.words ?? []) add(w.line, "caption", "lead words");
  return out;
}

const NOTE_KEYS = new Set(["title", "note", "label", "kicker", "unit_label", "caption_note"]);
/** The non-written lines of a study page: every figure's title, note and label (its written text — headline, deck, opening, scenes,
 *  use — is the study writer's and has its own check, so it is left out). */
export function studyLines(p: unknown): SweepLine[] {
  const out: SweepLine[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 8 || v == null) return;
    if (Array.isArray(v)) { v.slice(0, 200).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1)); return; }
    if (typeof v !== "object") return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "text" && depth === 0) continue; // the written text
      if (typeof x === "string" && NOTE_KEYS.has(k) && x.trim()) out.push({ text: x.trim(), kind: k === "kicker" ? "kicker" : k === "label" ? "label" : "note", where: `${path}.${k}`.replace(/^\./, "") });
      else if (typeof x === "object") walk(x, `${path}.${k}`, depth + 1);
    }
  };
  walk(p, "", 0);
  return out;
}

/** One page's failing lines (each once per lint), with where on the page it is. */
export function sweepPage(page: string, kind: "story" | "study", lines: readonly SweepLine[]): PageLints {
  const where = new Map(lines.map(l => [l.text, l.where] as const));
  return { page, kind, fails: lintLines(lines).map(f => ({ ...f, where: where.get(f.line) ?? "" })) };
}
