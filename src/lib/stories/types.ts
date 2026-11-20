// STORY TYPES — the one definition file for what the story engine may run. Pure, no I/O.
// Each type names its reader job (SPOT what is changing, PROVE who is doing it, ACT where the opening is),
// what triggers it, the minimum evidence it needs, and the shape of its headline and deck.
import type { Basis } from "../labels";
import { MIN_RUN_GAP_DAYS } from "../run-gap";
export { MIN_RUN_GAP_DAYS };

export const STORY_KINDS = ["move", "rebrand", "shift", "breakout", "first_seen", "crossover", "counter_move", "white_space", "roundup", "launch", "news"] as const;
export type StoryKind = (typeof STORY_KINDS)[number];
export type ReaderJob = "spot" | "prove" | "act";
export type StoryTypeDef = { id: StoryKind; kicker: string; job: ReaderJob; trigger: string; evidence: string; headline: string; deck: string; soWhat: string };

export const STORY_TYPE_DEFS: Record<StoryKind, StoryTypeDef> = {
  move: { id: "move", kicker: "Move", job: "prove", trigger: "One brand's story, from every change it made on its homepage inside seven days: a positioning change (a headline that changes what the brand says it is, on a standard site), an identity change (two or more of type, colour, layout and headline on a standard site) or a headline typeface change (any site). Any other single change is a tape line.", evidence: "Every change with its before, after and date, the headline call's reason, and one library figure for context.", headline: "<brand> changed its <things>", deck: "<what>, <from> to <to> (<date>); …", soWhat: "One brand's change is a data point, not a trend yet: watch whether its sector follows." },
  rebrand: { id: "rebrand", kicker: "Rebrand", job: "prove", trigger: "One brand's identity change inside seven days that covers at least three of four identity dimensions (type, colour, theme, layout; palette and accent count once) on a standard site, on captures that are not seasonal promotions. Anything less runs as an identity change.", evidence: "The reasons (font, accent, palette, theme, redesign) and the confirmation date.", headline: "<brand> rebranded: new <reasons>", deck: "<n> identity changes confirmed together on <date>: <reasons>.", soWhat: "A full identity change resets how a brand reads against its sector, so its peers' next moves are worth watching." },
  shift: { id: "shift", kicker: "Shift", job: "spot", trigger: `A headline-tier signal changed stage between the latest real (non-dev) forecast run and the most recent real run at least ${MIN_RUN_GAP_DAYS} days older; a signal missing from the earlier run is not a shift.`, evidence: "Both stages with their run ids, the current share and brands showing it.", headline: "<signal> moved from <stage> to <stage>", deck: "The signal's deterministic so-what line.", soWhat: "" },
  breakout: { id: "breakout", kicker: "Breakout", job: "spot", trigger: "The existing forecast alert rule (top-decile momentum on ≥3 sites, share under 35%, not Peaking or Fading) fired for a headline-tier signal.", evidence: "Momentum, share and site count from the run that fired the alert.", headline: "<signal> is breaking out <where>", deck: "Momentum and share from that run.", soWhat: "" },
  first_seen: { id: "first_seen", kicker: "First seen", job: "spot", trigger: "A signal appears in the current library sample with no earlier archive capture carrying it, library-wide or in one sector, and only for kinds of signal the archive measures from stored HTML and CSS.", evidence: "Library-wide: at least 2 brands, or 1 brand plus a headline-tier signal. In a sector: at least 2 brands, and an archive for that sector with at least 8 brands and 4 quarters where that kind of signal was measured.", headline: "First seen: <signal> <where>", deck: "<n> brands show it, none in the archive before.", soWhat: "New in the library means early: few brands carry it, so it still reads as distinctive." },
  crossover: { id: "crossover", kicker: "Crossover", job: "spot", trigger: `A signal led by one sector passes the crossover floor in a second sector between the latest real forecast run and the most recent real run at least ${MIN_RUN_GAP_DAYS} days older.`, evidence: "The leading sector's share, the new sector's share before and after, and the brands in the new sector.", headline: "<signal> reaches <sector>", deck: "Led by <sector> at <share>, now on <share> of <sector> homepages, up from <share>.", soWhat: "A signal leaving its home sector is how trends spread; the second sector is where it stops being niche." },
  counter_move: { id: "counter_move", kicker: "Counter-move", job: "prove", trigger: "A brand's move adopts a Fading signal or drops a Rising or Emerging one (stage from its sector when covered, else all sectors). Held for the weekly counter-move roundup; never on a seasonal capture.", evidence: "The move, the signal and its stage.", headline: "<brand> adopts <signal> while it fades <where> / drops <signal> while it rises <where>", deck: "The move in plain words and the signal's stage.", soWhat: "Moving against the sector is a bet on standing out; check whether it reads as fresh or dated." },
  white_space: { id: "white_space", kicker: "White space", job: "act", trigger: "A headline signal Rising or Emerging across all sectors that almost no brand in a covered sector uses yet.", evidence: "Sector coverage, the sector's count and the share elsewhere, with brands elsewhere named. At most one per sector per week.", headline: "Almost no <sector> brand uses <signal>; it is <stage> everywhere else", deck: "<k> of <n> tracked <sector> brands show it, against <share> elsewhere.", soWhat: "An open lane: it is rising elsewhere and unused here, so the first brands in this sector to adopt it will stand out." },
  roundup: { id: "roundup", kicker: "Roundup", job: "spot", trigger: "Three or more brands making the same move (the same signal gained) within seven days, counting only changes that are not seasonal or reversed, and on merchandised or editorial sites only typeface and layout moves. Also, once a week: the against-the-grain roundup (three or more held counter-moves). The census (what homepages say now: words in headlines, sale mode) is stored as a roundup and runs once a week outside the daily five.", evidence: "Every member brand and change; brands going the other way are cited.", headline: "<N> <sector> brands moved to <signal> / changed their <thing>", deck: "Who moved and when.", soWhat: "Several brands making the same change within a week is a pattern, not a coincidence." },
  launch: { id: "launch", kicker: "Launch", job: "spot", trigger: "A Product Hunt launch from the wire.", evidence: "The launch link.", headline: "The launch title", deck: "The launch tagline.", soWhat: "A new product on the scene; shown only in New on the scene, never ranked in the main stream." },
  news: { id: "news", kicker: "News", job: "prove", trigger: "An RSS or Hacker News item whose title names a tracked brand by name (not a bare domain, link, handle or the publication itself) or a headline-tier signal label, and whose title or excerpt has a design subject term (logo, typeface, redesign, website and the like). Bluesky posts never run.", evidence: "The source link and the brand or signal it names.", headline: "The item's title", deck: "What it names.", soWhat: "Outside coverage of a tracked brand or headline signal: context for the numbers." },
};

