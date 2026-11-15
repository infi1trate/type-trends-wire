/**
 * One source for every (i) card, the glossary panel and the tour copy. Pure.
 * Entry ids are referenced from the UI as `g="<id>"`; glossary.test.ts checks every id used exists here.
 */
import { DIMENSIONS, STAGES, type Dimension, type StageName } from "./labels";

export type GlossaryKind = "panel" | "column" | "metric" | "stage" | "dimension";
export type GlossaryEntry = { id: string; term: string; measures: string; howToRead: string; methodologyAnchor: string; kind: GlossaryKind };
type Row = [id: string, term: string, measures: string, howToRead: string, anchor: string];

const PANELS: Row[] = [
  ["p-today", "Today", "What changed since the last data came in: stage moves, new alerts, the freshest news and crawl status.", "Start here each day; every line links to the panel that proves it.", "m-forecast"],
  ["p-signals", "Signals (F1)", "The overview: font movers, crawl spread and the news wire side by side.", "Scan for what's climbing, then open the full panel for the receipts.", "m-data"],
  ["p-type-index", "Type index", "Every Google Fonts family ranked by popularity, with its 7- and 28-day rank change and stage.", "Sort by 28-day change to find families gaining real use.", "m-type-bands"],
  ["p-in-the-wild", "Type in the wild", "Fonts actually rendered on crawled homepages, by share of sites.", "Compare with Google Fonts rank: high share here means designers ship it.", "m-crawler"],
  ["p-color", "Color", "Measured page colors from the weekly crawl: themes, accents and palettes.", "Look for accents gaining share among vanguard sites first.", "m-crawler"],
  ["p-layout", "Layout", "Layout choices measured in the weekly crawl: hero media, grids, button shapes, headline size.", "Each bar is a share of sites; vanguard vs mainstream shows who leads.", "m-crawler"],
  ["p-composition", "Composition", "How full or empty first screens are: whitespace against text density.", "Sites up and left are airy and sparse; down and right are dense.", "m-crawler"],
  ["p-lexicon", "Lexicon", "Words sites use in their main headline, by share.", "Rising words hint at how brands want to sound right now.", "m-crawler"],
  ["p-vibe-map", "Vibe map", "Sites placed by their AI style tags, grouped into clusters of similar looks.", "Nearby dots look alike; the axis words tell you what changes across the map.", "m-vibe-map"],
  ["p-wire", "Wire", "Design news from RSS, Hacker News, Bluesky and our own trend alerts.", "Alerts are written from the weekly forecast; everything else links out to the source.", "m-wire"],
  ["p-rebrands", "Rebrand desk", "Confirmed identity changes on library sites: fonts, colors, theme and the traits they adopted.", "Each card compares before and after, with the forecast stage of what they moved to.", "m-rebrand-desk"],
  ["p-forecast", "Forecast", "Projected adoption for every trait, the weekly brief and the model's track record.", "Read stage and momentum first; the score ranks what may grow next.", "m-forecast"],
  ["p-library", "Library", "300 tracked sites in 10 sectors, with their current fingerprint and confirmed changes.", "Filter by sector, then open a domain for its full record.", "m-library"],
  ["p-history", "History", "Quarterly design shares since 2021 from archived homepages.", "Use it to see whether a trait is new or a comeback.", "m-history"],
  ["p-spread", "Spread", "How much more (or less) design-led and curated sites use a signal than mainstream sites.", "Positive spread means leaders are ahead; watch it before the mainstream catches up.", "m-crawler"],
  ["p-event-tape", "Event tape", "The latest confirmed changes across the library, newest first.", "A change counts only after two captures agree.", "m-library"],
  ["p-sector-grid", "Sector grid", "Per-sector summary of the library: sites, dark mode, serif headlines, whitespace and change rate.", "Compare a sector against the others to spot its house style.", "m-library"],
  ["p-ai-tags", "AI tags", "Shares of AI-read style tags (imagery, aesthetic, components) across tagged sites.", "Tags come from homepage images; low-confidence reads are left out.", "m-ai-tagging"],
  ["p-ai-pricing", "AI pricing", "How sites price their products, read from pricing pages.", "Shows which sectors offer free tiers, trials or AI add-ons.", "m-ai-tagging"],
  ["p-ai-themes", "AI feature themes", "Topics sites announce in product and changelog pages.", "Repeated themes show where a sector is investing.", "m-ai-tagging"],
  ["p-next-wave", "Next wave", "Traits ranked by the next-wave score, with each part of the score.", "Top rows are the best bets to grow next; check the bars to see why.", "m-next-wave-components"],
  ["p-stage-board", "Stage board", "Every forecast trait sorted into its stage.", "Rising and Emerging are early; Peaking means it's already common.", "m-forecast"],
  ["p-trendsetters", "Trendsetters", "Library sites that adopted traits earliest, before they became common.", "Watch these sites: what they ship tends to spread.", "m-forecast"],
  ["p-lead-lag", "Lead–lag", "The first quarter each sector reached 10% share of a trait.", "Earlier quarters lead; read across a row to see which sector moved first.", "m-forecast"],
  ["p-chart-of-week", "Chart of the week", "One trait chart picked from the weekly brief, ready to share.", "The headline names the trait; the call line says why it matters.", "m-chart-of-the-week"],
  ["p-brief", "Weekly brief", "An AI-written summary of the week's forecast, with every claim cited.", "Click a citation to see the number behind it.", "m-forecast"],
  ["p-model-card", "Model card", "How the forecast was fit this week and how well past forecasts did.", "Lower backtest error means better past calls; missing parts are listed in words.", "m-forecast"],
  ["p-health", "Health", "When each scheduled job last finished successfully.", "Stale means a job is overdue; the data it feeds may be old.", "m-health"],
  ["p-fingerprint", "Fingerprint", "A site's measured design: fonts, colors, theme, hero and spacing.", "Values come from the latest confirmed desktop homepage capture.", "m-library"],
  ["p-wireframe", "Wireframe", "A box diagram of the page layout drawn from measurements, not a screenshot.", "Shows structure only; no page images are stored.", "m-library"],
  ["p-pages", "Pages", "The pages of a site we capture: home, pricing, changelog, product, about.", "Each row shows its latest successful capture.", "m-library"],
  ["p-timeline", "Timeline", "Every confirmed change on this site, newest first.", "A change is confirmed when two captures in a row agree.", "m-library"],
  ["p-sector-comparison", "Sector comparison", "This site's choices against the rest of its sector.", "Shows where the site follows or breaks from its peers.", "m-library"],
  ["p-clusters", "Clusters", "Groups of sites with similar style tags on the vibe map.", "Each cluster is named after its strongest tags.", "m-vibe-map"],
  ["p-accents", "Accents", "The strongest non-neutral colors found on pages, grouped by hue.", "Bigger share means more sites use that accent.", "m-crawler"],
  ["p-palette-wall", "Palette wall", "Each crawled site's measured background and accent colors.", "Real swatches; color is used here because it's the data.", "m-crawler"],
  ["p-media-coverage", "Media coverage", "How much of the first screen is images or video.", "High coverage means image-led heroes.", "m-crawler"],
  ["p-page-length", "Page length", "How tall homepages are, in screens.", "Long pages tell a story; short pages get to the point.", "m-crawler"],
  ["p-density", "Whitespace × text density", "Each site's empty space against how much text it shows.", "The quadrant a site falls in sums up its layout style.", "m-crawler"],
  ["p-font-flow", "Headline font flow", "The top 10 headline fonts in each year of archived homepages.", "Follow a font across years to see it rise or fade.", "m-history"],
  ["p-redesigns", "Redesigns per year", "How many sites changed headline font or accent each year.", "Spikes show redesign waves.", "m-history"],
  ["p-archive", "Archive", "This site's quarterly archived captures.", "Use it to see how the site looked in earlier years, as measurements.", "m-history"],
  ["p-unconfirmed", "Unconfirmed", "Changes seen once that still need a second capture to count.", "These may be tests or glitches until confirmed.", "m-library"],
  ["p-led-by", "Led by", "The sites that adopted this trait first.", "Earliest adopters listed first.", "m-forecast"],
  ["p-components", "Score parts", "The pieces of the next-wave score for this trait.", "Each bar is how far above or below average that part is.", "m-next-wave-components"],
  ["p-compare", "Index comparison", "Share of sites in each group using each value: V vanguard, M mainstream, C curated.", "Longer V bars than M bars mean design-led sites are ahead.", "m-crawler"],
  ["p-console", "Console (/)", "Ask for type, palettes, differentiation or a critique in plain commands.", "Type help to see commands; every answer carries receipts.", "m-taste-tools"],
];

