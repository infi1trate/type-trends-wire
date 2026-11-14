// Pure discourse vocabulary, term counting and weekly signal math. No I/O.
import { VOCAB } from "./ai-schema";

export const FATIGUE_PHRASES = ["played out", "overdone", "tired of", "everyone uses", "so 2024", "so 2025", "cliché", "cliche", "bored of", "enough with"] as const;
export const TERM_KINDS = ["font", "aesthetic", "tone", "layout", "color", "tech", "generic"] as const;
export type TermKind = (typeof TERM_KINDS)[number];
export type DiscourseTerm = { term: string; kind: TermKind; trait?: string };
export const MAX_TERMS = 600;
export const MIN_FONT_SITES = 3;
/** Window-total row: n = design posts in the window. Reserved, never a tracked term. */
export const TOTAL_TERM = "*";
export const DISCOURSE_SOURCES = ["bluesky", "rss", "hn", "arena", "producthunt"] as const;
export type DiscourseSource = (typeof DISCOURSE_SOURCES)[number];

// Human phrasing for AI-tag vocab values that people would actually write.
const PHRASE: Record<string, string[]> = {
  "aesthetic:brutalist": ["brutalism", "brutalist"], "aesthetic:neo_brutalist": ["neo-brutalism", "neobrutalism", "neo brutalism"], "aesthetic:swiss_grid": ["swiss style", "swiss grid", "international style"],
  "aesthetic:glassmorphism": ["glassmorphism"], "aesthetic:skeuomorphic": ["skeuomorphism", "skeuomorphic"], "aesthetic:retro_futurist": ["retrofuturism", "retro-futurism", "retrofuturist"],
  "aesthetic:y2k": ["y2k aesthetic", "y2k"], "aesthetic:maximalist": ["maximalism", "maximalist"], "aesthetic:minimal": ["minimalism", "minimalist design"], "aesthetic:dark_tech": ["dark tech"],
  "aesthetic:terminal_mono": ["terminal aesthetic"], "aesthetic:editorial": ["editorial design"], "aesthetic:luxury": ["luxury branding"], "aesthetic:organic": ["organic shapes"],
  "aesthetic:corporate": ["corporate memphis"], "aesthetic:playful": ["playful design"],
  "imagery:3d_render": ["3d render", "3d renders"], "imagery:abstract_gradient": ["gradient", "gradients", "mesh gradient"], "imagery:generative_art": ["generative art"], "imagery:pixel_art": ["pixel art"],
  "imagery:illustration_hand_drawn": ["hand-drawn illustration", "hand drawn"], "imagery:illustration_flat": ["flat illustration"], "imagery:collage": ["collage"], "imagery:data_viz": ["data viz", "dataviz", "data visualization"],
  "imagery:typographic_only": ["type-only", "typographic poster"], "imagery:abstract_shapes": ["abstract shapes"],
  "components:bento_grid": ["bento grid", "bento box layout", "bento layout"], "components:marquee": ["marquee"], "components:logo_wall": ["logo wall"], "components:sticky_scroll_story": ["scrollytelling"],
  "components:testimonial_cards": ["testimonial cards"], "components:pricing_table": ["pricing table"], "components:chat_ui_mock": ["chat ui"], "components:interactive_demo": ["interactive demo"],
  "components:device_mockup": ["device mockup"], "components:cookie_banner": ["cookie banner"],
  "hero_layout:full_bleed_media": ["full-bleed", "full bleed"], "hero_layout:split_left_text": ["split hero"], "hero_layout:grid_collage": ["grid collage"],
  "color_mood:monochrome": ["monochrome"], "color_mood:pastel": ["pastel", "pastels"], "color_mood:neon": ["neon"], "color_mood:earthy": ["earthy tones", "earth tones"], "color_mood:high_contrast": ["high contrast"], "color_mood:vivid": ["vivid colors", "vivid colours"], "color_mood:muted": ["muted palette", "muted colors"],
  "tone:irreverent": ["irreverent"], "tone:playful": ["playful"], "tone:premium": ["premium feel"], "tone:calm": ["calm design"], "tone:technical": ["technical tone"], "tone:aspirational": ["aspirational"], "tone:authoritative": ["authoritative"], "tone:friendly": ["friendly tone"], "tone:urgent": ["urgency"],
};
const DIM_KIND: Record<string, TermKind> = { aesthetic: "aesthetic", imagery: "aesthetic", components: "layout", hero_layout: "layout", color_mood: "color", tone: "tone" };
// Measured-trait phrasing (crawl / library traits) plus tech.
const TRAIT_TERMS: DiscourseTerm[] = [
  { term: "dark mode", kind: "layout", trait: "theme:dark" }, { term: "dark theme", kind: "layout", trait: "theme:dark" },
  { term: "serif", kind: "layout", trait: "headline:serif" }, { term: "serifs", kind: "layout", trait: "headline:serif" },
  { term: "variable font", kind: "layout", trait: "font:webfont" }, { term: "variable fonts", kind: "layout", trait: "font:webfont" }, { term: "system font", kind: "layout", trait: "font:system" },
  { term: "tight tracking", kind: "layout", trait: "tracking:tight" }, { term: "negative tracking", kind: "layout", trait: "tracking:tight" },
  { term: "video hero", kind: "layout", trait: "hero_media:video" }, { term: "webgl", kind: "tech", trait: "hero_media:webgl" }, { term: "three.js", kind: "tech", trait: "hero_media:webgl" },
  { term: "monospace", kind: "layout" }, { term: "mono font", kind: "layout" },
  { term: "framer", kind: "tech", trait: "framework:framer" }, { term: "webflow", kind: "tech", trait: "framework:webflow" }, { term: "tailwind", kind: "tech", trait: "framework:tailwind" }, { term: "next.js", kind: "tech", trait: "framework:next" },
  { term: "container queries", kind: "tech", trait: "css:container_queries" }, { term: "view transitions", kind: "tech", trait: "css:view_transitions" }, { term: "oklch", kind: "tech", trait: "css:oklch" },
  { term: "subgrid", kind: "tech", trait: "css:subgrid" }, { term: "scroll-driven animations", kind: "tech", trait: "css:scroll_timeline" }, { term: "text-wrap: balance", kind: "tech", trait: "css:text_wrap_balance" }, { term: ":has()", kind: "tech", trait: "css:has_selector" },
  { term: "ai-native", kind: "tech", trait: "ai_positioning:ai_core" }, { term: "figma", kind: "tech" }, { term: "framer motion", kind: "tech" }, { term: "gsap", kind: "tech" },
];
const GENERIC: string[] = ["web design", "typography", "type design", "typeface", "branding", "brand identity", "ui design", "landing page", "design system", "graphic design", "motion design"];