// THRESHOLDS — every one named, with its reason.
/** Library event types a visitor can see; pricing, stack, navigation and new pages are tracked but are not stories. */
export const MOVE_EVENTS = new Set(["type_change", "palette_shift", "theme_flip", "layout_change", "message_pivot", "redesign", "imagery_shift", "aesthetic_shift"]);
/** Layout changes count as a move only when the hero changed (hero media or headline alignment); grid and corner tweaks are not visible news. */
export const MOVE_LAYOUT_FIELDS = new Set(["hero_media", "h1_align"]);
/** AI-read event types (basis AI ESTIMATE). */
export const AI_EVENTS = new Set(["imagery_shift", "aesthetic_shift"]);
/** Moves on the same brand from 14 days before to 2 days after a confirmed rebrand are part of it, so they don't also run alone. */
export const REBRAND_FOLD_BEFORE_DAYS = 14, REBRAND_FOLD_AFTER_DAYS = 2;
/** "Three or more brands making the same move within seven days" (E2a). Windows start at their first move (anchored), so ids stay stable. */
export const ROUNDUP_MIN = 3, ROUNDUP_WINDOW_DAYS = 7;
/** More than 5 brands at once is not an arrival: the archive missed it, so it is not "first seen" news. */
export const FIRST_SEEN_MAX_BRANDS = 5;
/** First seen needs 2 brands (one could be a measurement fluke); library-wide only, 1 brand on a headline signal is enough. */
export const FIRST_SEEN_MIN_BRANDS = 2;
/**
 * Kinds of signal the archive pass really measures from the HTML and CSS it stores, so "no archive capture had it" means something.
 * Everything else is never first-seen: css:* features (Wayback playback often drops or rewrites stylesheets, and most features postdate the
 * archive quarters), AI-read tags (vision tags on archive renders that often miss fonts and images are not comparable with live tags),
 * and composites (they mix AI and CSS members).
 */