const METRICS: Row[] = [
  ["gap", "Gap", "How far trendsetter sites are ahead of everyone else on a trait, in share points.", "A big gap means leaders adopted it and the rest haven't caught up yet.", "m-next-wave-components"],
  ["momentum", "Momentum", "How fast a trait's share is changing, in points per quarter.", "Positive means growing; +2 means two more sites in every hundred each quarter.", "m-forecast"],
  ["pts-q", "pts/q", "Percentage points of share gained or lost per quarter.", "Going from 10% to 12% share in one quarter is +2 pts/q.", "m-forecast"],
  ["vanguard", "Vanguard", "How much more design-led sites use a trait than mainstream sites.", "Positive means the design vanguard is ahead of the mainstream.", "m-crawler"],
  ["curation", "Curation", "How much more often design galleries feature a trait than mainstream sites use it.", "A rising curation lead often comes before wider adoption.", "m-curation-lead"],
  ["corroboration", "Corroboration", "Whether separate sources (crawl, galleries, news, posts) point the same way.", "More agreement means the move is less likely to be noise.", "m-next-wave-components"],
  ["discourse", "Discourse", "How often people mention a trait in sampled design posts, against its usual level.", "A spike means it's being talked about now; fatigue means the talk is turning tired.", "m-discourse"],
  ["supply", "Supply", "New Google Fonts releases in a font category.", "More new fonts gives designers more to choose from; it applies to font traits only.", "m-supply"],
  ["next-wave-score", "Next-wave score", "One weighted score from gap, vanguard, curation, momentum, corroboration, discourse and supply.", "Higher ranks first; it's a ranking, not a probability.", "m-next-wave-components"],
  ["share", "Share", "The percentage of sites in scope where a trait appears.", "25% means one in four sites uses it.", "m-forecast"],
  ["stage", "Stage", "Where a trait is in its life: Emerging, Rising, Peaking, Fading or Steady.", "Read the word, then check share and momentum for how strong it is.", "m-forecast"],
  ["sector-scope", "Sector scope", "Which sites a number is calculated over: all sectors or a single sector.", "Change it with the sector buttons; all sectors pools every site.", "m-library"],
  ["receipts", "Confidence and receipts", "The evidence behind a number: sample size, dates and links to sources.", "Small samples are flagged; trust them less.", "m-notes"],
  ["projection", "+4Q projection", "Expected share four quarters from now, with an 80% low–high range.", "A wide range means the model is unsure.", "m-forecast"],
  ["series", "Series", "The trait's measured share each quarter, as a small line.", "Read the shape: climbing, flat or falling.", "m-history"],
  ["trait", "Trait", "One measurable design choice: a font, a color, a layout pattern or a style tag.", "The tag after the name is its dimension.", "m-labels"],
  ["signal", "Signal", "A trait we watch for movement.", "Each signal has a plain name and one of four dimensions.", "m-labels"],
  ["dimension", "Dimension", "The family a trait belongs to: FONT, COLOR, LAYOUT or VIBE.", "Use it to focus on what matters for your work.", "m-labels"],
];