const norm = (t: string) => t.trim().toLowerCase();
export function staticTerms(): DiscourseTerm[] {
  const out: DiscourseTerm[] = [...TRAIT_TERMS];
  for (const [dim, values] of Object.entries(VOCAB)) {
    const kind = DIM_KIND[dim]; if (!kind) continue;
    for (const v of values as readonly string[]) for (const term of PHRASE[`${dim}:${v}`] ?? []) out.push({ term, kind, trait: `${dim}:${v}` });
  }
  return out;
}

/** Build the sampler vocabulary: measured/AI-tag phrasing first, then fonts on ≥3 sites, colour hues, generic design words. */
export function buildTerms(input: { fonts: { family: string; sites: number }[]; hues: string[] }): DiscourseTerm[] {
  const seen = new Set<string>(), out: DiscourseTerm[] = [];
  const add = (t: DiscourseTerm) => { const k = norm(t.term); if (!k || k === TOTAL_TERM || k.length > 100 || seen.has(k) || out.length >= MAX_TERMS) return; seen.add(k); out.push({ ...t, term: t.term.trim() }); };
  staticTerms().forEach(add);
  [...input.fonts].filter(f => f.sites >= MIN_FONT_SITES).sort((a, b) => b.sites - a.sites || a.family.localeCompare(b.family)).forEach(f => add({ term: f.family, kind: "font" }));
  [...new Set(input.hues.map(h => h.replace(/-/g, " ")))].sort().forEach(h => add({ term: h, kind: "color" }));
  GENERIC.forEach(term => add({ term, kind: "generic" }));
  return out;
}

