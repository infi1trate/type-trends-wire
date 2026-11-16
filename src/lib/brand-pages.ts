// The brand pages (/brand/*): their order, and the brand's rules as short sentences taken from brand/README.md (the owner's
// source of truth). Values (hex, sizes, timings) are never written here: pages read them from the theme and the kit tokens. Pure.
export const BRAND_PAGES = [
  { slug: "", path: "/brand", title: "The brand", line: "Loud tabloid bones, four spot inks, and things that look like you could pick them up." },
  { slug: "mark", path: "/brand/mark", title: "The mark", line: "The word is always slug: lowercase, black, never typeset in a font." },
  { slug: "colour", path: "/brand/colour", title: "Colour", line: "Paper and ink carry the brand. Four inks do one job each." },
  { slug: "type", path: "/brand/type", title: "Type", line: "Big Shoulders states the fact. Newsreader explains it." },
  { slug: "containers", path: "/brand/containers", title: "Containers", line: "Square is print, round is object. One plate per screen." },
  { slug: "space", path: "/brand/space", title: "Space", line: "Air goes above: the bigger the idea, the more space over it." },
  { slug: "illustration", path: "/brand/illustration", title: "Illustration", line: "Something printed, something made by hand, something with volume." },
  { slug: "motion", path: "/brand/motion", title: "Motion", line: "Objects squash. Pages cut. Data counts to its value." },
  { slug: "downloads", path: "/brand/downloads", title: "Downloads", line: "The kit: outlined logo files, tokens, motion, filters and the guidelines." },
] as const;
export type BrandPageSlug = (typeof BRAND_PAGES)[number]["slug"];

export const BRAND_INTRO = {
  name: "P · Extra Fine",
  approved: "16 November 2026",
  idea: "Loud tabloid bones, four spot inks, and things that look like you could pick them up.",
};

export const MARK_RULES = {
  construction: [
    { id: "slit", title: "The slit", text: "Each letter cuts a thin slit into the letter before it; the slit shows the ground." },
    { id: "overlap", title: "The overlap", text: "Set on one line, each letter overlapping the one before, so the word reads as one object." },
    { id: "upright", title: "Upright", text: "Drawn from Shrikhand stood upright: the italic lean is taken out, and it never comes back." },
  ],
  clear: "Clear space is half the x-height on every side.",
  cuts: { display: "96 px and taller.", standard: "32 to 96 px: wider slits, slightly lighter.", micro: "Under 32 px: no slits, the letters fuse." },
  s: "The s stands in where four letters will not fit: avatars, favicon, app icon. Tiles are square.",
  icon: "The app icon is the one place the s becomes an object, with a rounded body, a light and a hard shadow.",
  grounds: "Paper by default; pink, yellow and green are allowed. On ink or on a photograph the mark sits on a slab: pink on ink, paper on a photo. It is never reversed to white.",
  donts: [
    { id: "lean", title: "The italic lean" },
    { id: "colour", title: "Any colour but black" },
    { id: "stretch", title: "Stretching" },
    { id: "spacing", title: "Letterspacing" },
    { id: "glow", title: "Soft shadows or glows" },
    { id: "typeset", title: "Setting the name in a typeface" },
  ],
} as const;

/** Share of a page each colour takes (brand/README.md, "Colour") and its limit. The job comes from the tokens' role table. */
export const COLOUR_ROLES = [
  { id: "paper", name: "Paper", share: 56, limit: "Never pure white for a page." },
  { id: "ink", name: "Ink", share: 16, limit: "Never greyed down for body text." },
  { id: "white", name: "White", share: 9, limit: "Never a page background." },
  { id: "pink", name: "Pink", share: 8, limit: "Never for status or alerts." },
  { id: "green", name: "Green", share: 4, limit: "Never a decorative fill." },
  { id: "yellow", name: "Yellow", share: 4, limit: "Never under long text." },
  { id: "red", name: "Red", share: 3, limit: "Never more than a mark at a time." },
] as const;
export const SUPPORTING = ["newsprint", "muted"] as const;
/** The contrast pairs the kit quotes, recomputed live from the tokens on /brand/colour. */
export const CONTRAST_AGAINST_INK = ["paper", "white", "pink", "yellow", "green", "red"] as const;
export const COLOUR_NOTES = {
  red: "Red text on paper is large type only.",
  stages: "Emerging pink, Rising green, Peaking red, Fading ink with paper text, Steady newsprint.",
  modes: { light: "Paper page, white cards.", dark: "Ink page, dark cards, paper text; the mark on a pink slab.", vibes: "Pink page, yellow cards, ink plate; for covers, share cards and launches." },
} as const;