export const FIRST_SEEN_DIMENSIONS: Record<string, { name: string; why: string }> = {
  theme: { name: "Page theme", why: "Light or dark page, read from the rendered page colors." },
  headline: { name: "Headline typeface", why: "Serif, sans or mono headlines, read from the declared H1 font stack (kept when archived font files fail)." },
  font: { name: "Web or system font", why: "Read from the declared body font stack." },
  tracking: { name: "Headline letter-spacing", why: "Read from declared CSS." },
  hero_media: { name: "Hero media", why: "Image, video, WebGL canvas or none, read from the archived HTML." },
  framework: { name: "Site framework", why: "Framework and site-builder markers, read from the archived HTML." },
};
/** Why everything else is never first-seen (shown on /what-we-show). */
export const FIRST_SEEN_EXCLUDED = "CSS features (Wayback playback often drops or rewrites stylesheets, and most features postdate the archive quarters), AI-read tags (vision tags on archive renders that often miss fonts and images are not comparable with live tags) and composites (they mix AI and CSS members).";
/** A sector-level first needs an archive that could have seen it: at least 8 brands in that sector with the dimension measured… */
export const FIRST_SEEN_ARCHIVE_MIN_BRANDS = 8;
/** …across at least 4 distinct quarters (a year of history), library-wide too. */
export const FIRST_SEEN_ARCHIVE_MIN_QUARTERS = 4;
/** A sector share of 10% is about 3 of the 30 tracked brands in a sector: past one-off adopters. */
export const CROSSOVER_FLOOR = 0.1;
/** The sector it comes from must carry it on at least 20% of homepages, so "leads" means something. */
export const CROSSOVER_LEAD_MIN = 0.2;
/** "Almost no one": at most 1 in 20 of the sector's tracked brands (1 of 30 today). */
export const WHITE_SPACE_MAX_SHARE = 0.05;
/** It must be real elsewhere: at least 15% of brands in other sectors show it. */
export const WHITE_SPACE_MIN_ELSEWHERE = 0.15;
/**
 * White space only where the gap could be filled: signal × sector pairs that do not apply, each with its reason (E2a; /what-we-show).
 * Media homepages have no software product, so product screenshots, product interface shots, chat mock-ups and code samples cannot be
 * adopted there; studios quote per project, so a pricing table does not apply; storefronts and hardware homepages show no code.
 */
export const WHITE_SPACE_NOT_APPLICABLE: Record<string, Record<string, string>> = {
  media: {
    "components:product_screenshot": "Media homepages sell stories, not a software product, so there is no product to screenshot.",
    "imagery:product_ui": "Media homepages have no software interface to show.",
    "components:chat_ui_mock": "A chat interface mock-up shows a software product; media homepages have none.",
    "components:code_block": "Code samples show a developer product; media homepages have none.",
  },
  studios: {
    "components:product_screenshot": "Studios show client work as case studies; they have no product of their own to screenshot.",
    "components:pricing_table": "Studios and agencies quote per project; a public pricing table does not apply.",
    "components:code_block": "Code samples show a developer product; studio homepages show client work.",
  },
  "commerce-dtc": { "components:code_block": "Code samples show a developer product; storefronts sell goods." },
  hardware: { "components:code_block": "Code samples show a developer product; hardware homepages sell devices." },
};
/** Positioning says what a company is, not a design choice it could make: "almost no AI brand uses AI as a feature" is not an opening. */
export const WHITE_SPACE_SKIP_CATEGORIES = new Set(["ai_positioning"]);
/** Sector coverage for a white-space claim: at least 15 tracked brands with a current capture. */
export const WHITE_SPACE_MIN_SECTOR_SITES = 15;
/** News must name something specific; brand names shorter than this are too ambiguous to match (domains always match). */
export const NEWS_NAME_MIN = 4;
/** Brand names that are ordinary words: matched only by domain ("linear.app"), never by name, so "linear gradients" is not news about Linear. */
export const NEWS_NAME_STOPWORDS = new Set(["apple", "amazon", "arc", "area", "axios", "basic", "box", "buck", "calm", "carta", "cash", "chime", "clay", "clerk", "coda", "column", "convex", "cosmos", "cursor", "deel", "descript", "dia", "eater", "ember", "equinox", "fantasy", "flighty", "frog", "future", "glean", "granola", "groq", "huge", "instrument", "jasper", "kraken", "ladder", "levels", "linear", "loom", "medium", "mercury", "meta", "monday", "neon", "nothing", "notion", "order", "pika", "pilot", "pitch", "plaid", "polygon", "public", "puck", "railway", "ramp", "render", "replicate", "resend", "ritual", "seed", "semafor", "sentry", "slack", "snowflake", "square", "squareup", "strava", "suno", "together", "twilio", "vault", "vox", "warp", "wired", "wise", "work", "writer", "zed", "zoom", "play", "lattice", "analogue", "character", "hinge", "koto", "lovable", "locomotive", "manus", "rabbit", "remarkable", "stability", "teenage", "uber", "polygon", "telegram", "discord", "harvey", "astro", "aeon",
  // Names stored from the brand seed (E2a) that are ordinary words or phrases: matched by domain only.
  "away", "casper", "cohere", "parachute", "things", "daylight", "lucid", "clue", "mother", "bumble", "tinder", "postman", "affirm", "playdate", "runway", "skims", "our place", "colossal", "defector", "collins", "the information", "the guardian", "the atlantic", "the verge", "the ringer", "public", "future"]);