/** Stable short version so the sampler can cache the vocabulary (FNV-1a over the sorted list). */
export function termsVersion(terms: DiscourseTerm[]): string {
  let h = 0x811c9dc5;
  for (const ch of terms.map(t => `${t.kind}|${t.term}|${t.trait ?? ""}`).sort().join("\n")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Fonts match case-sensitively (Inter ≠ inter); everything else case-insensitively; both on non-word boundaries. */
export function termMatcher(t: Pick<DiscourseTerm, "term" | "kind">): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${esc(t.term)}(?![\\p{L}\\p{N}_])`, t.kind === "font" ? "u" : "iu");
}
const FATIGUE_RE = new RegExp(FATIGUE_PHRASES.map(esc).join("|"), "iu");
export const hasFatigue = (text: string) => FATIGUE_RE.test(text);

/** Count each tracked term at most once per text; fatigue = texts that mention the term and use fatigue language. */
export function countTerms(texts: string[], terms: DiscourseTerm[]): Record<string, { n: number; fatigue: number }> {
  const matchers = terms.map(t => [t.term, termMatcher(t)] as const), out: Record<string, { n: number; fatigue: number }> = {};
  for (const text of texts) {
    const tired = hasFatigue(text);
    for (const [term, re] of matchers) if (re.test(text)) { const c = out[term] ?? { n: 0, fatigue: 0 }; c.n++; if (tired) c.fatigue++; out[term] = c; }
  }
  return out;
}

export type CountRow = { source: string; window_start: string; window_end: string; term: string; n: number; fatigue: number; sampled_posts: number; design_posts: number };
/** Day-bucketed additive rows for wire-like sources (one item = one sampled post). */
export function dailyCountRows(source: DiscourseSource, items: { text: string; published_at: string }[], terms: DiscourseTerm[]): CountRow[] {
  const byDay = new Map<string, string[]>();
  for (const i of items) { const t = Date.parse(i.published_at); if (Number.isNaN(t)) continue; const d = new Date(t).toISOString().slice(0, 10); byDay.set(d, [...(byDay.get(d) ?? []), i.text]); }
  const rows: CountRow[] = [];
  for (const [day, texts] of [...byDay].sort()) {
    const start = `${day}T00:00:00.000Z`, end = new Date(Date.parse(start) + 864e5).toISOString(), base = { source, window_start: start, window_end: end, sampled_posts: texts.length, design_posts: texts.length };
    rows.push({ ...base, term: TOTAL_TERM, n: texts.length, fatigue: 0 });
    for (const [term, c] of Object.entries(countTerms(texts, terms))) rows.push({ ...base, term, ...c });
  }
  return rows;
}

// ── Weekly discourse signal per trait ──────────────────────────────────────────
export const DISCOURSE_WEEKS = 9; // current week + 8 prior
export const FATIGUE_RATIO = 0.15, FATIGUE_MIN_N = 20, SPIKE_MULTIPLE = 3, SPIKE_MIN_N = 15, MIN_BASELINE_WEEKS = 4;
export type Week = { n: number; fatigue: number; sampled: number };
/** Buckets rows into 7-day weeks ending at `now` (index 0 = last 7 days). Window rows are assigned by window_start. */
export function weeklyBuckets(rows: Pick<CountRow, "window_start" | "term" | "n" | "fatigue" | "sampled_posts">[], terms: Set<string>, now: number): Week[] {
  const weeks: Week[] = Array.from({ length: DISCOURSE_WEEKS }, () => ({ n: 0, fatigue: 0, sampled: 0 }));
  for (const r of rows) {
    const age = now - Date.parse(r.window_start); if (!(age >= 0)) continue;
    const k = Math.floor(age / (7 * 864e5)); if (k >= DISCOURSE_WEEKS) continue;
    if (r.term === TOTAL_TERM) weeks[k]!.sampled += r.sampled_posts;
    else if (terms.has(r.term.toLowerCase())) { weeks[k]!.n += r.n; weeks[k]!.fatigue += r.fatigue; }
  }
  return weeks;
}
const rate = (w: Week) => (w.sampled > 0 ? (w.n / w.sampled) * 1e4 : null);
const medianOf = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
export type DiscourseSignal = { rate_per_10k: number | null; z: number | null; n_week: number; n_9w: number; baseline_weeks: number; fatigue_ratio: number | null; prev_fatigue_ratio: number | null; fatigue_flag: boolean; spike: boolean; spike_ratio: number | null };
/** z = (this week's rate − mean of prior 8 weekly rates) / sd (floored at 1 per 10k); needs ≥4 prior weeks with samples. */
export function discourseSignal(weeks: Week[]): DiscourseSignal {
  const cur = weeks[0]!, prior = weeks.slice(1).filter(w => w.sampled > 0), r0 = rate(cur), base = prior.map(w => rate(w)!);
  const enough = prior.length >= MIN_BASELINE_WEEKS && r0 !== null;
  const mean = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0, sd = base.length ? Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length) : 0;
  const z = enough ? Math.max(-5, Math.min(5, (r0! - mean) / Math.max(sd, 1))) : null;
  const sum = (ws: Week[], k: "n" | "fatigue") => ws.reduce((a, w) => a + w[k], 0);
  const last4 = weeks.slice(0, 4), prev4 = weeks.slice(4, 8), n4 = sum(last4, "n"), p4 = sum(prev4, "n");
  const fr = n4 > 0 ? sum(last4, "fatigue") / n4 : null, pfr = p4 > 0 ? sum(prev4, "fatigue") / p4 : null;
  const med = medianOf(base);
  const spikeRatio = enough && med !== null && med > 0 ? r0! / med : null;
  return { rate_per_10k: r0 === null ? null : Math.round(r0 * 100) / 100, z: z === null ? null : Math.round(z * 100) / 100, n_week: cur.n, n_9w: sum(weeks, "n"), baseline_weeks: prior.length,
    fatigue_ratio: fr, prev_fatigue_ratio: pfr, fatigue_flag: isFatigueTurn(n4, fr, pfr),
    spike: enough && cur.n >= SPIKE_MIN_N && med !== null && (med === 0 || r0! >= SPIKE_MULTIPLE * med), spike_ratio: spikeRatio === null ? null : Math.round(spikeRatio * 100) / 100 };
}
/** Praise turning to fatigue: over the last 4 weeks fatigue/n > 0.15 with n ≥ 20, and higher than the 4 weeks before (when known). */
export function isFatigueTurn(n4: number, ratio: number | null, prevRatio: number | null): boolean {
  return n4 >= FATIGUE_MIN_N && ratio !== null && ratio > FATIGUE_RATIO && (prevRatio === null || ratio > prevRatio);
}
/** Static trait → term list used by the forecast (fonts/hues have no forecast trait). */
export function traitTermMap(terms: DiscourseTerm[] = staticTerms()): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const t of terms) if (t.trait) { const s = m.get(t.trait) ?? new Set<string>(); s.add(t.term.toLowerCase()); m.set(t.trait, s); }
  return m;
}