export const TYPE_RULES = [
  "Capitals are for headlines only.",
  "Every number a reader should remember is set in Big Shoulders.",
  "Headlines are set tight, text is set loose.",
  "Balance headline lines; avoid one-word last lines in text.",
] as const;
export const TYPE_FACES = [
  { id: "display", name: "Big Shoulders", use: "900 for headlines and figures, 700 for labels. Capitals. It states the fact." },
  { id: "text", name: "Newsreader", use: "400 (italic for quotes) for decks, body and captions. It explains the fact." },
  { id: "mono", name: "IBM Plex Mono", use: "A utility face, only in the terminal and for code-like values: the console, signal keys, hex colours, domains and dense data tables. It never sets a headline, a label on a Read page or a sentence." },
] as const;
/** The ladder shown on /brand/type, in order (kit roles). */
export const TYPE_LADDER = ["display", "h1", "h2", "h3", "kicker", "chip", "deck", "body", "quote", "figure", "caption", "data"] as const;

export const CONTAINER_LAWS = [
  "Square is print, round is object. Only things a hand could pick up are round: stickers, gumballs, the app icon.",
  "One plate per screen.",
  "Two levels deep at most.",
  "A shadow is a promise that something moves.",
  "Lists are ruled tables, not stacks of cards. If a 1.5 px rule separates two things, do not draw a box.",
] as const;

export const SPACE_RULES = [
  "Air goes above: the bigger the idea, the more space over it.",
  "Pin small type (folios, dates, credits) to the edges and leave the middle to one thing.",
  "Quiet pages keep one column, off-centre; the left third holds a label and nothing else.",
  "Loud pages drop the gaps to 8 and let the grid do the work.",
] as const;
export const DENSITY_NOTES = {
  quiet: { empty: "About 70% empty", use: "Stories and reports." },
  steady: { empty: "About 45% empty", use: "The front page and indexes. One plate, a ruled list beside it." },
  loud: { empty: "About 15% empty", use: "The terminal, tile walls, share sets." },
} as const;

export const ILLUSTRATION_RULES = [
  "Every illustration mixes three materials: something printed (halftone, newsprint), something made by hand (cut paper, pencil), something with volume (a gumball, a trail, a soft object).",
  "Light comes from the top left. In illustration shadows are real: short and soft. In the interface they are hard and black.",
  "The number, the brand and the date stay in type, on paper, undistorted.",
  "Photographs are printed in one ink (green, pink or ink on paper) before they are used. Reading text never sits on a photograph; a display headline may cross one. Credit every photo.",
] as const;
/** The three styles and the kit filters (brand/illustration/slug-filters.svg) each one uses. */
export const ILLUSTRATION_STYLES = [
  { id: "cut", name: "Cut and paste", what: "Paper collage, taped photo, headline in strips, pencil notes.", filters: ["slug-paper", "slug-pencil", "slug-ground"] },
  { id: "trail", name: "The trail", what: "The chart line as a wet, raised trail with gumballs at the measurements.", filters: ["slug-trail", "slug-soft"] },
  { id: "soft", name: "Soft objects", what: "A number or letter as an inflated object on a two-ink print.", filters: ["slug-puff", "slug-puffBig", "slug-duoG", "slug-duoP", "slug-duoK"] },
] as const;