/** Outside news must be about design: at least one of these terms (word boundary, case-insensitive) in the title or excerpt. Edit here only. */
export const NEWS_SUBJECT_TERMS = ["rebrand", "rebrands", "rebranding", "brand identity", "visual identity", "identity", "logo", "wordmark", "logotype", "typeface", "font", "typography", "redesign", "redesigns", "redesigned", "website", "homepage", "landing page", "web design", "design system", "branding", "brand refresh", "campaign", "packaging", "colour palette", "color palette", "art direction", "UI", "UX", "app design", "interface"] as const;
/** Why an outside item did not become a news candidate (counted on the desk). */
export const NEWS_DROP_REASONS = { bluesky: "Bluesky post", no_name: "no tracked name in the title", no_subject: "no design subject" } as const;
export type NewsDropReason = keyof typeof NEWS_DROP_REASONS;
/** Single-brand moves read only by AI never run alone; they stay on the tape and the brand page. */
export const ESTIMATE_ONLY_REASON = "Estimate only: one brand, one AI read";
/** Counter-moves wait for the weekly counter-move roundup (a later phase builds it). */
export const COUNTER_HELD_REASON = "Held for the weekly counter-move roundup";
/** Signal labels shorter than this are too generic to count as naming a signal in outside news. */
export const NEWS_SIGNAL_MIN = 8;
/** Number words for counts in headlines ("Five fintech brands…"). */
export const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
export const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

// A candidate: everything a story says, before scoring. Facts carry their receipts.
/** `line` (E2g): a census member's quoted headline or button, shown under "The lines". */
export type FactKind = "before" | "after" | "count" | "share" | "stage" | "source" | "brand" | "date" | "member" | "line";
export type Fact = { text: string; href: string | null; basis: Basis | null; kind?: FactKind };
export type EvidenceLink = { label: string; href: string };
export type Candidate = {
  id: string; type: StoryKind; kicker: string; headline: string; deck: string | null; facts: Fact[];
  sector: string | null; signalKeys: string[]; domains: string[]; evidence: EvidenceLink[]; sourceIds: string[];
  basis: Basis | null; happenedAt: string;
  /** Raw size input for score.ts (fields changed, stage distance, momentum, brands, share points, matches). */
  magnitude: number;
  /** First time this signal is seen (library-wide or in the sector). */
  firstSeen?: boolean;
  /** Candidate ids this story tells (roundup members, rebrand moves, the move behind a counter-move). */
  members?: string[];
  /** Forecast run behind a signal story (merges a SHIFT and BREAKOUT from the same run). */
  runId?: number | null;
  /** Stage the signal is in now (so-what copy). */
  stage?: string | null;
  /** Set when a rule holds the candidate before scoring (seasonal, reversed, estimate only, counter-move roundup); planStories keeps it held with this reason. */
  holdReason?: string;
  /** E2g · a census: the count it ran on, recorded in census_counts before the story is stored. */
  census?: { census_key: string; day: string; count: number; base: number; members: { domain: string; name: string; line: string }[] };
};