const COLUMNS: Row[] = [
  ["rank", "Rank", "Position on Google Fonts by popularity; 1 is the most used.", "Lower numbers are more popular.", "m-data"],
  ["family", "Font family", "A typeface family, as named by Google Fonts or found on a site.", "Click a family for its stage and history.", "m-data"],
  ["category", "Category", "Google Fonts category: sans serif, serif, display, handwriting or monospace.", "Compare families within the same category.", "m-data"],
  ["variable", "Variable", "Whether the family ships as a variable font.", "● means one file covers every weight.", "m-data"],
  ["pop-7d", "Popularity change, 7 days", "Places a family climbed (▲) or fell (▼) over the last week.", "Short-term moves; check 28 days before calling a trend.", "m-type-bands"],
  ["pop-28d", "Popularity change, 28 days", "Places a family climbed or fell over four weeks.", "The main input for a family's stage.", "m-type-bands"],
  ["trending", "Trending rank", "Google Fonts' own trending position.", "Rank 200 or better plus a 28-day climb makes a family Rising.", "m-type-bands"],
  ["sparkline-28d", "28-day line", "The family's popularity rank over the last 28 days.", "Going up means more popular.", "m-type-bands"],
  ["gf-rank", "Google Fonts rank", "Popularity rank on Google Fonts for fonts found in the crawl.", "A low rank but high site share means it's used where it counts.", "m-crawler"],
  ["sites", "Sites", "How many sites show the trait.", "Small counts are less reliable.", "m-crawler"],
  ["v-share", "V%", "Share among vanguard sites: design-forward studios, startups and launches.", "Compare with M% to see who's ahead.", "m-crawler"],
  ["m-share", "M%", "Share among mainstream sites: the most visited origins on the web.", "When V% is far above M%, the trait may spread.", "m-crawler"],
  ["c-share", "C%", "Share among sites featured by design galleries.", "Compare with M% for the curation lead.", "m-curation-lead"],
  ["spread", "Spread", "Vanguard or curated share minus mainstream share, in points.", "Positive means design leaders are ahead.", "m-crawler"],
  ["lead", "Lead", "Which group uses the signal more: vanguard, curated or mainstream.", "Shows who is setting the pace.", "m-crawler"],
  ["delta-week", "ΔWK", "How far the spread moved since last week's crawl.", "Big weekly moves are worth a closer look.", "m-crawler"],
  ["domain", "Domain", "The site's web address.", "Click to open its library record.", "m-library"],
  ["sector", "Sector", "The industry group a site belongs to (one of ten).", "Use it to compare like with like.", "m-library"],
  ["h1-family", "H1 family", "Font used for the main page headline.", "From the latest confirmed capture.", "m-library"],
  ["body-family", "Body family", "Font used for paragraph text.", "From the latest confirmed capture.", "m-library"],
  ["theme", "L/D", "Whether the homepage is mainly light (L) or dark (D).", "Measured from the page background.", "m-library"],
  ["accent", "Accent", "The strongest non-neutral color on the page.", "Real swatch from the measured page.", "m-library"],
  ["hero", "Hero", "What fills the first screen: image, video, 3D or nothing.", "From the latest confirmed capture.", "m-library"],
  ["whitespace", "Space", "How much of the first screen is empty.", "Higher means a more open layout.", "m-library"],
  ["last-change", "Change", "Date of the latest confirmed change.", "Recent dates mean the site is actively evolving.", "m-library"],
  ["events-30d", "Events, 30 days", "Confirmed changes in the last 30 days.", "Higher means more design activity.", "m-library"],
  ["snapshotted", "Snapshotted", "Sites with at least one successful capture.", "Below the site count means some captures are still pending.", "m-library"],
  ["dark-share", "Dark", "Share of sites using a dark theme.", "Compare sectors to see whose house style is dark.", "m-library"],
  ["serif-share", "Serif H1", "Share of sites with a serif headline font.", "A quick read of how editorial a sector looks.", "m-library"],
  ["median-space", "Median space", "Whitespace of the middle site in the sector.", "Higher means the sector leans airy.", "m-library"],
  ["tag-group", "Tag group", "Which AI tag family the value belongs to (imagery, aesthetic, components…).", "Compare values within a group.", "m-ai-tagging"],
  ["tag-value", "Tag value", "One AI-read style tag, in plain words.", "Share is out of tagged sites only.", "m-ai-tagging"],
  ["delta-28d", "Δ28D", "Change in share over the last 28 days, in points.", "Positive means more sites picked it up recently.", "m-ai-tagging"],
  ["pricing-flag", "Pricing flags", "Share of sites in a sector offering a free tier, trial, usage pricing, an AI add-on, credits or contact-only pricing.", "Read across a row to see a sector's pricing habits.", "m-ai-tagging"],
  ["pricing-median", "Median USD / month", "The middle published monthly price among sites that show one in US dollars.", "Only sites with a USD price count (see USD sites).", "m-ai-tagging"],
  ["plan", "Plan", "A plan named on the site's pricing page.", "Prices are as published on the last capture.", "m-ai-tagging"],
  ["job", "Job", "A scheduled task that collects or computes data.", "Each one feeds a panel.", "m-health"],
  ["every", "Every", "How often the job is meant to run.", "A job is stale when it misses two runs in a row.", "m-health"],
  ["last-ok", "Last OK", "When the job last finished successfully.", "Old dates mean the panel it feeds may be stale.", "m-health"],
  ["status", "Status", "OK, stale or never run.", "Only failures are highlighted.", "m-health"],
  ["quarter", "Quarter", "A calendar quarter, e.g. 2026Q3.", "History and forecasts move in quarters.", "m-history"],
  ["sample-n", "N", "How many sites were measured that quarter.", "Small N means less reliable shares.", "m-forecast"],
  ["coverage", "Coverage", "Share of tracked sites with a usable sample that quarter.", "Below 25% the quarter isn't used for fitting.", "m-forecast"],
  ["first-quarter", "First quarter ≥10%", "The first quarter a sector reached 10% share of the trait.", "Earlier means that sector led.", "m-forecast"],
  ["field", "Field", "Which part of the identity changed: headline font, accent, theme and so on.", "Before and after are read from confirmed captures.", "m-rebrand-desk"],
  ["before-after", "Before / After", "The value on the capture before and after the confirmed change.", "Dates show when each capture was taken.", "m-rebrand-desk"],
  ["choice", "Choice / evidence", "The console's recommendation and the sites or numbers behind it.", "Follow the receipts to check each pick.", "m-taste-tools"],
  ["score", "Share / score", "How common the choice is and how well it fits your brief.", "Higher score fits better; lower share stands out more.", "m-taste-tools"],
];

