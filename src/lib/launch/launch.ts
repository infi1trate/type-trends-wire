// The owner's launch readiness page (/status/launch). Pure: it describes the switches as they are set in code
// and turns already-stored facts into plain yes/no pre-flight lines. It changes nothing and has no controls;
// launch.test.ts covers the wording rules. Facts are read by launch.server.ts with the anonymous SELECT-only client.
export type Switch = { id: string; name: string; on: boolean; now: string; exposes: string };
export type Check = { id: string; question: string; yes: boolean | null; detail: string };
export type LaunchFacts = {
  now: number;
  /** Newest crawler post: a finished design-signal crawl or a live library capture. */
  crawlAt: string | null;
  crawlRuns7d: number;
  libraryAt: string | null;
  cropsStored: number | null;
  productHunt: { lastRunAt: string | null; lastOk: boolean | null; okAt: string | null };
  contactEmail: string;
  forecast: { lastOkAt: string | null; stale: boolean | null };
  shareImages: { kind: string; ok: boolean; bytes: number }[] | null;
};
export const CRAWL_WINDOW_MS = 7 * 86_400_000;
const day = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
const newest = (...xs: (string | null)[]) => xs.filter((x): x is string => !!x).sort().at(-1) ?? null;

export function switches(s: { gateEnabled: boolean; openPaths: readonly { why: string }[]; landing: boolean; brand: boolean; dataStories: boolean }): Switch[] {
  const onOff = (b: boolean) => (b ? "On" : "Off");
  return [
    { id: "gate", name: "The site gate", on: s.gateEnabled, now: s.gateEnabled ? "On: every human page asks for the shared password and says not to index it." : "Off: pages are open to anyone and to search engines.",
      exposes: "Turning it off opens every page that is not behind another switch: the front page, stories, signals, brands, patterns, collections, the Digest, Morning Line, sector reports, the terminal and the studio board. Search engines may index them." },
    { id: "open_paths", name: "Open paths", on: s.openPaths.length > 0, now: `${s.openPaths.length} paths answer without the password: machine endpoints, embeds, chart, Digest, trait and audit share images, thumbnails, static files, the tab icon and robots.txt.`,
      exposes: "Adding /share/ and /data/<slug>.png would let link previews draw the brand, collection, Morning Line, sector report, front page, story and data-story cards; while they stay gated a shared link previews without a picture." },
    { id: "landing", name: "LANDING_PUBLIC", on: s.landing, now: `${onOff(s.landing)}: /welcome is gated like every other page.`, exposes: "Turning it on would open /welcome, the landing page, without the password." },
    { id: "brand", name: "BRAND_PUBLIC", on: s.brand, now: `${onOff(s.brand)}: /brand, its pages and its files are gated.`, exposes: "Turning it on would open the brand book (/brand, /brand/<page>) and its downloadable files." },
    { id: "data_stories", name: "DATA_STORIES_PUBLIC", on: s.dataStories, now: `${onOff(s.dataStories)}: /data, every data story, their share images and embeds are gated.`, exposes: "Turning it on would open the data stories, including the one still marked draft unless it is taken out first." },
  ];
}

export function launchChecks(f: LaunchFacts): Check[] {
  const crawl = newest(f.crawlAt, f.libraryAt), recent = !!crawl && f.now - Date.parse(crawl) <= CRAWL_WINDOW_MS;
  const ph = f.productHunt, drawn = f.shareImages;
  return [
    { id: "crawls", question: "Crawls arriving in the last 7 days", yes: recent,
      detail: crawl ? `${recent ? "Yes" : "No"}: newest crawler post ${day(crawl)}; ${f.crawlRuns7d} design-signal crawl${f.crawlRuns7d === 1 ? "" : "s"} finished in the last 7 days.` : "No: the crawler has never posted." },
    { id: "crops", question: "Crops stored", yes: f.cropsStored === null ? null : f.cropsStored > 0,
      detail: f.cropsStored === null ? "Unknown: the count did not load." : f.cropsStored > 0 ? `Yes: ${f.cropsStored} section crops are stored.` : "No: zero crops are stored, so every picture is a redrawn layout." },
    { id: "producthunt", question: "The Product Hunt job succeeding", yes: ph.lastRunAt ? ph.lastOk === true : false,
      detail: !ph.lastRunAt ? "No: no successful run is recorded (failed runs are private). It waits for a Product Hunt developer token." : ph.lastOk ? `Yes: last run ${day(ph.lastRunAt)} succeeded.` : `No: last run ${day(ph.lastRunAt)} failed${ph.okAt ? `; last success ${day(ph.okAt)}` : "; it has never succeeded"}. It waits for a Product Hunt developer token.` },
    { id: "contact", question: "A contact address set for image reports", yes: f.contactEmail.trim() !== "",
      detail: f.contactEmail.trim() ? `Yes: ${f.contactEmail.trim()}.` : "No: no contact address is set, so the corrections line stays hidden." },
    { id: "forecast", question: "The last weekly forecast on time", yes: f.forecast.stale === null ? null : !f.forecast.stale && !!f.forecast.lastOkAt,
      detail: !f.forecast.lastOkAt ? "No: no forecast has finished." : f.forecast.stale ? `No: the last good run was ${day(f.forecast.lastOkAt)}, more than two weeks ago.` : `Yes: the last good run was ${day(f.forecast.lastOkAt)}.` },
    { id: "share", question: "The share images drawing", yes: drawn === null ? null : drawn.length > 0 && drawn.every(d => d.ok),
      detail: drawn === null ? "Unknown: the drawer was not tried." : drawn.every(d => d.ok) ? `Yes: ${drawn.map(d => `${d.kind} ${Math.round(d.bytes / 1024)} KB`).join(", ")}.` : `No: ${drawn.filter(d => !d.ok).map(d => d.kind).join(", ")} did not draw.` },
  ];
}
export const answer = (c: Check) => (c.yes === null ? "Unknown" : c.yes ? "Yes" : "No");