export const MOTION_RULES = [
  "Objects squash. Pages cut; they do not fade or slide. Data counts to its value.",
  "One thing moves at a time. The ticker and the live dot are the only loops.",
  "With reduced motion on, everything rests on its last frame.",
] as const;
/** The five motion patterns (names and words from lib/motion PATTERNS) with the reference keyframes in brand/motion/slug-motion.css. */
export const MOTION_PATTERNS = [
  { id: "arrive", name: "The mark arrives", token: "arrive", ease: "ooze", for: "The mark's four letters rise and settle one after another, by the stagger. On the gate and the first page of a session, once.", keyframes: ["m-ooze"] },
  { id: "press", name: "Press", token: "tap", ease: "linear", for: "Raised controls travel into their shadow; a sticker pops when it appears.", keyframes: ["m-press", "m-pop"] },
  { id: "cut", name: "Cut", token: "wipe", ease: "cut", for: "Page changes wipe with a hard edge. Never a fade or a slide.", keyframes: ["m-wipe"] },
  { id: "count", name: "Count", token: "move", ease: "ooze", for: "Figures roll to their value and bars grow the first time they enter view; a new story drops in and settles.", keyframes: ["m-roll", "m-grow", "m-drop"] },
  { id: "draw", name: "Draw", token: "draw", ease: "settle", for: "The trail draws along its path, 1.6 to 3 s; each gumball sticks as the head passes it.", keyframes: ["m-draw", "m-head", "m-stick"] },
] as const;

/** Kit files offered on /brand/downloads (served only through the gated /brand/files/<name> route). */
export const KIT_FILE_PURPOSE: { test: RegExp; what: string }[] = [
  { test: /^slug-wordmark-display\.svg$/, what: "The mark, display cut (96 px and taller)." },
  { test: /^slug-wordmark-standard\.svg$/, what: "The mark, standard cut (32 to 96 px)." },
  { test: /^slug-wordmark-micro\.svg$/, what: "The mark, micro cut (under 32 px)." },
  { test: /^slug-wordmark-display-clearspace\.svg$/, what: "The display mark with its clear space built in." },
  { test: /^slug-wordmark-on-(paper|pink|yellow|green)\.svg$/, what: "The mark on an allowed ground." },
  { test: /^slug-wordmark-on-ink/, what: "The mark on its pink slab, on ink." },
  { test: /^slug-s\.svg$/, what: "The s monogram, for places four letters will not fit." },
  { test: /^slug-s-tile-/, what: "A square s tile on one ground." },
  { test: /^slug-s-1000\.png$/, what: "The s monogram as a transparent PNG." },
  { test: /^slug-favicon/, what: "The favicon (s on yellow)." },
  { test: /^slug-app-icon/, what: "The app icon: the s as an object." },
  { test: /^slug-wordmark-.*\.png$/, what: "The mark as a transparent PNG." },
  { test: /\.tokens\.json$/, what: "Every token, three modes, as JSON." },
  { test: /\.tokens\.css$/, what: "Every token as CSS variables, with the type classes." },
  { test: /\.theme\.ts$/, what: "The tokens as a typed object for code." },
  { test: /motion\.css$/, what: "Timings, easings and the five reference animations." },
  { test: /filters\.svg$/, what: "Paper, grain, pencil, soft-object, trail and one-ink photo filters." },
  { test: /^README\.md$/, what: "The guidelines: the source of truth for every rule on these pages." },
];
export const kitFilePurpose = (name: string) => KIT_FILE_PURPOSE.find(p => p.test.test(name))?.what ?? "Part of the brand kit.";
/** File names are flat, lowercase, from the kit only; the file route refuses anything else. */
export const KIT_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(svg|png|json|css|ts|md)$/;
export const KIT_FILE_TYPES: Record<string, string> = { svg: "image/svg+xml", png: "image/png", json: "application/json; charset=utf-8", css: "text/css; charset=utf-8", ts: "text/plain; charset=utf-8", md: "text/markdown; charset=utf-8" };
export const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`);