const STAGE_COPY: Record<StageName, [string, string]> = {
  Emerging: ["A trait that's new and still rare, but showing up on leading sites.", "Early: adopt now to look ahead, with some risk it fizzles."],
  Rising: ["A trait whose share is growing quickly.", "The sweet spot: momentum is real but it isn't everywhere yet."],
  Peaking: ["A trait near its widest use; growth is slowing.", "Common now: using it reads as current, not distinctive."],
  Fading: ["A trait whose share is falling.", "Past its moment; it may come back later, so check history."],
  Steady: ["A trait whose share is roughly flat.", "Part of the furniture: neither a bet nor a risk."],
};
const DIM_COPY: Record<Dimension, [string, string]> = {
  FONT: ["Typography: font families, headline and body fonts, letter spacing, type sizes and case.", "Use FONT signals when choosing or pairing typefaces."],
  COLOR: ["Color: themes, accents, color moods and color techniques.", "Use COLOR signals for palette and theme decisions."],
  LAYOUT: ["Structure: grids, hero media, components, buttons, spacing and the tech that builds them.", "Use LAYOUT signals for page and component design."],
  VIBE: ["Feel: aesthetics, imagery style, tone of voice, pricing posture and style clusters.", "Use VIBE signals for art direction and brand voice."],
};

