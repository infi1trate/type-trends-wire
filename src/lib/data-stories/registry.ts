// THE DATA STORIES REGISTRY — the one list of data stories: permanent number, question, deck, template, parameters, collection and
// status. A story is LIVE only when its "is there a story" check passed on stored data (figures recorded below, re-checked at read time);
// otherwise it stays a DRAFT with the reason. Pure.
import type { CheckId } from "./checks";
import type { Link } from "./types";
import { compositeKey } from "../composites";

export const TEMPLATES = {
  adoption: "Adoption timeline",
  "before-after": "Before and after",
  multiples: "Small multiples by sector",
  field: "Brand field",
  drift: "Palette drift",
  strip: "One object through time",
} as const;
export type TemplateId = keyof typeof TEMPLATES;

export type Entry = {
  slug: string; number: number; question: string; deck: string;
  /** Templates in order of appearance; the first names the story on the index. */
  templates: TemplateId[];
  params: { sectors: string[] | null; signal?: string; brands?: string; period: string };
  collection: Link;
  status: "live" | "draft"; reason: string | null;
  check: CheckId | null;
  /** The check's figures when the status was set (16 Nov 2026), for the report and the registry test. */
  recorded: Record<string, number>;
};
export const DATA_STORIES: readonly Entry[] = [
  { slug: "software-homepage-five-years", number: 1, question: "What happened to the software homepage in five years?",
    deck: "Twelve composite signals across dev tools and enterprise SaaS, then the two brands with the longest stored history, capture by capture.",
    templates: ["multiples", "strip"], params: { sectors: ["dev-tools", "enterprise-saas"], brands: "Two brands with the most usable captures", period: "2021 to now" },
    collection: { label: "Sector report: Dev tools", href: "/sectors/dev-tools" }, status: "live", reason: null, check: "software", recorded: { moved: 8, brandsWithCaptures: 5 } },
  { slug: "who-went-big-first", number: 2, question: "Who went big first?",
    deck: "Every tracked brand that took up Big type, in the order the archive first shows it, against the share line.",
    templates: ["adoption"], params: { sectors: null, signal: compositeKey("big_type"), period: "2021 to now" },
    collection: { label: "Signal: Big type", href: `/signals/${encodeURIComponent(compositeKey("big_type"))}` }, status: "live", reason: null, check: "big-type", recorded: { entries: 75 } },
  { slug: "where-did-fintechs-colour-go", number: 3, question: "Where did fintech's colour go?",
    deck: "Fintech's palette quarter by quarter, then where each brand sits now.",
    templates: ["drift", "field"], params: { sectors: ["fintech"], period: "2021 to now" },
    collection: { label: "Sector report: Fintech", href: "/sectors/fintech" }, status: "draft",
    reason: "Only 5 well-covered quarters have palettes for 15+ fintech brands (needs 8): the archive samples most brands about once a year, in the first quarter of 2021 to 2024, plus the live crawl now. It needs about three more years of quarterly captures, or a denser archive pull for fintech.",
    check: "fintech-colour", recorded: { quarters: 5 } },
  { slug: "which-sector-changes-its-mind", number: 4, question: "Which sector changes its mind most?",
    deck: "Measured homepage changes and confirmed rebrands, sector by sector, per compared capture; then the most changeable brand, before and after.",
    templates: ["multiples", "before-after"], params: { sectors: null, period: "2020 to now" },
    collection: { label: "Rebrands", href: "/terminal?panel=rebrands" }, status: "live", reason: null, check: "sector-minds", recorded: { sectors: 10 } },
];
/** The reader's own story (/data/where-you-sit): its number in the series, outside the list of editorial stories. */
export const WHERE_YOU_SIT = { slug: "where-you-sit", number: 5, question: "Where does your brand sit?", deck: "Pick a tracked brand: where it sits in its sector, its homepage through time, and the signals that set it apart.", templates: ["field", "strip"] as TemplateId[] } as const;

export const entryOf = (slug: string) => DATA_STORIES.find(e => e.slug === slug) ?? null;
export const templateName = (e: { templates: readonly TemplateId[] }) => e.templates.map(t => TEMPLATES[t]).join(" + ");
export const liveEntries = () => DATA_STORIES.filter(e => e.status === "live");
/** Three related links: the other live stories first, then the reader's own story and the collection. */
export function relatedFor(slug: string, live = liveEntries()): Link[] {
  const e = entryOf(slug);
  const others = live.filter(x => x.slug !== slug).map(x => ({ label: `Data story ${x.number}: ${x.question}`, href: `/data/${x.slug}` }));
  const extra: Link[] = [{ label: `Data story ${WHERE_YOU_SIT.number}: ${WHERE_YOU_SIT.question}`, href: `/data/${WHERE_YOU_SIT.slug}` }, ...(e ? [e.collection] : []), { label: "All data stories", href: "/data" }];
  return [...others, ...extra].filter((l, k, a) => a.findIndex(x => x.href === l.href) === k && l.href !== `/data/${slug}`).slice(0, 3);
}
