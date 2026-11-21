// The writer's facts block for one story (E2b), built from the story's own record only: its type, brand names, the tape lines it is built
// from (what, from, to, date, page, basis, hex for colours), the captured copy of those captures, the headline call, the library numbers
// with their bases, and its other stored fact lines. Pure.
import type { EventRow } from "../agency/changes";
import { hexName } from "../agency/changes";
import { brandName } from "../brand-names";
import { label, sectorName } from "../labels";
import { STORY_TYPE_DEFS, AI_EVENTS, type Fact, type StoryKind } from "./types";
import type { WriterChange, WriterFacts, WriterNumber, WrittenText } from "./writer";
import { howWeKnow, quotesOf } from "./writer";
import { CENSUS_HOW, CENSUS_NAMED_MAX, SALE_KEY, censusKeyOf } from "../census";
import { oneHeadline, oneHeadlineOf } from "../headline-text";

export type FactStory = { id: string; type: string; headline: string; deck: string | null; facts: unknown; sector: string | null; signal_keys: string[]; domains: string[]; source_ids: string[]; basis: string | null; happened_at: string; kicker: string };
export type FactSource = {
  events: ReadonlyMap<number, EventRow>;
  /** Headline, sub-headline and button texts per snapshot id. */
  texts: ReadonlyMap<number, string[]>;
  calls: Record<number, { call: string; reason: string }>;
  names: ReadonlyMap<string, string | null>;
  /** Every tracked brand name (cited brands are found in the story's own lines). */
  known: string[];
  /** Library numbers for the story's signals, in its sector and across the library, with their bases. */
  numbers?: (keys: string[], sector: string | null, runId?: number | null) => SheetNumber[];
};
export const MAX_CHANGES = 40;

// SHARES WITH THEIR BASES (E2c) ---------------------------------------------------------------------------------------------------
// U2b: the count and base behind a share, and the line that states it, live in the pure sheet module (one count per claim).
export { baseOf, shareLine, type ShareBase } from "./sheet";
import { storyRunId, uncovered, type SheetNumber } from "./sheet";
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "none");
const HERO: Record<string, string> = { image: "still", video: "video", webgl: "3D", canvas: "3D", none: "none" };
const tags = (dim: string, v: unknown) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((x): x is string => typeof x === "string").map(x => label(`${dim}:${x}`).name.toLowerCase()).join(", ") || "none";
const asFacts = (v: unknown): Fact[] => (Array.isArray(v) ? v.filter((f): f is Fact => !!f && typeof f === "object" && typeof (f as Fact).text === "string") : []);
/** Event ids a story tells: its own source events, the moves behind counter-moves and roundups. */
export const eventIdsOf = (s: { id: string; source_ids: string[] }) => [...new Set([s.id, ...s.source_ids].flatMap(x => [...x.matchAll(/(?:^|:)(?:event|move|counter|call):(\d+)/g)].map(m => Number(m[1]))).filter(Number.isFinite))];