const mk = (kind: GlossaryKind) => ([id, term, measures, howToRead, methodologyAnchor]: Row): GlossaryEntry => ({ id, term, measures, howToRead, methodologyAnchor, kind });
export const stageId = (s: StageName) => `stage-${s.toLowerCase()}`;
export const dimensionId = (d: Dimension) => `dim-${d.toLowerCase()}`;

export const GLOSSARY: GlossaryEntry[] = [
  ...PANELS.map(mk("panel")),
  ...METRICS.map(mk("metric")),
  ...COLUMNS.map(mk("column")),
  ...STAGES.map(s => ({ id: stageId(s), term: s, measures: STAGE_COPY[s][0], howToRead: STAGE_COPY[s][1], methodologyAnchor: "m-forecast", kind: "stage" as const })),
  ...DIMENSIONS.map(d => ({ id: dimensionId(d), term: d, measures: DIM_COPY[d][0], howToRead: DIM_COPY[d][1], methodologyAnchor: "m-labels", kind: "dimension" as const })),
];
const BY_ID = new Map(GLOSSARY.map(e => [e.id, e]));
export const glossaryEntry = (id: string) => BY_ID.get(id);

/** Case-insensitive filter over term, id and copy; terms that start with the query rank first. */
export function searchGlossary(q: string, entries: GlossaryEntry[] = GLOSSARY) {
  const s = q.trim().toLowerCase();
  if (!s) return entries;
  const hit = entries.filter(e => `${e.term} ${e.id} ${e.measures} ${e.howToRead}`.toLowerCase().includes(s));
  return hit.sort((a, b) => Number(!a.term.toLowerCase().startsWith(s)) - Number(!b.term.toLowerCase().startsWith(s)));
}
