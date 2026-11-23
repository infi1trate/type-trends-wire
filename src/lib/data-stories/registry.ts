// THE STUDIES REGISTRY (data stories in code) — the one list of studies: permanent number, series, question, deck, template, parameters,
// collection and status. A study is LIVE only when its "is there a story" check passed on stored data (figures recorded below,
// re-checked at read time); otherwise it stays a DRAFT with the reason and waits on the Studies home's "In the works" shelf. Pure.
import type { CheckId } from "./checks";
import type { Link } from "./types";
import { compositeKey } from "../composites";
import { MUSEUM_SHOWN } from "../site";

export const TEMPLATES = {
  adoption: "Adoption timeline",
  "before-after": "Before and after",
  multiples: "Small multiples by sector",
  field: "Brand field",
  drift: "Palette drift",
  strip: "One object through time",
} as const;
export type TemplateId = keyof typeof TEMPLATES;

/** E4 · every study belongs to one series: a standing question the reader learns to expect. Order is the Studies home's order. */
export const SERIES = [
  { id: "first-movers", title: "Who moved first", description: "One signal, every brand that took it up, in the order the archive shows it." },
  { id: "long-view", title: "The long view", description: "Five years of one sector or one signal, read quarter by quarter." },
  { id: "sector-v-sector", title: "Sector against sector", description: "The same measure across all ten sectors, side by side." },
] as const;
export type SeriesId = (typeof SERIES)[number]["id"];
export const seriesOf = (id: string) => SERIES.find(x => x.id === id) ?? null;
/** Numbers retired from the list and never reused (5 was "Where does your brand sit?", now a tool). */
export const RETIRED_NUMBERS: readonly number[] = [5];
/** "Study No. 2". */
export const studyLabel = (n: number) => `Study No. ${n}`;

export type Entry = {
  slug: string; number: number; series: SeriesId; question: string; deck: string;
  /** Templates in order of appearance; the first names the story on the index. */
  templates: TemplateId[];
  params: { sectors: string[] | null; signal?: string; brands?: string; period: string };
  collection: Link;
  status: "live" | "draft"; reason: string | null;
  check: CheckId | null;
  /** The check's figures when the status was set (16 Nov 2026), for the report and the registry test. */
  recorded: Record<string, number>;
  /** W3a · does not exist for readers (not listed, not on the shelf, its page 404s) until its check passes on stored data. */
  hidden?: boolean;
};
/** W3a · the museum study's address. */
export const MUSEUM_STUDY_SLUG = "nearest-in-the-museum";
export const DATA_STORIES: readonly Entry[] = [
  { slug: "software-homepage-five-years", number: 1, series: "long-view", question: "What happened to the software homepage in five years?",
    deck: "Twelve composite signals across dev tools and enterprise SaaS, then the two brands with the longest stored history, capture by capture.",
    templates: ["multiples", "strip"], params: { sectors: ["dev-tools", "enterprise-saas"], brands: "Two brands with the most usable captures", period: "2021 to now" },
    collection: { label: "Sector report: Dev tools", href: "/sectors/dev-tools" }, status: "live", reason: null, check: "software", recorded: { moved: 8, brandsWithCaptures: 5 } },
  { slug: "who-went-big-first", number: 2, series: "first-movers", question: "Who went big first?",
    deck: "Every tracked brand that took up Big type, in the order the archive first shows it, against the share line.",
    templates: ["adoption"], params: { sectors: null, signal: compositeKey("big_type"), period: "2021 to now" },
    collection: { label: "Signal: Big type", href: `/signals/${encodeURIComponent(compositeKey("big_type"))}` }, status: "live", reason: null, check: "big-type", recorded: { entries: 75 } },
  { slug: "where-did-fintechs-colour-go", number: 3, series: "long-view", question: "Where did fintech's colour go?",
    deck: "Fintech's palette quarter by quarter, then where each brand sits now.",
    templates: ["drift", "field"], params: { sectors: ["fintech"], period: "2021 to now" },
    collection: { label: "Sector report: Fintech", href: "/sectors/fintech" }, status: "draft",
    reason: "Only 5 well-covered quarters have palettes for 15+ fintech brands (needs 8): the archive samples most brands about once a year, in the first quarter of 2021 to 2024, plus the live crawl now. It needs about three more years of quarterly captures, or a denser archive pull for fintech.",
    check: "fintech-colour", recorded: { quarters: 5 } },
  { slug: "which-sector-changes-its-mind", number: 4, series: "sector-v-sector", question: "Which sector changes its mind most?",
    deck: "Measured homepage changes and confirmed rebrands, sector by sector, per compared capture; then the most changeable brand, before and after.",
    templates: ["multiples", "before-after"], params: { sectors: null, period: "2020 to now" },
    collection: { label: "Rebrands", href: "/terminal?panel=rebrands" }, status: "live", reason: null, check: "sector-minds", recorded: { sectors: 10 } },
  // W3a · hidden until 200 stored public-domain works fall into 8 groups of 15. W3b · and until 5 sectors name a group under the
  // comparable-palette rules; withheld by the editor while MUSEUM_SHOWN is false. `recorded` is the stored works on 22 Nov 2026 (595 works,
  // 26 groups, 0 sectors naming a group): the check fails, so a hidden study's status is decided at read time, never by these figures.
  { slug: MUSEUM_STUDY_SLUG, number: 6, series: "sector-v-sector", question: "Which museum palettes are sector homepages nearest to?",
    deck: "Each sector's homepage colours beside the group of public-domain paintings, prints and textiles most of its homepages are nearest to, by measured distance.",
    templates: ["drift"], params: { sectors: null, period: "Newest capture" },
    collection: { label: "All brands", href: "/brands" }, status: "live", reason: null, check: "museum", recorded: { works: 595, groups: 26, sectors: 0 }, hidden: true },
];
/** E4 · "Where does your brand sit?" (/data/where-you-sit) is a tool, not a study: no number (its old 5 is retired), no series. */
export const WHERE_YOU_SIT = { slug: "where-you-sit", kind: "tool" as const, question: "Where does your brand sit?", deck: "Pick a tracked brand: where it sits in its sector, its homepage through time, and the signals that set it apart.", templates: ["field", "strip"] as TemplateId[] } as const;

export const entryOf = (slug: string) => DATA_STORIES.find(e => e.slug === slug) ?? null;
export const templateName = (e: { templates: readonly TemplateId[] }) => e.templates.map(t => TEMPLATES[t]).join(" + ");
/** W3b · withheld by the editor: the museum study does not exist for readers while MUSEUM_SHOWN is false, whatever its check says. */
export const withheld = (e: { slug: string }) => e.slug === MUSEUM_STUDY_SLUG && !MUSEUM_SHOWN;
/** Live in the registry and not hidden (a hidden study joins only through `liveNow`, when its check passes on stored data). */
export const liveEntries = () => DATA_STORIES.filter(e => e.status === "live" && !e.hidden);
/** A study's way on: the other live studies in its series, its collection, then all studies (never itself, never unrelated studies). */
export function relatedFor(slug: string, live = liveEntries()): Link[] {
  const e = entryOf(slug);
  const same = live.filter(x => x.slug !== slug && e && x.series === e.series).map(x => ({ label: `${studyLabel(x.number)}: ${x.question}`, href: `/data/${x.slug}` }));
  return [...same, ...(e ? [e.collection] : []), { label: "All studies", href: "/data" }].filter((l, k, a) => a.findIndex(x => x.href === l.href) === k && l.href !== `/data/${slug}`);
}