/** Up to three hexes of one palette side with their names. */
const swatches = (v: unknown): { name: string; hex: string }[] => (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && /^#[\da-f]{6}$/i.test(x)).slice(0, 3).map(hex => ({ name: hexName(hex), hex: hex.toUpperCase() }));
/** One event as the writer's change lines (a palette change with an accent and a palette is two lines). */
export function changesOf(e: EventRow, brand: string): WriterChange[] {
  const b = o(e.before), a = o(e.after), basis = AI_EVENTS.has(e.type) ? "ai" as const : "measured" as const, page = e.page_type || "home";
  // E2g: a change is dated by its captures: `since` is the last capture with the old value, `date` the first with the new one.
  const c = (what: string, from: string, to: string, hex?: WriterChange["hex"]): WriterChange => ({ brand, what, from, to, ...(e.seen ? { since: e.seen.before } : {}), date: e.seen?.after ?? e.detected_at, page, basis, ...(hex ? { hex } : {}) });
  const out: WriterChange[] = [];
  switch (e.type) {
    case "palette_shift":
      // U2b: each side carries up to three named colours with their hexes (one naming function); only these names may be written.
      if ("accent" in a || "accent" in b) out.push({ ...c("accent", hexName(b["accent"]), hexName(a["accent"]), { from: typeof b["accent"] === "string" ? b["accent"] : null, to: typeof a["accent"] === "string" ? a["accent"] : null }), colours: { from: swatches([b["accent"]]), to: swatches([a["accent"]]) } });
      if ("palette" in a || "palette" in b) { const p = (v: unknown) => (Array.isArray(v) ? v.slice(0, 3).map(hexName) : []); const first = (v: unknown) => (Array.isArray(v) && typeof v[0] === "string" ? v[0] : null); out.push({ ...c("palette", [...new Set(p(b["palette"]))].join(", ") || "none", [...new Set(p(a["palette"]))].join(", ") || "none", { from: first(b["palette"]), to: first(a["palette"]) }), colours: { from: swatches(b["palette"]), to: swatches(a["palette"]) } }); }
      break;
    case "type_change":
      if ("h1" in a || "h1" in b) out.push(c("headline font", str(b["h1"]), str(a["h1"])));
      if ("body" in a || "body" in b) out.push(c("body font", str(b["body"]), str(a["body"])));
      break;
    case "theme_flip": out.push(c("theme", str(b["theme"]), str(a["theme"]))); break;
    case "message_pivot": out.push(c("headline", oneHeadline(str(b["headline"])), oneHeadline(str(a["headline"])))); break;
    case "layout_change": case "redesign":
      for (const k of Object.keys({ ...b, ...a })) {
        if (k === "hero_media") out.push(c("hero", HERO[String(b[k] ?? "none")] ?? String(b[k]), HERO[String(a[k] ?? "none")] ?? String(a[k])));
        else if (k === "h1_align") out.push(c("headline alignment", str(b[k]), str(a[k])));
        // I3 · 0.5: 0 means no column grid was detected, never "0 columns".
        else if (k === "grid_max_cols") out.push(c("grid columns", !b[k] ? "no column grid detected" : String(b[k]), !a[k] ? "no column grid detected" : String(a[k])));
        else if (k === "cta_radius_px") out.push(c("button corners", str(b[k]), str(a[k])));
      }
      if (e.type === "redesign" && !out.length) out.push(c("homepage redesign", "before", "after"));
      break;
    case "imagery_shift": case "aesthetic_shift": { const dim = e.type === "imagery_shift" ? "imagery" : "aesthetic"; out.push(c(dim, tags(dim, b[dim]), tags(dim, a[dim]))); break; }
    default: out.push(c(e.type.replace(/_/g, " "), "", ""));
  }
  return out;
}

/** The facts block and the template text (the fallback) for one story. */
export function writerFacts(s: FactStory, src: FactSource): { facts: WriterFacts; template: WrittenText } {
  if (censusKeyOf(s.id)) return censusFacts(s, src);
  const type = (s.type in STORY_TYPE_DEFS ? s.type : "news") as StoryKind, stored = asFacts(s.facts);
  const subjects = s.domains.map(d => brandName(d, src.names.get(d)));
  const events = eventIdsOf(s).map(id => src.events.get(id)).filter((e): e is EventRow => !!e).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id);
  // Bounded so a gathered story's block stays small; measured lines first.
  const changes = events.flatMap(e => changesOf(e, brandName(e.domain, src.names.get(e.domain)))).sort((a, b) => (a.basis === b.basis ? 0 : a.basis === "measured" ? -1 : 1)).slice(0, MAX_CHANGES).sort((a, b) => a.date.localeCompare(b.date));
  const copy = [...new Set(events.flatMap(e => [...(e.type === "message_pivot" ? [oneHeadlineOf(o(e.before)["headline"]), oneHeadlineOf(o(e.after)["headline"])] : []), ...(src.texts.get(e.snapshot_id ?? -1) ?? []), ...(src.texts.get(e.prev_snapshot_id ?? -1) ?? [])]).filter((x): x is string => typeof x === "string" && !!x.trim()))];
  // I3 · 0.2: a news story reports its item: the item's title and excerpt (verbatim) are its copy, so any quotation must match them.
  if (type === "news") {
    const item = stored.filter(f => f.kind === "line" && /^Item (?:title|excerpt): “/.test(f.text)).map(f => f.text.replace(/^Item (?:title|excerpt): “/, "").replace(/”$/, ""));
    for (const t of item.length ? item : [s.headline, s.deck ?? ""]) if (t.trim() && !copy.includes(t)) copy.push(t);
  }
  const call = events.map(e => src.calls[e.id]).find(Boolean) ?? null;
  // The confirmation date is machinery (Data view): the writer dates changes by their captures only (E2g).
  // U2b: the run's numbers come first; a stored count or share for the same signal and scope is dropped, so the sheet has one count.
  const sheet = src.numbers?.(s.signal_keys, s.sector, storyRunId(s.source_ids)) ?? [];
  const lines = uncovered(stored, sheet, s.sector).filter(f => !(f.kind === "member" && changes.length) && f.kind !== "date" && !/^Headline call:/.test(f.text)).map(f => ({ text: f.text.replace(/\s*\((?:forecast )?run \d+\)/gi, ""), basis: f.basis === "ai" || f.basis === "measured" ? f.basis : null }));
  const lower = new Set(subjects);
  const cited = [...new Set(src.known.filter(n => n.length >= 3 && !lower.has(n) && stored.some(f => new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(f.text))))];
  const numbers = sheet.map(n => ({ text: n.text, basis: n.basis }));
  const dates = [...new Set((events.length ? events.flatMap(e => (e.seen ? [e.seen.before, e.seen.after] : [e.detected_at])) : [s.happened_at]).map(d => d.slice(0, 10)))].sort();
  const facts: WriterFacts = {
    type, kind: s.id.startsWith("against:") ? "Against the grain (weekly piece)" : s.id.startsWith("seasonal:") ? "Seasonal (weekly piece)" : STORY_TYPE_DEFS[type].kicker, sector: s.sector ? sectorName(s.sector) : null,
    brands: [...subjects.map(name => ({ name, role: "subject" as const })), ...cited.map(name => ({ name, role: "cited" as const }))],
    changes, copy, headline_call: call ? { call: call.call, reason: call.reason } : null, numbers, lines, dates, rebrand: type === "rebrand",
  };
  const ourRead = s.basis === "ai" || changes.some(c => c.basis === "ai") || numbers.some(n => n.basis === "ai") || lines.some(l => l.basis === "ai");
  const news = type === "news" ? s.kicker.split(" · ").slice(1).join(" · ") || "outside news" : null;
  const template: WrittenText = { headline: s.headline, deck: s.deck || s.headline, body: [], how_we_know: howWeKnow({ dates, ourRead, measured: s.basis === "measured" || changes.some(c => c.basis === "measured"), news }) };
  return { facts, template };
}

/** E2g · the facts of a census: the count with its base, the sector counts, every member's quoted line and the members whose confirmed
 *  change added the word (with both capture dates). The writer names at most six brands; quotes must match a member's line exactly. */
export function censusFacts(s: FactStory, src: FactSource): { facts: WriterFacts; template: WrittenText } {
  const stored = asFacts(s.facts), key = censusKeyOf(s.id)!;
  // U2b: the run's numbers come first; a stored count or share for the same signal and scope is dropped, so the sheet has one count.
  const sheet = src.numbers?.(s.signal_keys, s.sector, storyRunId(s.source_ids)) ?? [];
  const lines = uncovered(stored, sheet, s.sector).filter(f => f.kind === "line"), counts = stored.filter(f => f.kind === "count");
  const added = eventIdsOf({ id: "", source_ids: s.source_ids.map(x => x.replace(/^added:/, "event:")) }).map(id => src.events.get(id)).filter((e): e is EventRow => !!e);
  const changes = added.flatMap(e => changesOf(e, brandName(e.domain, src.names.get(e.domain))));
  const copy = [...new Set([...lines.flatMap(f => quotesOf(f.text)), ...changes.flatMap(c => [c.from, c.to])].filter(x => !!x && x !== "none"))];
  const facts: WriterFacts = {
    type: "census", kind: key === SALE_KEY ? "Census: sale mode (weekly piece)" : "Census: words in headlines (weekly piece)", sector: null,
    brands: s.domains.map(d => ({ name: brandName(d, src.names.get(d)), role: "subject" as const })),
    changes, copy, headline_call: null, numbers: counts.map(f => ({ text: f.text, basis: "measured" as const })),
    lines: lines.map(f => ({ text: f.text, basis: "measured" as const })),
    dates: [...new Set([s.happened_at, ...added.flatMap(e => (e.seen ? [e.seen.before, e.seen.after] : [e.detected_at]))].map(d => d.slice(0, 10)))].sort(),
    rebrand: false, max_brands: CENSUS_NAMED_MAX,
  };
  return { facts, template: { headline: s.headline, deck: s.deck || s.headline, body: [], how_we_know: key === SALE_KEY ? CENSUS_HOW.sale : CENSUS_HOW.words } };
}
